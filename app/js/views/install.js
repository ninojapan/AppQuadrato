// Aiuto all'installazione: Android (APK o browser) e iPad/iPhone (Safari).
import { h, icon, openModal } from '../ui.js';
import { APK_URL } from '../config.js';
import { isNativeApp } from '../native.js';

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export const isStandalone = () =>
  isNativeApp() || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = () => /Android/i.test(navigator.userAgent);

export async function installApp() {
  if (isIOS()) { showInstructions(); return; }
  if (isAndroid()) { showAndroidOptions(); return; }
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    return;
  }
  showInstructions();
}

function showAndroidOptions() {
  const m = openModal({
    title: 'Installa l\'app sul tablet Android', size: 'sm',
    content: [
      h('div', { class: 'install-option recommended' },
        h('div', { class: 'install-option-head' }, icon('download', 22), h('b', null, 'App Android (APK)'), h('span', { class: 'tag ok-tag' }, 'Consigliato')),
        h('p', { class: 'small' }, 'Funziona su qualsiasi tablet Android, anche senza Chrome.'),
        h('ol', { class: 'steps small' },
          h('li', null, 'Premere ', h('b', null, 'Scarica APK'), '.'),
          h('li', null, 'Aprire il file scaricato (notifica o cartella Download).'),
          h('li', null, 'Se Android lo chiede, consentire “Installa app sconosciute” per il browser, poi tornare indietro.'),
          h('li', null, 'Premere ', h('b', null, 'Installa'), ' e aprire “Quadrato Ufficiali”.')),
        h('a', { class: 'btn primary block', href: APK_URL, download: 'registro-quadrato.apk' }, icon('download', 18), 'Scarica APK')),
      h('div', { class: 'install-option' },
        h('div', { class: 'install-option-head' }, icon('install', 22), h('b', null, 'Dal browser')),
        h('p', { class: 'small' }, 'Chrome: menu ⋮ → “Installa app” o “Aggiungi a schermata Home”. Firefox: menu ⋮ → “Installa”. Samsung Internet: menu ☰ → “Aggiungi pagina a” → “Schermata Home”.'),
        deferredPrompt ? h('button', {
          class: 'btn ghost block',
          onclick: async () => { m.close(); deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => null); deferredPrompt = null; },
        }, icon('install', 18), 'Installa dal browser') : null),
    ],
    footer: h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Chiudi'),
  });
}

export function showInstructions() {
  const ios = isIOS();
  const m = openModal({
    title: 'Installa l\'app sul tablet', size: 'sm',
    content: ios
      ? h('ol', { class: 'steps' },
        h('li', null, 'Aprire questa pagina con ', h('b', null, 'Safari'), '.'),
        h('li', null, 'Toccare il pulsante ', h('b', null, 'Condividi'), ' ', icon('share', 18), ' in alto.'),
        h('li', null, 'Scegliere ', h('b', null, '“Aggiungi alla schermata Home”'), '.'),
        h('li', null, 'Aprire l\'app dall\'icona sulla schermata Home: funziona anche senza internet.'))
      : h('ol', { class: 'steps' },
        h('li', null, 'Aprire questa pagina con ', h('b', null, 'Chrome'), ' o ', h('b', null, 'Edge'), '.'),
        h('li', null, 'Usare il pulsante ', h('b', null, '“Installa”'), ' nella barra dell\'indirizzo o nel menu.'),
        h('li', null, 'Aprire l\'app dall\'icona: funziona anche senza internet.')),
    footer: h('button', { class: 'btn primary', onclick: () => m.close() }, 'Ho capito'),
  });
}

export function installBanner(where) {
  if (isStandalone()) return null;
  const msg = where === 'setup'
    ? 'Installa prima l\'app sul tablet e configurala da lì: i dati restano dove vengono inseriti.'
    : isAndroid() ? 'Installa l\'app sul tablet Android' : 'Per usarla offline installa l\'app sul tablet';
  return h('div', { class: `install-banner ${where === 'setup' ? 'setup' : ''}` },
    icon('install', 22),
    h('span', null, msg),
    h('button', { class: 'btn sm primary', onclick: () => installApp() }, 'Installa'));
}
