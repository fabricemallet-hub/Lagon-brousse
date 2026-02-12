'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Sécurité Master : Force le rôle admin pour les UIDs et Emails de confiance.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase() || '';
  const uid = user.uid;
  
  // Identifiants de confiance absolue (Administrateurs)
  const masterAdminUids = [
    't8nPnZLcTiaLJSKMuLzib3C5nPn1',
    'K9cVYLVUk1NV99YV3anebkugpPp1',
    'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
    'Irglq69MasYdNwBmUu8yKvw6h4G2'
  ];

  const masterAdminEmails = [
    'f.mallet81@outlook.com',
    'fabrice.mallet@gmail.com',
    'f.mallet81@gmail.com'
  ];
  
  const isMasterAdmin = masterAdminUids.includes(uid) || (email && masterAdminEmails.includes(email));

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      
      // SYNCHRONISATION DE SÉCURITÉ FORCÉE POUR LES ADMINS
      // Si l'UID ou l'Email est dans la liste blanche, on écrase les champs de statut
      if (isMasterAdmin && (currentData.subscriptionStatus !== 'admin' || currentData.role !== 'admin')) {
          await setDoc(userDocRef, { 
            ...currentData, 
            subscriptionStatus: 'admin',
            role: 'admin'
          }, { merge: true });
          console.log("L&B NC: Statut Administrateur Maître restauré et synchronisé.");
      }
      return;
    }

    // Création d'un nouveau profil
    const effectiveDisplayName = displayName || user.displayName || email.split('@')[0] || 'Utilisateur';
    
    const newUserDocument: UserAccount = {
      id: user.uid,
      email: email,
      displayName: effectiveDisplayName,
      role: isMasterAdmin ? 'admin' : 'client',
      subscriptionStatus: isMasterAdmin ? 'admin' : 'trial',
      lastSelectedLocation: 'Nouméa',
    };

    // Période d'essai pour les clients (3 mois)
    if (!isMasterAdmin) {
      const trialStartDate = new Date();
      newUserDocument.subscriptionStartDate = trialStartDate.toISOString();
      newUserDocument.subscriptionExpiryDate = addMonths(trialStartDate, 3).toISOString();
    }
    
    await setDoc(userDocRef, newUserDocument);
    console.log("L&B NC: Nouveau profil utilisateur créé.");
  } catch (error) {
    console.warn("L&B NC: Erreur synchronisation profil:", error);
  }
}