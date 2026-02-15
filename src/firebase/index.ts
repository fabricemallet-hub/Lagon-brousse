'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  Firestore, 
  getFirestore, 
  memoryLocalCache
} from 'firebase/firestore';

/**
 * @fileOverview Initialisation de Firebase Singleton.
 * Correction de l'erreur ASSERTION FAILED (ID: ca9).
 * Force le Long Polling et le cache en mémoire pour une stabilité totale sur mobile.
 */

export function initializeFirebase() {
  // 1. Initialisation de l'App (Singleton)
  const app = getApps().length === 0 
    ? initializeApp(firebaseConfig) 
    : getApp();

  // 2. Singleton Auth
  const auth = getAuth(app);

  // 3. Singleton Firestore avec configuration de transport ultra-stable
  let firestore: Firestore;
  
  // On vérifie si Firestore est déjà initialisé pour cette app
  // @ts-ignore - Accès interne pour vérifier l'existence de l'instance
  if (app.container.getProvider('firestore').isInitialized()) {
    firestore = getFirestore(app);
  } else {
    try {
      firestore = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true, // Crucial pour éviter les erreurs d'assertion sur mobile
      });
    } catch (e) {
      console.warn("Firestore already initialized, falling back to getFirestore()");
      firestore = getFirestore(app);
    }
  }

  return { firebaseApp: app, auth, firestore };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
