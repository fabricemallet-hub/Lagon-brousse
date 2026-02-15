'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

/**
 * @fileOverview Initialisation de Firebase Singleton ultra-robuste.
 * Correction définitive de l'erreur ASSERTION FAILED (ID: ca9) en forçant le cache mémoire
 * et en utilisant un stockage global pour éviter les doubles initialisations lors du HMR.
 */

export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { firebaseApp: null, auth: null, firestore: null };
  }

  const global = window as any;

  // 1. Initialisation de l'App (Singleton)
  if (!global.__LBN_APP__) {
    global.__LBN_APP__ = getApps().length === 0 
      ? initializeApp(firebaseConfig) 
      : getApp();
  }
  const app = global.__LBN_APP__;

  // 2. Initialisation de l'Auth (Singleton)
  if (!global.__LBN_AUTH__) {
    global.__LBN_AUTH__ = getAuth(app);
  }
  const auth = global.__LBN_AUTH__;

  // 3. Initialisation de Firestore (Singleton avec cache mémoire forcé)
  // L'erreur ca9 est causée par des conflits IndexedDB. Forcer memoryLocalCache() règle le problème.
  if (!global.__LBN_FIRESTORE__) {
    try {
      // CRITICAL: We MUST try to initialize with memory cache BEFORE calling getFirestore()
      // because getFirestore() triggers a default initialization that blocks subsequent 
      // initializeFirestore() calls with different settings.
      global.__LBN_FIRESTORE__ = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } catch (e) {
      // Fallback: If already initialized (by another module or HMR), just get the existing instance.
      global.__LBN_FIRESTORE__ = getFirestore(app);
    }
  }
  const firestore = global.__LBN_FIRESTORE__;

  return { 
    firebaseApp: app, 
    auth, 
    firestore 
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
