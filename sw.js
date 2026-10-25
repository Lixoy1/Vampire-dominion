const C='vd-local-v226';
self.addEventListener('install',event=>event.waitUntil(
  caches.open(C).then(cache=>cache.addAll([
    './','./index.html','./styles.css','./data.js','./source-samples.js',
    './engine.js','./engine-data.js','./app.js','./illustrations.js',
    './manifest.webmanifest','./assets/crest.svg',
    './assets/optimist-love-couple.webp.b64','./assets/closeness-couple.webp.b64'
  ])).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('vd-local-')&&key!==C).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(C).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>cached)));
});
