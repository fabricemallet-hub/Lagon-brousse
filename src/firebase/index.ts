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
 * @fileOverview Initialisation de Firebase Hardened.
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
      console.log("L&B DEBUG: Initialisation Firebase App...");
      globalThis.__LB_FIREBASE_APP = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__LB_FIREBASE_APP;

    // 2. Singleton Auth
    if (!globalThis.__LB_FIREBASE_AUTH) {
      console.log("L&B DEBUG: Initialisation Firebase Auth...");
      globalThis.__LB_FIREBASE_AUTH = getAuth(app);
    }
    const auth = globalThis.__LB_FIREBASE_AUTH;

    // 3. Singleton Firestore (STRICT MEMORY POUR ÉVITER CA9)
    if (!globalThis.__LB_FIREBASE_FIRESTORE) {
      try {
        console.log("L&B DEBUG: Configuration Firestore (Memory Cache Only)...");
        globalThis.__LB_FIREBASE_FIRESTORE = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
      } catch (e) {
        console.warn("L&B DEBUG: Firestore déjà initialisé ou mode restreint, récupération de l'instance par défaut.");
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
export * from './errors';
export * from './error-emitter';