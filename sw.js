const CACHE_NAME='vd-local-v310';
const CORE_ASSETS=[
  './','./index.html','./styles.css','./data.js','./source-samples.js',
  './engine.js','./engine-data.js','./app.js','./manifest.webmanifest',
  './assets/crest.svg'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache=>cache.addAll(CORE_ASSETS))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('vd-local-')&&key!==CACHE_NAME)
      .map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(event.request);
    if(cached) return cached;
    try{
      const response=await fetch(event.request);
      if(response.ok) await cache.put(event.request,response.clone());
      return response;
    }catch(error){
      return cache.match('./index.html');
    }
  })());
});