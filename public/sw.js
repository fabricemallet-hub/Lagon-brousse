const CACHE_NAME = 'lb-nc-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Handler simple pour valider les critères PWA de PWABuilder
  // En production, on pourrait ajouter une vraie stratégie de cache ici
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});