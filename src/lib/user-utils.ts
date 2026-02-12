'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Utilise désormais les UIDs et les emails de confiance pour la sécurité.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase() || '';
  const uid = user.uid;
  
  // Identifiants de confiance pour l'administration (Fabrice Mallet inclus)
  const masterAdminUids = [
    'K9cVYLVUk1NV99YV3anebkugpPp1',
    'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
    'Irglq69MasYdNwBmUu8yKvw6h4G2',
    't8nPnZLcTiaLJSKMuLzib3C5nPn1'
  ];
  const masterAdminEmails = [
    'f.mallet81@outlook.com',
    'fabrice.mallet@gmail.com',
    'f.mallet81@gmail.com'
  ];
  
  const isMasterAdmin = masterAdminUids.includes(uid) || masterAdminEmails.includes(email);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      
      // Mise à jour automatique si l'utilisateur doit être admin mais ne l'est pas encore dans le profil
      if (isMasterAdmin && (currentData.subscriptionStatus !== 'admin' || currentData.role !== 'admin')) {
          await setDoc(userDocRef, { 
            ...currentData, 
            subscriptionStatus: 'admin',
            role: 'admin'
          }, { merge: true });
      }
      return;
    }

    // Création du nouveau profil
    const effectiveDisplayName = displayName || user.displayName || email.split('@')[0] || 'Utilisateur';
    
    const newUserDocument: UserAccount = {
      id: user.uid,
      email: email,
      displayName: effectiveDisplayName,
      role: isMasterAdmin ? 'admin' : 'client',
      subscriptionStatus: isMasterAdmin ? 'admin' : 'trial',
      lastSelectedLocation: 'Nouméa',
    };

    if (!isMasterAdmin) {
      const trialStartDate = new Date();
      newUserDocument.subscriptionStartDate = trialStartDate.toISOString();
      newUserDocument.subscriptionExpiryDate = addMonths(trialStartDate, 3).toISOString();
    }
    
    await setDoc(userDocRef, newUserDocument);
  } catch (error) {
    console.warn("Erreur synchronisation profil:", error);
  }
}