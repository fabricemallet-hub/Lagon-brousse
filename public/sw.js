
/**
 * Lagon & Brousse NC - Service Worker
 * Conforme PWABuilder
 */

const CACHE_NAME = 'lb-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Gestionnaire vide requis pour la validation PWA
  event.respondWith(fetch(event.request).catch(() => {
    return caches.match(event.request);
  }));
});
