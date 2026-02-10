// Service Worker statique pour Lagon & Brousse NC
// Assure la validation PWABuilder et une base de support hors-ligne

const CACHE_NAME = 'lb-nc-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon-192x192.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Optionnel : ignorer les erreurs de cache au démarrage
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Stratégie simple : Network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
