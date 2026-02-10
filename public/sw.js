// Service Worker Statique pour PWABuilder
const CACHE_NAME = 'lb-nc-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icon-192x192.png'
      ]).catch(() => {
        console.log('Installation SW : Certains fichiers n\'ont pas pu être mis en cache (normal en dev)');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Stratégie simplifiée pour ne pas bloquer le développement
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});