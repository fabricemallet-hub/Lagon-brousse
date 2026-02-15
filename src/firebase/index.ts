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
 * @fileOverview Initialisation de Firebase Singleton.
 * Correction définitive de l'erreur ASSERTION FAILED (ID: ca9).
 * Utilise des variables globales au module pour garantir une instance unique.
 */

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

export function initializeFirebase() {
  if (typeof window === 'undefined') return {} as any;

  // 1. Singleton App
  if (!firebaseApp) {
    firebaseApp = getApps().length === 0 
      ? initializeApp(firebaseConfig) 
      : getApp();
  }

  // 2. Singleton Auth
  if (!auth) {
    auth = getAuth(firebaseApp);
  }

  // 3. Singleton Firestore avec transport stable
  if (!firestore) {
    try {
      firestore = initializeFirestore(firebaseApp, {
        localCache: memoryLocalCache(),
        // On n'utilise plus experimentalForceLongPolling car il peut entrer en conflit 
        // avec les réglages par défaut lors des re-init.
      });
    } catch (e) {
      console.warn("Firestore already initialized, falling back to getFirestore()");
      firestore = getFirestore(firebaseApp);
    }
  }

  return { firebaseApp, auth, firestore };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
