'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Gère la création et la mise à jour du document profil utilisateur dans Firestore.
 * Sécurité Master : Force le rôle admin pour les Emails de confiance absolue.
 */
export async function ensureUserDocument(firestore: Firestore, user: User, displayName?: string): Promise<void> {
  if (!user || !firestore) return;

  const userDocRef = doc(firestore, 'users', user.uid);
  const email = user.email?.toLowerCase() || '';
  
  // Identifiants de confiance absolue (Administrateurs)
  const masterAdminEmails = [
    'f.mallet81@outlook.com',
    'fabrice.mallet@gmail.com',
    'f.mallet81@gmail.com'
  ];
  
  const isMasterAdmin = email && masterAdminEmails.includes(email);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      
      // SYNCHRONISATION DE SÉCURITÉ FORCÉE POUR LES ADMINS PAR EMAIL
      if (isMasterAdmin && (currentData.subscriptionStatus !== 'admin' || currentData.role !== 'admin')) {
          await setDoc(userDocRef, { 
            ...currentData, 
            subscriptionStatus: 'admin',
            role: 'admin'
          }, { merge: true });
          console.log("L&B NC: Statut Administrateur restauré pour le compte master.");
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