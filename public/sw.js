const cacheName = 'bodega-store-v1';
const assets = [
  '/',
  '/index.html',
  '/vite.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll(assets))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(cacheName).then((cache) => cache.put(e.request, resClone));
        return response;
      })
      .catch(() => caches.match(e.request).then((res) => res))
  );
});
