// Controllo aggiornamenti all'avvio: se online e c'è una nuova versione pubblicata, l'app chiede se installarla.
// - Nel browser / app installata dal browser: il service worker scarica la nuova versione in background.
// - Nell'app Android (APK): si confronta version.json pubblicato e si propone di scaricare il nuovo APK.
import { h, openModal, icon, toast } from './ui.js';
import { VERSION, BUILD } from './build-info.js';
import { SITO, APK_URL } from './config.js';
import { isNativeApp, openExternal } from './native.js';

let registration = null;
let prompted = false;
let accepted = false; // ricarica solo dopo che l'utente ha scelto "Installa"

export const versionLabel = () => (VERSION === 'dev' ? 'sviluppo' : `${VERSION} (build ${BUILD})`);

export async function initUpdates() {
  if (isNativeApp()) { nativeCheck(false); return; }
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
  if (isNativeApp()) { prompted = false; nativeCheck(true); return; }
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

/* ----------------------------- App Android (APK) ----------------------------- */

const parseVer = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
function cmpVersion(a, b) {
  const x = parseVer(a);
  const y = parseVer(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
}

async function nativeCheck(manual) {
  if (VERSION === 'dev') return;
  if (!navigator.onLine) {
    if (manual) toast('Nessuna connessione: impossibile verificare', { type: 'error' });
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${SITO}version.json?t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    const remote = await res.json();
    if (remote && remote.build && remote.build !== BUILD && cmpVersion(remote.version, VERSION) >= 0) {
      offerApk(remote);
    } else if (manual) {
      toast('L\'app è già aggiornata', { type: 'success' });
    }
  } catch {
    if (manual) toast('Verifica non riuscita: riprovare più tardi', { type: 'error' });
  }
}

function offerApk(remote) {
  if (prompted) return;
  prompted = true;
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
        h('div', null, h('span', null, 'Nuova'), h('b', { class: 'accent' }, `${remote.version} (build ${remote.build})`))),
      Array.isArray(remote.notes) && remote.notes.length
        ? h('ul', { class: 'update-notes' }, remote.notes.map((n) => h('li', null, n))) : null,
      h('p', { class: 'muted small' }, 'I dati registrati (tessere, prodotti, movimenti) non vengono toccati.'),
    ],
    footer: [
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Più tardi'),
      h('button', {
        class: 'btn primary', autofocus: true,
        onclick: () => { m.close(); openExternal(`${APK_URL}?v=${encodeURIComponent(remote.build)}`); apkSteps(); },
      }, icon('download', 18), 'Scarica e installa'),
    ],
  });
}

function apkSteps() {
  const m = openModal({
    title: 'Installazione aggiornamento', size: 'sm',
    content: h('ol', { class: 'steps' },
      h('li', null, 'Il browser scarica il file ', h('b', null, 'registro-quadrato.apk'), '.'),
      h('li', null, 'A download finito, toccare la notifica o aprire il file dai Download.'),
      h('li', null, 'Premere ', h('b', null, 'Aggiorna'), ' (o Installa). Tessere, prodotti e movimenti restano.'),
      h('li', null, 'Riaprire l\'app dall\'icona.')),
    footer: h('button', { class: 'btn primary', onclick: () => m.close() }, 'Ho capito'),
  });
}
