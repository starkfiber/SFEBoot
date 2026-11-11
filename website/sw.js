const VERSION='sfeboot-local-v1';
const ROOT=new URL('./',self.location).href;
const FILES=['./','app.js','style.css','hash-worker.mjs','sha256.mjs','favicon.svg','manifest.webmanifest','pwa.js'].map(p=>new URL(p,ROOT).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sfeboot-local-')&&k!==VERSION).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!FILES.includes(event.request.url))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(VERSION).then(c=>c.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request)));});
