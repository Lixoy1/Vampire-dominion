const CACHE_NAME = 'vd-blood-moon-v313';
const CORE_ASSETS = [
  './',
  './index.html',
  './assets/css/style.css?v=313',
  './scripts/app.js?v=313',
  './scripts/data.js',
  './scripts/engine.js',
  './assets/crest.svg',
  './assets/brand-hero.png',
  './assets/brand-sticker.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const obsolete = keys.filter((key) =>
      key !== CACHE_NAME && (key.startsWith('vd-local-') || key.startsWith('vd-blood-moon-'))
    );
    await Promise.all(obsolete.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response && response.ok && response.type === 'basic') {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
