const CACHE = "cudfirm-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e)=>{
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=> c.put(e.request, copy));
      return resp;
    }).catch(()=> res))
  );
});