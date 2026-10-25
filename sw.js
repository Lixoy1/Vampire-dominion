const CACHE_NAME = 'vd-local-v225';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './source-samples.js',
  './engine.js',
  './engine-data.js',
  './app.js',
  './illustrations.js',
  './manifest.webmanifest',
  './assets/crest.svg',
  './assets/dominion-love-small-00.b64',
  './assets/dominion-love-small-02.b64',
  './assets/dominion-love-small-03.b64',
  './assets/dominion-love-small-04.b64',
  './assets/dominion-closeness-small-01.b64',
  './assets/dominion-closeness-small-02.b64',
  './assets/dominion-closeness-small-03.b64',
  './assets/dominion-closeness-small-04.b64'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('vd-local-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const exactMatch = await caches.match(event.request);
    if (exactMatch) return exactMatch;

    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const offlineMatch = await caches.match(event.request, { ignoreSearch: true });
      if (offlineMatch) return offlineMatch;
      return new Response('Ресурс недоступен офлайн. Открой приложение с подключением к интернету, чтобы обновить кэш.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
