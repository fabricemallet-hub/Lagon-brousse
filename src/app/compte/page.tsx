'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { UserAccount, AccessToken, SharedAccessToken } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isBefore, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Crown, Star, XCircle, KeyRound, Ticket, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ComptePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const sharedTokenRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'shared_access_tokens', 'GLOBAL');
  }, [firestore, user]);
  const { data: sharedToken, isLoading: isSharedTokenLoading } = useDoc<SharedAccessToken>(sharedTokenRef);

  const isSharedAccessActive = sharedToken && sharedToken.expiresAt && isBefore(new Date(), sharedToken.expiresAt.toDate());

  const handleSubscribe = () => {
    const paypalLink = process.env.NEXT_PUBLIC_PAYPAL_LINK;
    if (paypalLink && paypalLink !== 'https://www.paypal.com/paypalme/YOUR_PAYPAL_ID_HERE') {
      toast({
        title: 'Redirection vers PayPal',
        description: "Un nouvel onglet va s'ouvrir pour finaliser votre abonnement.",
      });
      window.open(paypalLink, '_blank');
    } else {
      toast({
        variant: "destructive",
        title: "Configuration requise",
        description: "Le lien de paiement PayPal n'a pas été configuré par l'administrateur.",
      });
    }
  };

  const handleRedeemToken = async () => {
    if (!firestore || !user || !accessToken) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez entrer un jeton valide.' });
      return;
    }
    setIsRedeeming(true);
    const tokenRef = doc(firestore, 'access_tokens', accessToken.trim());
    
    try {
      const tokenSnap = await getDoc(tokenRef);
      if (!tokenSnap.exists() || tokenSnap.data()?.status !== 'active') {
        throw new Error('Jeton invalide, expiré ou déjà utilisé.');
      }
      
      const tokenData = tokenSnap.data() as AccessToken;
      const userRef = doc(firestore, 'users', user.uid);

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

      toast({
        title: 'Accès activé !',
        description: `Votre abonnement est maintenant actif pour ${tokenData.durationMonths} mois.`,
      });
      setAccessToken('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de valider le jeton.',
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleCancel = async () => {
    if (!userDocRef || !firestore) return;
     try {
      const batch = writeBatch(firestore);
      batch.update(userDocRef, { subscriptionStatus: 'inactive' });
      await batch.commit();
      toast({ title: "Abonnement résilié", description: "Votre accès est maintenant limité. Vous pouvez vous réabonner à tout moment.", variant: 'destructive' });
    } catch (e) {
        toast({ title: "Erreur", description: "Impossible de résilier l'abonnement.", variant: 'destructive' });
    }
  };

  const getStatusInfo = () => {
    if (!userProfile) return { label: 'Chargement', badgeVariant: 'secondary', icon: Skeleton, description: '' };

    if (isSharedAccessActive) {
      return {
        label: 'Accès Partagé',
        badgeVariant: 'default',
        icon: Gift,
        description: `Un accès global est offert à tous les utilisateurs jusqu'au ${format(sharedToken!.expiresAt.toDate(), 'dd MMMM yyyy', { locale: fr })}.`
      };
    }
    
    switch (userProfile.subscriptionStatus) {
      case 'admin':
        return { label: 'Administrateur', badgeVariant: 'default', icon: Crown, description: "Vous avez un accès complet et illimité à l'application." };
      case 'active':
         const expiryDate = new Date(userProfile.subscriptionExpiryDate!);
         const formattedDate = format(expiryDate, 'dd MMMM yyyy', { locale: fr });
         if (isBefore(new Date(), expiryDate)) {
             return { label: 'Actif', badgeVariant: 'default', icon: Star, description: `Votre abonnement est actif jusqu'au ${formattedDate}.` };
         }
         return { label: 'Expiré', badgeVariant: 'destructive', icon: XCircle, description: `Votre abonnement a expiré le ${formattedDate}. Vous disposez maintenant d'un accès limité à une minute par jour.` };
      case 'trial':
        const trialExpiryDate = new Date(userProfile.subscriptionExpiryDate!);
        if (isBefore(new Date(), trialExpiryDate)) {
            return { label: 'Essai', badgeVariant: 'secondary', icon: Star, description: `Votre période d'essai se termine le ${format(trialExpiryDate, 'dd MMMM yyyy', { locale: fr })}.` };
        }
        return { label: 'Limité', badgeVariant: 'destructive', icon: XCircle, description: "Votre période d'essai est terminée. Vous disposez maintenant d'un accès limité à une minute par jour. Passez à la version complète pour un accès illimité." };
      case 'inactive':
        return { label: 'Limité', badgeVariant: 'destructive', icon: XCircle, description: "Votre abonnement est inactif. Vous disposez d'un accès limité à une minute par jour. Réabonnez-vous pour profiter de toutes les fonctionnalités." };
      default:
        return { label: 'Limité', badgeVariant: 'destructive', icon: XCircle, description: "Votre accès est limité à une minute par jour. Passez à la version complète pour un accès illimité." };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;
  const isSubscribed = userProfile?.subscriptionStatus === 'active' && userProfile.subscriptionExpiryDate && isBefore(new Date(), new Date(userProfile.subscriptionExpiryDate));
  
  const renderButtons = () => {
    if (!userProfile || isSharedAccessActive) return null;
    if (userProfile.subscriptionStatus === 'admin') return null;

    if (isSubscribed) {
      return <Button variant="destructive" onClick={handleCancel}>Résilier l'abonnement</Button>;
    }
    
    return <Button onClick={handleSubscribe}>S'abonner pour 4.19 euro/mois</Button>;
  }

  if (isUserLoading || isProfileLoading || isSharedTokenLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Non connecté</CardTitle>
          <CardDescription>Veuillez vous connecter pour gérer votre compte.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Gestion du Compte</span>
             <Badge variant={statusInfo.badgeVariant as any}>{statusInfo.label}</Badge>
          </CardTitle>
          <CardDescription>Gérez votre abonnement et consultez votre statut.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Alert>
                <Icon className="h-5 w-5" />
                <AlertTitle className="font-semibold">{statusInfo.label}</AlertTitle>
                <AlertDescription>{statusInfo.description}</AlertDescription>
            </Alert>
            <div className="flex justify-center pt-4">
                {renderButtons()}
            </div>
        </CardContent>
       </Card>

      {!isSubscribed && userProfile?.subscriptionStatus !== 'admin' && !isSharedAccessActive && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Ticket /> Activer avec un jeton d'accès</CardTitle>
                <CardDescription>Si vous avez reçu un jeton, saisissez-le ici pour activer votre accès.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-2">
                    <div className="flex-grow space-y-1">
                        <Label htmlFor="token-input">Jeton d'accès</Label>
                        <Input 
                            id="token-input" 
                            placeholder="LBN-XXXX-XXXX" 
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            className="font-mono tracking-wider"
                        />
                    </div>
                    <Button onClick={handleRedeemToken} disabled={isRedeeming}>
                        {isRedeeming ? 'Activation...' : 'Activer'}
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}

        <Card>
        <CardHeader>
          <CardTitle>Informations Personnelles</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-2">
                <p className="text-sm font-medium">Adresse e-mail</p>
                <p className="text-muted-foreground">{user.email}</p>
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
