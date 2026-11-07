/* Service worker: rende l'app completamente offline.
 * VERSION, BUILD e ASSETS vengono compilati da scripts/build.mjs.
 * Ogni nuova pubblicazione cambia BUILD -> il tablet, all'avvio, trova il
 * nuovo service worker "in attesa" e l'app chiede se installare l'aggiornamento.
 */
const VERSION = '__VERSION__';
const BUILD = '__BUILD__';
const ASSETS = /*ASSETS*/['./', './index.html']/*END_ASSETS*/;

const CACHE = `quadrato-${VERSION}-${BUILD}`;

self.addEventListener('install', (event) => {
  // Niente skipWaiting automatico: l'aggiornamento parte solo se l'utente conferma.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('quadrato-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION, build: BUILD });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // version.json serve solo a leggere le note di rilascio: sempre dalla rete.
  if (url.pathname.endsWith('/version.json')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { cacheName: CACHE }).then((r) => r || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req))
  );
});
