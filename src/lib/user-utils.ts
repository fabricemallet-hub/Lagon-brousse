
'use client';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserAccount } from '@/lib/types';
import { addMonths } from 'date-fns';
import { locationsByRegion } from './locations';

/**
 * Synchronisation du profil utilisateur.
 * Sécurité Master : Force les droits administrateurs pour les comptes de confiance.
 * Garantit également les champs d'opt-in par défaut pour les calculs d'audience.
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
  
  // COMPTES ADMIN AUTORISÉS (Consolidés avec les règles de sécurité)
  const masterUids = [
    't8nPnZLcTiaLJSKMuLzib3C5nPn1', 
    'D1q2GPM95rZi38cvCzvsjcWQDaV2', 
    'koKj5ObSGXYeO1PLKU5bgo8Yaky1'
  ];
  const masterEmails = [
    'f.mallet81@outlook.com', 
    'f.mallet81@gmail.com', 
    'fabrice.mallet@gmail.com',
    'kledostyle@hotmail.com',
    'kledostyle@outlook.com'
  ];
  
  const isMasterAdmin = masterUids.includes(user.uid) || masterEmails.includes(email);

  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const currentData = docSnap.data() as UserAccount;
      const updates: any = {};
      
      // 1. Verification de l'intégrité de l'ID interne
      if (!currentData.id || currentData.id !== user.uid) {
          updates.id = user.uid;
      }

      // 2. Restauration automatique du rôle Master
      if (isMasterAdmin && (currentData.role !== 'admin' || currentData.subscriptionStatus !== 'admin')) {
          updates.role = 'admin';
          updates.subscriptionStatus = 'admin';
      }

      // 3. Initialisation des champs d'audience si manquants
      if (currentData.allowsPromoPush === undefined) updates.allowsPromoPush = true;
      if (currentData.allowsPromoEmails === undefined) updates.allowsPromoEmails = true;
      if (currentData.allowsPromoSMS === undefined) updates.allowsPromoSMS = true;
      if (!currentData.subscribedCategories || currentData.subscribedCategories.length === 0) {
          updates.subscribedCategories = ['Pêche', 'Chasse', 'Jardinage'];
      }

      // 4. Backfill de la région si manquante
      if (!currentData.selectedRegion) {
          const currentLoc = currentData.lastSelectedLocation || 'Nouméa';
          const isTahiti = Object.keys(locationsByRegion['TAHITI']).includes(currentLoc);
          updates.selectedRegion = isTahiti ? 'TAHITI' : 'CALEDONIE';
      }

      if (Object.keys(updates).length > 0) {
          await setDoc(userDocRef, updates, { merge: true });
      }
      return;
    }

    // Création d'un nouveau profil
    const effectiveDisplayName = displayName || user.displayName || email.split('@')[0] || 'Utilisateur';
    const initialLocation = commune || 'Nouméa';
    const isTahiti = Object.keys(locationsByRegion['TAHITI']).includes(initialLocation);

    const newUser: UserAccount = {
      id: user.uid,
      email: email,
      displayName: effectiveDisplayName,
      role: isMasterAdmin ? 'admin' : 'client',
      subscriptionStatus: isMasterAdmin ? 'admin' : 'trial',
      lastSelectedLocation: initialLocation,
      selectedRegion: isTahiti ? 'TAHITI' : 'CALEDONIE',
      subscribedCategories: ['Pêche', 'Chasse', 'Jardinage'],
      allowsPromoEmails: true,
      allowsPromoPush: true,
      allowsPromoSMS: true,
    };

    if (!isMasterAdmin) {
      newUser.subscriptionStartDate = new Date().toISOString();
      newUser.subscriptionExpiryDate = addMonths(new Date(), 3).toISOString();
    }
    
    await setDoc(userDocRef, newUser);
  } catch (error) {
    console.error("L&B Master Sync Error:", error);
  }
}
