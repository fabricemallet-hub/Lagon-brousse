'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Creates a user document in Firestore if it doesn't already exist.
 * This function encapsulates the logic for creating a new user profile,
 * including assigning admin status or a trial period.
 * @param firestore The Firestore instance.
 * @param user The Firebase Auth user object.
 * @param displayName Optional display name to set for the new user.
 * @returns A promise that resolves when the operation is complete.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  const userDocRef = doc(firestore, 'users', user.uid);
  
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return;
  }

  const { uid, email } = user;
  const effectiveDisplayName = displayName || user.displayName || email?.split('@')[0] || 'Utilisateur';
  const isAdminUser = email === 'f.mallet81@outlook.com';
  
  let newUserDocument: UserAccount;

  if (isAdminUser) {
    newUserDocument = {
      id: uid,
      email: email || '',
      displayName: 'Admin',
      subscriptionStatus: 'admin',
      favoriteLocationIds: [],
      lastSelectedLocation: 'Nouméa',
    };
  } else {
    const trialStartDate = new Date();
    const trialExpiryDate = addMonths(trialStartDate, 3);
    
    newUserDocument = {
      id: uid,
      email: email || '',
      displayName: effectiveDisplayName,
      subscriptionStatus: 'trial',
      subscriptionStartDate: trialStartDate.toISOString(),
      subscriptionExpiryDate: trialExpiryDate.toISOString(),
      favoriteLocationIds: [],
      lastSelectedLocation: 'Nouméa',
    };
  }
  
  await setDoc(userDocRef, newUserDocument);
}
