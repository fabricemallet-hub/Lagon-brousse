'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Force le statut admin pour les adresses de Fabrice afin de garantir la cohérence des accès.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase() || '';
  
  // Comptes Administrateur Système
  const adminEmails = ['f.mallet81@gmail.com', 'f.mallet81@outlook.com'];
  const isAdminUser = adminEmails.includes(email);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      // Mise à jour forcée si le statut admin n'est pas synchronisé
      if (isAdminUser && currentData.subscriptionStatus !== 'admin') {
          await setDoc(userDocRef, { 
            ...currentData, 
            subscriptionStatus: 'admin',
            email: email
          }, { merge: true });
      }
      return;
    }

    const effectiveDisplayName = displayName || user.displayName || email.split('@')[0] || 'Utilisateur';
    
    const newUserDocument: UserAccount = {
      id: user.uid,
      email: email,
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
    console.warn("Erreur synchronisation profil:", error);
  }
}