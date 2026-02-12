'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

// Singleton pour les services
let initializedServices: any = null;

/**
 * Initialise Firebase et ses services avec les paramètres optimisés pour le Cloud.
 * Utilise experimentalForceLongPolling pour stabiliser la connexion Firestore.
 */
export function initializeFirebase() {
  if (initializedServices) return initializedServices;

  let firebaseApp: FirebaseApp;
  
  if (!getApps().length) {
    try {
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      console.warn('Firebase init fallback:', e);
      firebaseApp = initializeApp(firebaseConfig);
    }
  } else {
    firebaseApp = getApp();
  }

  // Initialisation optimisée de Firestore
  // experimentalForceLongPolling résout les erreurs "Unexpected state ID: ca9" 
  // en forçant HTTP au lieu des WebSockets instables dans les workstations.
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch (e) {
    console.warn("Firestore initialize error, falling back to getFirestore:", e);
    firestore = getFirestore(firebaseApp);
  }

  let messaging = null;
  if (typeof window !== 'undefined') {
    try {
      messaging = getMessaging(firebaseApp);
    } catch (e) {
      console.warn("Messaging not supported in this browser environment");
    }
  }

  initializedServices = {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    messaging
  };

  return initializedServices;
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';