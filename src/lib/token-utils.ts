'use client';

import { doc, getDoc, writeBatch, serverTimestamp, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { AccessToken } from '@/lib/types';
import { addMonths } from 'date-fns';

/**
 * Redeems an access token for a user.
 * @param firestore The Firestore instance.
 * @param user The authenticated user object.
 * @param accessToken The token string to redeem.
 * @returns A promise that resolves to an object with success status and a message.
 */
export async function redeemAccessToken(firestore: Firestore, user: User, accessToken: string): Promise<{success: boolean, message: string}> {
    if (!accessToken?.trim()) {
        return { success: false, message: 'Veuillez entrer un jeton valide.' };
    }
    
    const tokenRef = doc(firestore, 'access_tokens', accessToken.trim().toUpperCase());
    
    try {
      const tokenSnap = await getDoc(tokenRef);
      if (!tokenSnap.exists() || tokenSnap.data()?.status !== 'active') {
        throw new Error('Jeton invalide, expiré ou déjà utilisé.');
      }
      
      const tokenData = tokenSnap.data() as Omit<AccessToken, 'id'>;
      const userRef = doc(firestore, 'users', user.uid);

      const userDocSnap = await getDoc(userRef);
      if (!userDocSnap.exists()) {
           return { success: false, message: 'Compte utilisateur non trouvé. Veuillez patienter un instant et réessayer.' };
      }

      const now = new Date();
      const expiryDate = addMonths(now, tokenData.durationMonths);

      const batch = writeBatch(firestore);
      batch.update(userRef, {
        subscriptionStatus: 'active',
        subscriptionStartDate: now.toISOString(),
        subscriptionExpiryDate: expiryDate.toISOString(),
      });
      batch.update(tokenRef, {
        status: 'redeemed',
        redeemedBy: user.uid,
        redeemedAt: serverTimestamp(),
      });

      await batch.commit();

      return { success: true, message: `Votre abonnement est maintenant actif pour ${tokenData.durationMonths} mois.` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Impossible de valider le jeton.' };
    }
}
