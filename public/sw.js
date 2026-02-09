/**
 * Service Worker L&B NC - v2.0.1
 * Optimisé pour PWABuilder et la stabilité hors-ligne.
 */

const CACHE_NAME = 'lagon-brousse-cache-v2';
const OFFLINE_URL = '/';

const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On utilise addAll mais on catch individuellement pour éviter de planter
      // si une icône manque (souvent le cas au début du projet)
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes vers Firebase, Google Maps et les analytics pour le cache
  const url = event.request.url;
  if (
    url.includes('firestore.googleapis.com') || 
    url.includes('maps.googleapis.com') ||
    url.includes('google-analytics.com') ||
    url.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  // Stratégie : Network First avec fallback sur le cache
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request) || caches.match(OFFLINE_URL);
      })
  );
});
