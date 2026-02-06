
const CACHE_NAME = 'lagon-brousse-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Stratégie résiliente : on tente de cacher chaque ressource individuellement
      // pour qu'une erreur sur un fichier n'empêche pas le reste du cache de fonctionner.
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => 
          cache.add(url).catch(err => console.warn(`[SW] Échec mise en cache de: ${url}`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Stratégie Network First avec fallback sur le cache pour les pages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  // Cache First pour les images et icônes
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
