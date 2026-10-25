const C = 'vd-local-v233';
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
  './assets/optimist-love.webp',
  './assets/closeness.webp',
  './assets/optimist-vampire-clean.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(C)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('vd-local-') && key !== C)
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
    const cache = await caches.open(C);
    const cached = await cache.match(event.request)
      || await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const offline = await cache.match(event.request, { ignoreSearch: true });
      if (offline) return offline;
      return new Response('Ресурс не сохранён для офлайн-режима. Подключись к интернету и открой приложение ещё раз.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
