'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore, getFirestore, memoryLocalCache } from 'firebase/firestore';

/**
 * @fileOverview Initialisation blindée de Firebase.
 * Utilise un singleton immuable pour éviter les erreurs d'assertion interne (ID: ca9).
 */

declare global {
  var __FIREBASE_APP: FirebaseApp | undefined;
  var __FIREBASE_AUTH: Auth | undefined;
  var __FIREBASE_FIRESTORE: Firestore | undefined;
}

export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    // 1. App Singleton
    if (!globalThis.__FIREBASE_APP) {
      const apps = getApps();
      globalThis.__FIREBASE_APP = apps.length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__FIREBASE_APP;

    // 2. Auth Singleton
    if (!globalThis.__FIREBASE_AUTH) {
      globalThis.__FIREBASE_AUTH = getAuth(app);
    }
    const auth = globalThis.__FIREBASE_AUTH;

    // 3. Firestore Singleton (Memory Cache + Long Polling)
    if (!globalThis.__FIREBASE_FIRESTORE) {
      try {
        // Initialisation forcée avec les paramètres de stabilité
        globalThis.__FIREBASE_FIRESTORE = initializeFirestore(app, {
          experimentalForceLongPolling: true,
          localCache: memoryLocalCache(),
        });
        console.log("L&B NC: Firestore initialisé (Stable: Long Polling + Memory Cache)");
      } catch (e) {
        // En cas de tentative de ré-initialisation, on récupère l'existant
        globalThis.__FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__FIREBASE_FIRESTORE;

    return {
      firebaseApp: app,
      auth,
      firestore,
    };
  }

  // Fallback pour SSR (Server-Side Rendering)
  const ssrApps = getApps();
  const ssrApp = ssrApps.length === 0 ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: ssrApp,
    auth: getAuth(ssrApp),
    firestore: getFirestore(ssrApp),
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