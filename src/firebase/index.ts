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
 * @fileOverview Initialisation SINGLETON de Firebase.
 * Forçage Memory Cache + Long Polling pour éliminer les erreurs d'assertion interne (ID: ca9).
 * Utilisation de globalThis pour garantir l'immuabilité de l'instance.
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
      const apps = getApps();
      globalThis.__LB_FIREBASE_APP = apps.length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__LB_FIREBASE_APP;

    // 2. Singleton Auth
    if (!globalThis.__LB_FIREBASE_AUTH) {
      globalThis.__LB_FIREBASE_AUTH = getAuth(app);
    }
    const auth = globalThis.__LB_FIREBASE_AUTH;

    // 3. Singleton Firestore (FORÇAGE STABILITÉ ABSOLU)
    if (!globalThis.__LB_FIREBASE_FIRESTORE) {
      try {
        globalThis.__LB_FIREBASE_FIRESTORE = initializeFirestore(app, {
          experimentalForceLongPolling: true, // Évite les crashs WebChannel dans Cloud Workstations
          localCache: memoryLocalCache(), // Désactive IndexedDB pour éviter le conflit ID: ca9
        });
        console.log("L&B NC: Firestore initialisé (Mode Singleton Immuable)");
      } catch (e) {
        // En cas d'erreur (déjà initialisé par ailleurs), on récupère l'instance existante
        globalThis.__LB_FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__LB_FIREBASE_FIRESTORE;

    return { firebaseApp: app, auth, firestore };
  }

  // SSR Fallback
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