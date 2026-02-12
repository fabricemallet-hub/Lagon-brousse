'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, Firestore, getFirestore, memoryLocalCache } from 'firebase/firestore';

/**
 * @fileOverview Initialisation SINGLETON de Firebase.
 * Empêche les erreurs d'assertion interne (ca9) en forçant Memory Cache et Long Polling.
 */

declare global {
  var __LB_FIREBASE_APP: FirebaseApp | undefined;
  var __LB_FIREBASE_AUTH: Auth | undefined;
  var __LB_FIREBASE_FIRESTORE: Firestore | undefined;
}

export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    // 1. Initialisation App
    if (!globalThis.__LB_FIREBASE_APP) {
      const apps = getApps();
      globalThis.__LB_FIREBASE_APP = apps.length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
    }
    const app = globalThis.__LB_FIREBASE_APP;

    // 2. Initialisation Auth
    if (!globalThis.__LB_FIREBASE_AUTH) {
      globalThis.__LB_FIREBASE_AUTH = getAuth(app);
      
      // Diagnostic pour l'utilisateur
      onAuthStateChanged(globalThis.__LB_FIREBASE_AUTH, (u) => {
        if (u) console.log(`L&B NC: Utilisateur connecté - UID: ${u.uid}`);
        else console.log("L&B NC: Aucun utilisateur connecté");
      });
    }
    const auth = globalThis.__LB_FIREBASE_AUTH;

    // 3. Initialisation Firestore (Mode Stable Forcé)
    if (!globalThis.__LB_FIREBASE_FIRESTORE) {
      try {
        globalThis.__LB_FIREBASE_FIRESTORE = initializeFirestore(app, {
          experimentalForceLongPolling: true, 
          localCache: memoryLocalCache(),     
        });
        console.log("L&B NC: Firestore initialisé (Mode Immuable : Long Polling + Memory)");
      } catch (e) {
        globalThis.__LB_FIREBASE_FIRESTORE = getFirestore(app);
      }
    }
    const firestore = globalThis.__LB_FIREBASE_FIRESTORE;

    return { firebaseApp: app, auth, firestore };
  }

  // Fallback SSR
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