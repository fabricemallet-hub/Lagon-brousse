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
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase();
  
  // Forçage du statut admin pour vos deux comptes
  const isAdminUser = email === 'f.mallet81@outlook.com' || email === 'f.mallet81@gmail.com';

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      // Mise à jour forcée du statut admin pour synchroniser avec les règles
      if (isAdminUser && currentData.subscriptionStatus !== 'admin') {
          await setDoc(userDocRef, { 
            ...currentData, 
            subscriptionStatus: 'admin',
            email: email
          }, { merge: true });
      }
      return;
    }

    const effectiveDisplayName = displayName || user.displayName || email?.split('@')[0] || 'Utilisateur';
    
    const newUserDocument: UserAccount = {
      id: user.uid,
      email: email || '',
      displayName: effectiveDisplayName,
      subscriptionStatus: isAdminUser ? 'admin' : 'trial',
      lastSelectedLocation: 'Nouméa',
    };

    if (!isAdminUser) {
      const trialStartDate = new Date();
      newUserDocument.subscriptionStartDate = trialStartDate.toISOString();
      newUserDocument.subscriptionExpiryDate = addMonths(trialStartDate, 3).toISOString();
    }
    
    await setDoc(userDocRef, newUserDocument);
  } catch (error) {
    console.warn("Erreur lors de la création/mise à jour du document utilisateur:", error);
  }
}