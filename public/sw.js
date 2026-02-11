self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // PWABuilder requires a fetch handler to validate offline capability
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Mode hors-ligne actif. Reconnectez-vous pour les données live.');
    })
  );
});