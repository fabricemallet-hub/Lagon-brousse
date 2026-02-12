'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore, terminate } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';

/**
 * @fileOverview Point d'entrée central pour Firebase.
 * Gère l'initialisation unique et forcée pour la stabilité Firestore (Long Polling).
 */

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let messaging: Messaging | null = null;

/**
 * Initialise Firebase et ses services avec les paramètres de stabilité maximaux.
 * Forcer experimentalForceLongPolling résout l'erreur d'assertion interne (ID: ca9).
 */
export function initializeFirebase() {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }

  if (!auth) {
    auth = getAuth(app);
  }

  if (!firestore) {
    try {
      // Tenter une initialisation propre avec les paramètres de transport stables
      firestore = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // En cas d'erreur (déjà initialisé par un autre module), on tente de récupérer l'instance
      console.warn("Firestore déjà initialisé, récupération de l'instance existante.");
      // Note: getFirestore ne permet pas de changer les paramètres après initialisation.
      // Mais dans cet environnement, initializeFirestore devrait être le premier appel.
      const { getFirestore } = require('firebase/firestore');
      firestore = getFirestore(app);
    }
  }

  if (typeof window !== 'undefined' && !messaging) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      // FCM non supporté
    }
  }

  return {
    firebaseApp: app,
    auth,
    firestore,
    messaging
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