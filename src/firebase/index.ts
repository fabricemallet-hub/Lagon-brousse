'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  Firestore, 
  getFirestore, 
  memoryLocalCache
} from 'firebase/firestore';

/**
 * @fileOverview Initialisation SINGLETON de Firebase pour L&B NC.
 * Verrouillage absolu sur globalThis pour garantir la stabilité du Dashboard Admin.
 */

declare global {
  var __LB_FIREBASE_APP: FirebaseApp | undefined;
  var __LB_FIREBASE_AUTH: Auth | undefined;
  var __LB_FIREBASE_FIRESTORE: Firestore | undefined;
}

export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    // 1. Initialisation App (Unique)
    if (!globalThis.__LB_FIREBASE_APP) {
      const apps = getApps();
      globalThis.__LB_FIREBASE_APP = apps.length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__LB_FIREBASE_APP;

    // 2. Initialisation Auth (Unique)
    if (!globalThis.__LB_FIREBASE_AUTH) {
      globalThis.__LB_FIREBASE_AUTH = getAuth(app);
    }
    const auth = globalThis.__LB_FIREBASE_AUTH;

    // 3. Initialisation Firestore (MODE STABILITÉ ABSOLUE)
    // On verrouille le mode Long Polling et le Memory Cache pour éliminer l'erreur ca9
    if (!globalThis.__LB_FIREBASE_FIRESTORE) {
      try {
        globalThis.__LB_FIREBASE_FIRESTORE = initializeFirestore(app, {
          experimentalForceLongPolling: true,
          localCache: memoryLocalCache(),
        });
        console.log("L&B NC: Firestore Singleton Master prêt.");
      } catch (e) {
        globalThis.__LB_FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__LB_FIREBASE_FIRESTORE;

    return { firebaseApp: app, auth, firestore };
  }

  // Fallback SSR
  const ssrApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
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
