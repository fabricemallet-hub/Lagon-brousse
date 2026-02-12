'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore, getFirestore, terminate } from 'firebase/firestore';

/**
 * @fileOverview Point d'entrée central pour Firebase.
 * Utilise un singleton global robuste avec Long Polling forcé.
 */

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

    // 3. Initialisation de Firestore (Pattern Singleton Immuable)
    if (!globalThis.__FIREBASE_FIRESTORE) {
      try {
        // On force le Long Polling dès la première création
        globalThis.__FIREBASE_FIRESTORE = initializeFirestore(app, {
          experimentalForceLongPolling: true,
        });
        console.log("L&B NC: Firestore initialisé (Long Polling)");
      } catch (e) {
        // En cas de conflit (HMR), on récupère l'instance existante
        globalThis.__FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__FIREBASE_FIRESTORE;

    return {
      firebaseApp: app,
      auth,
      firestore,
      messaging: null
    };
  }

  // Fallback pour SSR
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