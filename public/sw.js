// Lagon & Brousse NC - Service Worker v2.0
const CACHE_NAME = 'lb-nc-cache-v2';

// Liste des ressources critiques pour le fonctionnement de base
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // settled permet de ne pas faire échouer l'installation si un fichier (ex: icône) manque
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
  // Stratégie : Network First (Réseau d'abord) avec repli sur Cache
  // Idéal pour une app de météo/marées qui nécessite des données fraîches
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // On met à jour le cache avec la nouvelle réponse
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
          return response;
        })
        .catch(() => {
          // Si réseau coupé, on cherche dans le cache
          return caches.match(event.request);
        })
    );
  }
});
