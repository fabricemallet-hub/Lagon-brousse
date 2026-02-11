
const CACHE_NAME = 'lb-nc-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Service worker minimal pour conformité PWABuilder
  event.respondWith(fetch(event.request).catch(() => {
    return caches.match(event.request);
  }));
});
