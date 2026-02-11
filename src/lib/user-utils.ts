
'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Utilise désormais les UIDs pour la sécurité critique au lieu des emails en dur.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase() || '';
  const uid = user.uid;
  
  // UIDs des administrateurs maîtres (sécurité ultime)
  const masterAdminUids = [
    'K9cVYLVUk1NV99YV3anebkugpPp1',
    'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
    'Irglq69MasYdNwBmUu8yKvw6h4G2'
  ];
  
  const isMasterAdmin = masterAdminUids.includes(uid);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      
      // Si c'est un admin maître mais qu'il n'a pas le flag, on le met à jour une seule fois
      if (isMasterAdmin && currentData.subscriptionStatus !== 'admin') {
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
