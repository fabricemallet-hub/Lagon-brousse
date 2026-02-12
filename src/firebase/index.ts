'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';

/**
 * @fileOverview Point d'entrée central pour Firebase.
 * Gère l'initialisation unique des services et la stabilisation de Firestore.
 */

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let messaging: Messaging | null = null;

/**
 * Initialise Firebase et ses services avec les paramètres optimisés pour le Cloud.
 * Le mode experimentalForceLongPolling est activé pour résoudre l'erreur "INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)".
 */
export function initializeFirebase() {
  if (!app) {
    // 1. Initialisation de l'App (Singleton)
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // 2. Initialisation de l'Auth
    auth = getAuth(app);
    
    // 3. Initialisation de Firestore avec Long Polling (Crucial pour la stabilité en proxy/cloud)
    try {
      firestore = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // Si déjà initialisé, on récupère l'instance existante
      firestore = getFirestore(app);
    }

    // 4. Messagerie (Client side uniquement)
    if (typeof window !== 'undefined') {
      try {
        messaging = getMessaging(app);
      } catch (e) {
        // FCM peut ne pas être supporté sur certains navigateurs
      }
    }
  }

  return {
    firebaseApp: app,
    auth,
    firestore,
    messaging
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';