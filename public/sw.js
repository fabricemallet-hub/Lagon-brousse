/**
 * Lagon & Brousse NC - Robust Service Worker v2.0.1
 * Optimisé pour la validation PWABuilder et la résilience aux fichiers manquants.
 */

const CACHE_NAME = 'lb-nc-static-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Installation : Mise en cache résiliente
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On ajoute les fichiers un par un pour éviter qu'une icône manquante 
      // ne fasse échouer l'enregistrement global (erreur addAll).
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => 
          cache.add(url).catch(err => console.warn(`SW: Échec de mise en cache pour ${url}`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activation : Nettoyage des anciens caches
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

// Fetch : Stratégie Network-First avec fallback sur le cache
self.addEventListener('fetch', (event) => {
  // On ne gère que les requêtes GET standards
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Optionnel : on pourrait mettre à jour le cache ici
        return response;
      })
      .catch(() => {
        // En cas d'échec réseau, on cherche dans le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // Si on est sur une navigation de page, on renvoie la racine
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
