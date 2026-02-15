
'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Synchronisation du profil utilisateur.
 * Sécurité Master : Force les droits administrateurs pour les comptes de confiance.
 */
export async function ensureUserDocument(
  firestore: Firestore, 
  user: User, 
  displayName?: string,
  commune?: string
): Promise<void> {
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase() || '';
  
  const masterEmails = [
    'f.mallet81@outlook.com', 
    'fabrice.mallet@gmail.com', 
    'f.mallet81@gmail.com'
  ];
  const masterUids = [
    't8nPnZLcTiaLJSKMuLzib3C5nPn1', 
    'koKj5ObSGXYeO1PLKU5bgo8Yaky1',
    'D1q2GPM95rZi38cvCzvsjcWQDaV2',
    'K9cVYLVUk1NV99YV3anebkugpPp1',
    'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
    'Irglq69MasYdNwBmUu8yKvw6h4G2'
  ];
  
  const isMasterAdmin = (email && masterEmails.includes(email)) || masterUids.includes(user.uid);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      // Restauration automatique si le rôle Master a sauté
      if (isMasterAdmin && currentData.role !== 'admin') {
          console.log(`L&B Master Sync: Restauration des droits pour [${email}]...`);
          setDoc(userDocRef, { 
            ...currentData, 
            role: 'admin', 
            subscriptionStatus: 'admin' 
          }, { merge: true });
      }
      return;
    }

    // Création d'un nouveau profil
    const effectiveDisplayName = displayName || user.displayName || email.split('@')[0] || 'Utilisateur';
    const newUser: UserAccount = {
      id: user.uid,
      email: email,
      displayName: effectiveDisplayName,
      role: isMasterAdmin ? 'admin' : 'client',
      subscriptionStatus: isMasterAdmin ? 'admin' : 'trial',
      lastSelectedLocation: commune || 'Nouméa',
    };

    if (!isMasterAdmin) {
      newUser.subscriptionStartDate = new Date().toISOString();
      newUser.subscriptionExpiryDate = addMonths(new Date(), 3).toISOString();
    }
    
    setDoc(userDocRef, newUser);
  } catch (error) {
    console.error("L&B Master Sync Error:", error);
  }
}
