
'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Assure que les administrateurs sont correctement identifiés par leur e-mail.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  const userDocRef = doc(firestore, 'users', user.uid);
  
  const docSnap = await getDoc(userDocRef);
  
  // Reconnaissance des comptes administrateurs par e-mail
  const email = user.email?.toLowerCase();
  const isAdminUser = email === 'f.mallet81@outlook.com' || email === 'f.mallet81@gmail.com';

  if (docSnap.exists()) {
    const currentData = docSnap.data() as UserAccount;
    // Mise à jour forcée du statut admin si nécessaire pour Gmail ou Outlook
    if (isAdminUser && currentData.subscriptionStatus !== 'admin') {
        await setDoc(userDocRef, { ...currentData, subscriptionStatus: 'admin' }, { merge: true });
    }
    return;
  }

  const { uid } = user;
  const effectiveDisplayName = displayName || user.displayName || email?.split('@')[0] || 'Utilisateur';
  
  let newUserDocument: UserAccount;

  if (isAdminUser) {
    newUserDocument = {
      id: uid,
      email: user.email || '',
      displayName: effectiveDisplayName,
      subscriptionStatus: 'admin',
      lastSelectedLocation: 'Nouméa',
    };
  } else {
    // Période d'essai gratuite de 3 mois pour les nouveaux utilisateurs
    const trialStartDate = new Date();
    const trialExpiryDate = addMonths(trialStartDate, 3);
    
    newUserDocument = {
      id: uid,
      email: user.email || '',
      displayName: effectiveDisplayName,
      subscriptionStatus: 'trial',
      subscriptionStartDate: trialStartDate.toISOString(),
      subscriptionExpiryDate: trialExpiryDate.toISOString(),
      lastSelectedLocation: 'Nouméa',
    };
  }
  
  await setDoc(userDocRef, newUserDocument);
}
