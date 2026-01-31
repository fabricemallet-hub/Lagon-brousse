'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Crown, Star, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ComptePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const handleSubscribe = () => {
    const paypalLink = process.env.NEXT_PUBLIC_PAYPAL_LINK;

    if (paypalLink) {
      toast({
        title: 'Redirection vers PayPal',
        description: "Vous allez être redirigé pour finaliser votre abonnement.",
      });
      window.location.href = paypalLink;
    } else {
      console.error("La variable d'environnement NEXT_PUBLIC_PAYPAL_LINK n'est pas définie.");
      toast({
        variant: "destructive",
        title: "Configuration requise",
        description: "Le lien de paiement n'est pas configuré. Veuillez contacter l'administrateur.",
      });
    }
  };

  const handleCancel = () => {
    if (!userDocRef) return;
    setDocumentNonBlocking(userDocRef, {
        subscriptionStatus: 'inactive',
    }, { merge: true });
    toast({ title: "Abonnement résilié", description: "Votre accès est maintenant limité. Vous pouvez vous réabonner à tout moment.", variant: 'destructive' });
  };

  const getStatusInfo = () => {
    if (!userProfile) return { label: 'Chargement', badgeVariant: 'secondary', icon: Skeleton, description: '' };
    
    switch (userProfile.subscriptionStatus) {
      case 'admin':
        return { label: 'Administrateur', badgeVariant: 'default', icon: Crown, description: "Vous avez un accès complet et illimité à l'application." };
      case 'active':
         return { label: 'Actif', badgeVariant: 'default', icon: Star, description: `Votre abonnement est actif. Prochain paiement le ${format(new Date(userProfile.subscriptionExpiryDate!), 'dd MMMM yyyy', { locale: fr })}.` };
      case 'trial':
        const isTrialValid = isBefore(new Date(), new Date(userProfile.subscriptionExpiryDate!));
        if (isTrialValid) {
            return { label: 'Essai', badgeVariant: 'secondary', icon: Star, description: `Votre période d'essai se termine le ${format(new Date(userProfile.subscriptionExpiryDate!), 'dd MMMM yyyy', { locale: fr })}.` };
        }
        return { label: 'Limité', badgeVariant: 'destructive', icon: XCircle, description: "Votre période d'essai est terminée. Passez à la version complète pour un accès illimité." };
      case 'inactive':
        return { label: 'Limité', badgeVariant: 'destructive', icon: XCircle, description: "Votre abonnement est inactif. Réabonnez-vous pour profiter de toutes les fonctionnalités." };
      default:
        return { label: 'Limité', badgeVariant: 'destructive', icon: XCircle, description: "Passez à la version complète pour un accès illimité." };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;
  
  const renderButtons = () => {
    if (!userProfile) return null;
    const status = userProfile.subscriptionStatus;

    if (status === 'admin') return null;

    if (status === 'active') {
      return <Button variant="destructive" onClick={handleCancel}>Résilier l'abonnement</Button>;
    }
    
    return <Button onClick={handleSubscribe}>S'abonner pour 500 FCFP/mois</Button>;
  }

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
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
