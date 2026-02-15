
'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Sécurité Master : Force le rôle admin pour les Emails de confiance absolue.
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
  
  // Identifiants de confiance absolue (Administrateurs)
  const masterEmails = [
    'f.mallet81@outlook.com', 
    'fabrice.mallet@gmail.com', 
    'f.mallet81@gmail.com',
    'kledostyle@outlook.com'
  ];
  const masterUids = [
    't8nPnZLcTiaLJSKMuLzib3C5nPn1', 
    'koKj5ObSGXYeO1PLKU5bgo8Yaky1',
    'D1q2GPM95rZi38cvCzvsjcWQDaV2',
    'K9cVYLVUk1NV99YV3anebkugpPp1',
    'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
    'Irglq69MasYdNwBmUu8yKvw6h4G2'
  ];
  
  const isMasterAdmin = (email && masterEmails.includes(email)) || 
                        masterUids.includes(user.uid);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      
      // SYNCHRONISATION DE SÉCURITÉ FORCÉE POUR LES ADMINS
      if (isMasterAdmin && (currentData.role !== 'admin')) {
          console.log(`L&B DEBUG SYNC: Restauration Admin pour [${email || user.uid}]...`);
          setDoc(userDocRef, { 
            ...currentData, 
            role: 'admin',
            id: user.uid,
            email: email || currentData.email
          }, { merge: true });
      }
      return;
    }

    // Création d'un nouveau profil
    console.log(`L&B DEBUG SYNC: Création nouveau profil pour [${email}]...`);
    const effectiveDisplayName = displayName || user.displayName || email.split('@')[0] || 'Utilisateur';
    
    const newUserDocument: UserAccount = {
      id: user.uid,
      email: email,
      displayName: effectiveDisplayName,
      role: isMasterAdmin ? 'admin' : 'client',
      subscriptionStatus: isMasterAdmin ? 'admin' : 'trial',
      lastSelectedLocation: commune || 'Nouméa',
    };

    // Période d'essai pour les clients (3 mois)
    if (!isMasterAdmin) {
      const trialStartDate = new Date();
      newUserDocument.subscriptionStartDate = trialStartDate.toISOString();
      newUserDocument.subscriptionExpiryDate = addMonths(trialStartDate, 3).toISOString();
    }
    
    setDoc(userDocRef, newUserDocument);
  } catch (error) {
    console.error("L&B DEBUG SYNC ERROR:", error);
  }
}
