
// Service Worker pour Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Remplacez par votre configuration Firebase
firebase.initializeApp({
  apiKey: "AIzaSyDs6qQO274Ro2RD4lVkr8KztsZIecP-ZDk",
  authDomain: "studio-2943478321-f746e.firebaseapp.com",
  projectId: "studio-2943478321-f746e",
  messagingSenderId: "679064713235",
  appId: "1:679064713235:web:93b38bd7feda744b24a7e6"
});

const messaging = firebase.messaging();

// Gestion des messages en arrière-plan (veille)
messaging.onBackgroundMessage((payload) => {
  console.log('Notification reçue en arrière-plan:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.tag || 'lagon-brousse-alert',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/'
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
