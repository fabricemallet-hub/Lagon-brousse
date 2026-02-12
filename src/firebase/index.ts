
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

// Singleton pour les services
let initializedServices: any = null;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (initializedServices) return initializedServices;

  let firebaseApp: FirebaseApp;
  
  if (!getApps().length) {
    try {
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      console.warn('Firebase init fallback:', e);
      firebaseApp = initializeApp(firebaseConfig);
    }
  } else {
    firebaseApp = getApp();
  }

  initializedServices = getSdks(firebaseApp);
  return initializedServices;
}

export function getSdks(firebaseApp: FirebaseApp) {
  // CRITICAL: experimentalForceLongPolling: true solves "Unexpected state ID: ca9" in workstations
  // by using HTTP polling instead of WebSockets which often fail behind proxies.
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch (e) {
    console.warn("Firestore secondary init:", e);
    firestore = getFirestore(firebaseApp);
  }

  let messaging = null;
  if (typeof window !== 'undefined') {
    try {
      messaging = getMessaging(firebaseApp);
    } catch (e) {
      console.warn("Messaging not supported in this browser environment");
    }
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
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
