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
 * @fileOverview Initialisation CRITIQUE de Firebase.
 * Utilisation de Memory Cache pour éliminer l'erreur d'assertion ca9.
 * Forçage du mode singleton strict via globalThis.
 */

declare global {
  var __LB_FIREBASE_APP: FirebaseApp | undefined;
  var __LB_FIREBASE_AUTH: Auth | undefined;
  var __LB_FIREBASE_FIRESTORE: Firestore | undefined;
}

export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    // 1. Singleton App
    if (!globalThis.__LB_FIREBASE_APP) {
      globalThis.__LB_FIREBASE_APP = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__LB_FIREBASE_APP;

    // 2. Singleton Auth
    if (!globalThis.__LB_FIREBASE_AUTH) {
      globalThis.__LB_FIREBASE_AUTH = getAuth(app);
    }
    const auth = globalThis.__LB_FIREBASE_AUTH;

    // 3. Singleton Firestore (FORCÉ MEMOIRE POUR CA9)
    if (!globalThis.__LB_FIREBASE_FIRESTORE) {
      try {
        // On initialise Firestore UNE SEULE FOIS avec le cache en mémoire
        // Cela évite les conflits de verrouillage de base de données (erreur ca9)
        globalThis.__LB_FIREBASE_FIRESTORE = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
        console.log("L&B NC: Firestore verrouillé en mode Singleton Mémoire.");
      } catch (e) {
        // Fallback si déjà initialisé par ailleurs
        globalThis.__LB_FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__LB_FIREBASE_FIRESTORE;

    return { firebaseApp: app, auth, firestore };
  }

  // Fallback Serveur (SSR)
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