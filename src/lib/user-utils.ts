
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
    // Si l'utilisateur existe déjà mais qu'il s'agit d'un admin par e-mail,
    // on s'assure que son document reflète son statut admin s'il ne l'est pas encore.
    const currentData = docSnap.data() as UserAccount;
    const isAdminEmail = user.email === 'f.mallet81@outlook.com' || user.email === 'f.mallet81@gmail.com';
    
    if (isAdminEmail && currentData.subscriptionStatus !== 'admin') {
        await setDoc(userDocRef, { ...currentData, subscriptionStatus: 'admin' }, { merge: true });
    }
    return;
  }

  const { uid, email } = user;
  const effectiveDisplayName = displayName || user.displayName || email?.split('@')[0] || 'Utilisateur';
  
  // Reconnaissance des deux comptes administrateurs
  const isAdminUser = email === 'f.mallet81@outlook.com' || email === 'f.mallet81@gmail.com';
  
  let newUserDocument: UserAccount;

  if (isAdminUser) {
    newUserDocument = {
      id: uid,
      email: email || '',
      displayName: effectiveDisplayName || 'Admin',
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
