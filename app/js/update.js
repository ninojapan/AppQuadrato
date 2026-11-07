// Controllo aggiornamenti all'avvio: se online e c'è una nuova versione pubblicata,
// il service worker la scarica in background e l'app chiede se installarla.
import { h, openModal, icon, toast } from './ui.js';
import { VERSION, BUILD } from './build-info.js';

let registration = null;
let prompted = false;
let accepted = false; // ricarica solo dopo che l'utente ha scelto "Installa"

export const versionLabel = () => (VERSION === 'dev' ? 'sviluppo' : `${VERSION} (build ${BUILD})`);

export async function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  } catch (err) {
    console.warn('Service worker non registrato', err);
    return;
  }

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !accepted) return;
    reloading = true;
    location.reload();
  });

  watch(registration);
  if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
  if (navigator.onLine) registration.update().catch(() => { /* offline: nessun problema */ });
}

function watch(reg) {
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) offer(sw);
    });
  });
}

/** Verifica manuale (da Impostazioni). */
export async function checkForUpdatesNow() {
  if (!registration) { toast('Aggiornamenti non disponibili su questo dispositivo', { type: 'error' }); return; }
  if (!navigator.onLine) { toast('Nessuna connessione: impossibile verificare', { type: 'error' }); return; }
  try {
    prompted = false;
    await registration.update();
    if (registration.waiting) offer(registration.waiting);
    else if (!registration.installing) toast('L\'app è già aggiornata', { type: 'success' });
  } catch {
    toast('Verifica non riuscita: riprovare più tardi', { type: 'error' });
  }
}

function askVersion(sw) {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
    try { sw.postMessage({ type: 'GET_VERSION' }, [ch.port2]); } catch { resolve(null); }
  });
}

async function offer(sw) {
  if (prompted) return;
  prompted = true;
  const [info, notes] = await Promise.all([
    askVersion(sw),
    fetch('./version.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
  ]);
  const nuova = info ? `${info.version} (build ${info.build})` : (notes?.version || 'nuova');
  const m = openModal({
    title: 'Aggiornamento disponibile',
    size: 'sm',
    dismissable: false,
    className: 'update-modal',
    content: [
      h('div', { class: 'update-hero' }, icon('download', 40)),
      h('p', { class: 'confirm-msg' }, 'È disponibile una nuova versione dell\'app. Vuoi installarla adesso?'),
      h('div', { class: 'update-versions' },
        h('div', null, h('span', null, 'Installata'), h('b', null, versionLabel())),
        h('div', null, h('span', null, 'Nuova'), h('b', { class: 'accent' }, nuova))),
      notes && Array.isArray(notes.notes) && notes.notes.length
        ? h('ul', { class: 'update-notes' }, notes.notes.map((n) => h('li', null, n))) : null,
      h('p', { class: 'muted small' }, 'I dati registrati (tessere, prodotti, movimenti) non vengono toccati.'),
    ],
    footer: [
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Più tardi'),
      h('button', {
        class: 'btn primary', autofocus: true,
        onclick: (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Installazione…';
          accepted = true;
          sw.postMessage({ type: 'SKIP_WAITING' });
        },
      }, icon('download', 18), 'Installa'),
    ],
  });
}
