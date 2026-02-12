'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';

/**
 * @fileOverview Point d'entrée central pour Firebase.
 * Gère l'initialisation unique et forcée pour la stabilité Firestore (Long Polling).
 * Utilise un pattern Singleton robuste pour éviter les erreurs d'assertion interne (ca9).
 */

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let messaging: Messaging | null = null;

export function initializeFirebase() {
  // 1. Initialisation de l'App (Singleton)
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // 2. Initialisation de l'Auth
  if (!auth) {
    auth = getAuth(app);
  }

  // 3. Initialisation de Firestore avec paramètres de stabilité forcés
  // CRITIQUE : initializeFirestore doit être le PREMIER appel pour configurer le transport.
  if (!firestore) {
    try {
      firestore = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // Si déjà initialisé (ex: Fast Refresh), on récupère l'instance existante
      const { getFirestore } = require('firebase/firestore');
      firestore = getFirestore(app);
    }
  }

  // 4. Initialisation de Messaging (Client-side uniquement)
  if (typeof window !== 'undefined' && !messaging) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      // FCM peut ne pas être supporté sur certains navigateurs
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