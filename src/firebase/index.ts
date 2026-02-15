'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

/**
 * @fileOverview Initialisation de Firebase Singleton ultra-robuste.
 * Correction de l'erreur ca9 en utilisant un cache mémoire strict et un singleton global
 * pour éviter les conflits d'instances lors du rechargement à chaud (HMR).
 */

export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { firebaseApp: null, auth: null, firestore: null };
  }

  const win = window as any;

  // 1. Initialisation de l'App
  if (!win.__LBN_APP__) {
    win.__LBN_APP__ = getApps().length === 0 
      ? initializeApp(firebaseConfig) 
      : getApp();
  }
  const app = win.__LBN_APP__;

  // 2. Initialisation de l'Auth
  if (!win.__LBN_AUTH__) {
    win.__LBN_AUTH__ = getAuth(app);
  }
  const auth = win.__LBN_AUTH__;

  // 3. Initialisation de Firestore avec cache mémoire forcé
  if (!win.__LBN_FIRESTORE__) {
    try {
      // Forcer le cache mémoire AVANT toute autre opération
      win.__LBN_FIRESTORE__ = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } catch (e) {
      // Fallback si déjà initialisé
      win.__LBN_FIRESTORE__ = getFirestore(app);
    }
  }
  const firestore = win.__LBN_FIRESTORE__;

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
