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
 * Mode Long Polling forcé pour la stabilité dans l'environnement Cloud.
 * Utilisation de la version 11.10.0 pour corriger les erreurs d'assertion interne.
 */

export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    // 1. Singleton App
    const app = getApps().length === 0 
      ? initializeApp(firebaseConfig) 
      : getApp();

    // 2. Singleton Auth
    const auth = getAuth(app);

    // 3. Singleton Firestore (STABLE TRANSPORT)
    let firestore: Firestore;
    try {
      // On tente une initialisation avec configuration spécifique
      firestore = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true 
      });
    } catch (e) {
      // Si déjà initialisé (HMR), on récupère l'instance existante
      firestore = getFirestore(app);
    }

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