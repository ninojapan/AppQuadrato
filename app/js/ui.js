// Mini-libreria UI: creazione elementi, icone, modali, conferme, notifiche.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
        }
      }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

/* ----------------------------- Icone ----------------------------- */
const P = {
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  euro: '<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  alert: '<path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  refresh: '<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>',
  stack: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  backspace: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><path d="m18 9-6 6M12 9l6 6"/>',
  sort: '<path d="M3 6h18M6 12h12M10 18h4"/>',
  install: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>',
  anchor: '<circle cx="12" cy="5" r="3"/><path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/>',
};

export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'ic';
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  return span;
}

/* ----------------------------- Modali ----------------------------- */
const modalRoot = () => document.getElementById('modals');
const openModals = [];

/**
 * Apre una finestra modale. Restituisce { el, body, close }.
 * opts: { title, subtitle, content, footer, size: 'sm'|'md'|'lg'|'full', onClose, dismissable, className, header }
 */
export function openModal(opts) {
  const { title, subtitle, content, footer, size = 'md', onClose, dismissable = true, className = '', header } = opts;
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    overlay.classList.add('closing');
    const i = openModals.indexOf(api);
    if (i !== -1) openModals.splice(i, 1);
    setTimeout(() => overlay.remove(), 160);
    onClose && onClose(result);
  };
  const body = h('div', { class: 'modal-body' }, content);
  const head = header || (title ? h('div', { class: 'modal-head' },
    h('div', { class: 'modal-titles' }, h('h2', null, title), subtitle ? h('div', { class: 'modal-sub' }, subtitle) : null),
    dismissable ? h('button', { class: 'icon-btn', 'aria-label': 'Chiudi', onclick: () => close() }, icon('x')) : null,
  ) : null);
  const dialog = h('div', { class: `modal modal-${size} ${className}`, role: 'dialog', 'aria-modal': 'true' },
    head, body, footer ? h('div', { class: 'modal-foot' }, footer) : null);
  const overlay = h('div', { class: 'overlay' }, dialog);
  if (dismissable) {
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) overlay.dataset.down = '1';
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && overlay.dataset.down === '1') close();
      delete overlay.dataset.down;
    });
  }
  modalRoot().append(overlay);
  const api = { el: dialog, body, close, dismissable };
  openModals.push(api);
  requestAnimationFrame(() => {
    // non spostare il focus se l'utente ha già toccato un campo della finestra
    if (dialog.contains(document.activeElement)) return;
    const auto = dialog.querySelector('[autofocus]');
    if (auto) auto.focus();
  });
  return api;
}

export function closeAllModals() {
  for (const m of [...openModals]) m.close();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openModals.length) {
    const top = openModals[openModals.length - 1];
    if (top.dismissable) top.close();
  }
});

export function confirmDialog(message, { title = 'Conferma', ok = 'Conferma', cancel = 'Annulla', danger = false, detail } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal({
      title, size: 'sm',
      content: [h('p', { class: 'confirm-msg' }, message), detail ? h('div', { class: 'confirm-detail' }, detail) : null],
      footer: [
        h('button', { class: 'btn ghost', onclick: () => m.close() }, cancel),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, autofocus: true, onclick: () => { result = true; m.close(); } }, ok),
      ],
      onClose: () => resolve(result),
    });
  });
}

export function alertDialog(message, { title = 'Attenzione' } = {}) {
  return new Promise((resolve) => {
    const m = openModal({
      title, size: 'sm',
      content: h('p', { class: 'confirm-msg' }, message),
      footer: h('button', { class: 'btn primary', autofocus: true, onclick: () => m.close() }, 'OK'),
      onClose: resolve,
    });
  });
}

/* ----------------------------- Toast ----------------------------- */
export function toast(message, { type = 'info', duration = 2600, action } = {}) {
  const root = document.getElementById('toasts');
  const el = h('div', { class: `toast toast-${type}` },
    h('span', { class: 'toast-ic' }, icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'anchor', 20)),
    h('span', { class: 'toast-msg' }, message));
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  };
  if (action) {
    el.append(h('button', {
      class: 'toast-action',
      onclick: async () => { dismiss(); await action.run(); },
    }, action.label));
    if (action.countdown) {
      const bar = h('div', { class: 'toast-bar', style: { animationDuration: `${duration}ms` } });
      el.append(bar);
    }
  }
  root.append(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  timer = setTimeout(dismiss, duration);
  return dismiss;
}

export function clearToasts() {
  const root = document.getElementById('toasts');
  if (root) root.replaceChildren();
}

export function showError(err) {
  console.error(err);
  toast(err && err.message ? err.message : String(err), { type: 'error', duration: 4000 });
}

/** Esegue fn mostrando eventuali errori come toast. Restituisce il risultato o undefined. */
export async function safe(fn) {
  try { return await fn(); } catch (err) { showError(err); return undefined; }
}

/* ----------------------------- Campi modulo ----------------------------- */
export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function switchInput(checked, onchange) {
  const input = h('input', { type: 'checkbox', checked, onchange: (e) => onchange && onchange(e.target.checked) });
  return h('span', { class: 'switch' }, input, h('span', { class: 'switch-track' }, h('span', { class: 'switch-thumb' })));
}

export function segmented(options, value, onchange) {
  const wrap = h('div', { class: 'segmented', role: 'tablist' });
  const render = () => {
    clear(wrap);
    for (const o of options) {
      wrap.append(h('button', {
        type: 'button', class: `seg ${o.value === value ? 'active' : ''}`,
        onclick: () => { value = o.value; render(); onchange(o.value); },
      }, o.icon ? icon(o.icon, 18) : null, o.label));
    }
  };
  render();
  return wrap;
}

export function emptyState(iconName, title, text, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-ic' }, icon(iconName, 40)),
    h('h3', null, title), text ? h('p', null, text) : null, action || null);
}
