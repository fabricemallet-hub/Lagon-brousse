'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

/**
 * @fileOverview Initialisation de Firebase Singleton robuste.
 * Correction de l'erreur ASSERTION FAILED (ID: ca9) par stockage global sécurisé.
 */

export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { firebaseApp: null as any, auth: null as any, firestore: null as any };
  }

  // Utilisation d'un namespace global pour persister les instances entre les rechargements (Fast Refresh)
  const global = window as any;

  if (!global.__LBN_FIREBASE_APP__) {
    global.__LBN_FIREBASE_APP__ = getApps().length === 0 
      ? initializeApp(firebaseConfig) 
      : getApp();
  }

  if (!global.__LBN_FIREBASE_AUTH__) {
    global.__LBN_FIREBASE_AUTH__ = getAuth(global.__LBN_FIREBASE_APP__);
  }

  if (!global.__LBN_FIREBASE_FIRESTORE__) {
    global.__LBN_FIREBASE_FIRESTORE__ = getFirestore(global.__LBN_FIREBASE_APP__);
  }

  return { 
    firebaseApp: global.__LBN_FIREBASE_APP__, 
    auth: global.__LBN_FIREBASE_AUTH__, 
    firestore: global.__LBN_FIREBASE_FIRESTORE__ 
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
