/**
 * @fileOverview Service Worker robuste pour Lagon & Brousse NC.
 * Gère le mode hors-ligne basique et la conformité PWA sans bloquer le développement.
 */

const CACHE_NAME = 'lb-nc-v2';
const ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On utilise Promise.allSettled pour ne pas faire échouer l'installation
      // si une icône est manquante temporairement.
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => console.warn(`Cache skip: ${url}`)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Stratégie : Réseau d'abord, cache en secours
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
