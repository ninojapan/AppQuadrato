// Aiuto all'installazione come app (Android: prompt di sistema, iPad/iPhone: istruzioni).
import { h, icon, openModal } from '../ui.js';

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    return;
  }
  showInstructions();
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
        h('li', null, 'Aprire questa pagina con ', h('b', null, 'Chrome'), '.'),
        h('li', null, 'Toccare il menu ', h('b', null, '⋮'), ' in alto a destra.'),
        h('li', null, 'Scegliere ', h('b', null, '“Installa app”'), ' (o “Aggiungi a schermata Home”).'),
        h('li', null, 'Aprire l\'app dall\'icona: funziona anche senza internet.')),
    footer: h('button', { class: 'btn primary', onclick: () => m.close() }, 'Ho capito'),
  });
}

export function installBanner() {
  if (isStandalone()) return null;
  return h('div', { class: 'install-banner' },
    icon('install', 22),
    h('span', null, 'Per usarla offline installa l\'app sul tablet'),
    h('button', { class: 'btn sm primary', onclick: () => installApp() }, 'Installa'));
}
