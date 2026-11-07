import { state, load, isConfigured, isAdmin } from './store.js';
import { h, icon, clear, closeAllModals, toast, showError, clearToasts } from './ui.js';
import { initUpdates } from './update.js';
import { renderLock } from './views/lock.js';
import { renderSetup } from './views/setup.js';
import { renderHome } from './views/home.js';
import { renderCards } from './views/cards.js';
import { renderProducts } from './views/products.js';
import { renderMovements } from './views/movements.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';
import { promptAdminLogin } from './views/lock.js';

export const DEFAULT_LOGO = 'assets/logo.png';
export const TITLE = 'REGISTRO QUADRATO UFFICIALI';

const VIEWS = {
  home: { label: 'Cassa', icon: 'cart', render: renderHome },
  tessere: { label: 'Tessere', icon: 'card', render: renderCards, admin: true },
  prodotti: { label: 'Prodotti', icon: 'box', render: renderProducts, admin: true },
  movimenti: { label: 'Movimenti', icon: 'list', render: renderMovements },
  statistiche: { label: 'Statistiche', icon: 'chart', render: renderStats },
  impostazioni: { label: 'Impostazioni', icon: 'settings', render: renderSettings, admin: true },
};

let current = 'home';
let viewCleanup = null;
const root = () => document.getElementById('app');

export const logoSrc = () => state.settings.logo || DEFAULT_LOGO;

export function brand(size = 'md') {
  return h('div', { class: `brand brand-${size}` },
    h('img', { class: 'brand-logo', src: logoSrc(), alt: 'Logo nave', draggable: 'false' }),
    h('div', { class: 'brand-text' },
      h('div', { class: 'brand-title' }, TITLE),
      state.settings.shipName ? h('div', { class: 'brand-sub' }, state.settings.shipName) : null));
}

/* ----------------------------- Navigazione ----------------------------- */

export function navigate(view = current) {
  if (!state.role) return showLock();
  if (VIEWS[view]?.admin && !isAdmin()) view = 'home';
  current = view;
  if (viewCleanup) { try { viewCleanup(); } catch { /* ignora */ } viewCleanup = null; }
  const shell = buildShell();
  const main = shell.querySelector('.main');
  clear(root()).append(shell);
  const cleanup = VIEWS[view].render(main);
  if (typeof cleanup === 'function') viewCleanup = cleanup;
}

export const refresh = () => navigate(current);

function buildShell() {
  const admin = isAdmin();
  const clock = h('div', { class: 'clock' });
  const tick = () => {
    const d = new Date();
    clock.textContent = `${d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  };
  tick();
  clearInterval(buildShell.clockTimer);
  buildShell.clockTimer = setInterval(tick, 15000);

  const header = h('header', { class: 'topbar' },
    brand(),
    h('div', { class: 'topbar-right' },
      clock,
      h('span', { class: `role-badge ${admin ? 'admin' : 'oper'}` }, icon(admin ? 'key' : 'users', 16), admin ? 'ADMIN' : 'OPERATORE'),
      admin
        ? h('button', { class: 'btn ghost sm', onclick: () => exitAdmin() }, icon('logout', 18), h('span', { class: 'hide-sm' }, 'Esci admin'))
        : h('button', { class: 'btn ghost sm', onclick: () => promptAdminLogin(() => { toast('Modalità amministratore', { type: 'success' }); navigate(current); }) },
          icon('key', 18), h('span', { class: 'hide-sm' }, 'Admin')),
      h('button', { class: 'icon-btn', title: 'Blocca', 'aria-label': 'Blocca', onclick: () => lockApp() }, icon('lock'))));

  // L'operatore vede Cassa, Movimenti e Statistiche; l'amministratore tutte le sezioni.
  const nav = h('nav', { class: 'tabbar' },
    Object.entries(VIEWS).filter(([, v]) => admin || !v.admin).map(([key, v]) => h('button', {
      class: `tab ${key === current ? 'active' : ''}`, onclick: () => navigate(key),
    }, icon(v.icon, 22), h('span', null, v.label))));

  return h('div', { class: `shell ${admin ? 'is-admin' : 'is-oper'}` }, header, h('main', { class: 'main' }), nav);
}

/* ----------------------------- Sessione ----------------------------- */

export function setRole(role) {
  state.role = role;
  lastActivity = Date.now();
}

export function lockApp() {
  closeAllModals();
  clearToasts();
  state.role = null;
  showLock();
}

function exitAdmin() {
  state.role = 'operatore';
  closeAllModals();
  navigate('home');
  toast('Modalità operatore');
}

function showLock() {
  if (viewCleanup) { try { viewCleanup(); } catch { /* ignora */ } viewCleanup = null; }
  clearInterval(buildShell.clockTimer);
  renderLock(clear(root()), (role) => {
    setRole(role);
    current = 'home';
    navigate('home');
    if (role === 'admin') backupReminder();
  });
}

let lastActivity = Date.now();
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => {
  if (!isAdmin()) return;
  const minutes = Number(state.settings.adminTimeout) || 0;
  if (minutes > 0 && Date.now() - lastActivity > minutes * 60000) {
    exitAdmin();
    toast('Sessione amministratore scaduta per inattività', { duration: 4000 });
  }
}, 10000);

function backupReminder() {
  const last = state.settings.lastBackup;
  const hasData = state.tessere.length || state.prodotti.length;
  if (hasData && (!last || Date.now() - last > 7 * 86400000)) {
    toast(last ? 'Ultimo backup oltre 7 giorni fa: fare un backup da Impostazioni' : 'Nessun backup eseguito: fare un backup da Impostazioni', {
      type: 'info', duration: 7000,
      action: { label: 'Backup', run: () => navigate('impostazioni') },
    });
  }
}

/* ----------------------------- Avvio ----------------------------- */

async function boot() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await load();
  } catch (err) {
    clear(root()).append(h('div', { class: 'fatal' }, h('h2', null, 'Impossibile aprire l\'archivio dati'), h('p', null, String(err.message || err))));
    return;
  }
  if (!isConfigured()) {
    renderSetup(clear(root()), (role) => { setRole(role); navigate('home'); });
  } else {
    showLock();
  }
  initUpdates();
}

window.addEventListener('unhandledrejection', (e) => showError(e.reason));
boot();
