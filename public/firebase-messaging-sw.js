
// Service Worker spécifique pour Firebase Cloud Messaging (FCM)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Ces valeurs seront injectées par Firebase ou lues depuis votre config
// Note: En production, Firebase initialise automatiquement si le fichier est à la racine
firebase.initializeApp({
  apiKey: "AIzaSyDs6qQO274Ro2RD4lVkr8KztsZIecP-ZDk",
  authDomain: "studio-2943478321-f746e.firebaseapp.com",
  projectId: "studio-2943478321-f746e",
  storageBucket: "studio-2943478321-f746e.appspot.com",
  messagingSenderId: "679064713235",
  appId: "1:679064713235:web:93b38bd7feda744b24a7e6"
});

const messaging = firebase.messaging();

// Handler pour les messages reçus quand l'app est fermée ou en veille
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message en arrière-plan reçu:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data,
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
