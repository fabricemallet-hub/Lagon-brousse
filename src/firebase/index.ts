'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore, getFirestore } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';

/**
 * @fileOverview Point d'entrée central pour Firebase.
 * Utilise un singleton global pour garantir une initialisation unique et stable.
 */

// Utilisation de globalThis pour persister l'instance à travers les rafraîchissements HMR
declare global {
  var __FIREBASE_APP: FirebaseApp | undefined;
  var __FIREBASE_AUTH: Auth | undefined;
  var __FIREBASE_FIRESTORE: Firestore | undefined;
}

export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    // 1. Initialisation de l'App
    if (!globalThis.__FIREBASE_APP) {
      globalThis.__FIREBASE_APP = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__FIREBASE_APP;

    // 2. Initialisation de l'Auth
    if (!globalThis.__FIREBASE_AUTH) {
      globalThis.__FIREBASE_AUTH = getAuth(app);
    }
    const auth = globalThis.__FIREBASE_AUTH;

    // 3. Initialisation de Firestore (CRITIQUE : Appelé une seule fois avec Long Polling)
    if (!globalThis.__FIREBASE_FIRESTORE) {
      try {
        globalThis.__FIREBASE_FIRESTORE = initializeFirestore(app, {
          experimentalForceLongPolling: true,
        });
      } catch (e) {
        // En cas d'erreur (déjà initialisé), on récupère l'instance
        globalThis.__FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__FIREBASE_FIRESTORE;

    return {
      firebaseApp: app,
      auth,
      firestore,
      messaging: null // Messaging initialisé séparément si besoin
    };
  }

  // Fallback pour SSR (Server Side Rendering)
  const ssrApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: ssrApp,
    auth: getAuth(ssrApp),
    firestore: getFirestore(ssrApp),
    messaging: null
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
