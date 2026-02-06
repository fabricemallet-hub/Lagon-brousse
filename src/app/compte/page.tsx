
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
import { Crown, Star, XCircle, KeyRound, Ticket, Gift, LogOut, Mail, Calendar, User, Bell, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { PushNotificationManager } from '@/components/push-notification-manager';

export default function ComptePage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
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

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const handleSubscribe = () => {
    const paypalLink = process.env.NEXT_PUBLIC_PAYPAL_LINK;
    if (paypalLink) window.open(paypalLink, '_blank');
    else toast({ variant: "destructive", title: "Erreur", description: "Lien non configuré." });
  };

  const handleRedeemToken = async () => {
    if (!firestore || !user || !accessToken) return;
    setIsRedeeming(true);
    const tokenRef = doc(firestore, 'access_tokens', accessToken.trim().toUpperCase());
    try {
      const tokenSnap = await getDoc(tokenRef);
      if (!tokenSnap.exists() || tokenSnap.data()?.status !== 'active') throw new Error('Jeton invalide.');
      const tokenData = tokenSnap.data() as AccessToken;
      const now = new Date();
      const expiryDate = addMonths(now, tokenData.durationMonths);
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'users', user.uid), {
        subscriptionStatus: 'active',
        subscriptionExpiryDate: expiryDate.toISOString(),
      });
      batch.update(tokenRef, { status: 'redeemed', redeemedBy: user.uid, redeemedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: 'Accès activé !' });
      setAccessToken('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setIsRedeeming(false);
    }
  };

  const getStatusInfo = () => {
    if (!userProfile) return { label: 'Chargement', variant: 'secondary', icon: Star, desc: '' };
    if (isSharedAccessActive) return { label: 'Accès Offert', variant: 'default', icon: Gift, desc: `Accès global jusqu'au ${format(sharedToken!.expiresAt.toDate(), 'dd/MM/yyyy', { locale: fr })}.` };
    
    switch (userProfile.subscriptionStatus) {
      case 'admin': return { label: 'Administrateur', variant: 'default', icon: Crown, desc: "Accès illimité." };
      case 'active':
         const exp = new Date(userProfile.subscriptionExpiryDate!);
         return isBefore(new Date(), exp) 
            ? { label: 'Abonné', variant: 'default', icon: Star, desc: `Actif jusqu'au ${format(exp, 'dd MMMM yyyy', { locale: fr })}.` }
            : { label: 'Expiré', variant: 'destructive', icon: XCircle, desc: "Abonnement terminé." };
      default: return { label: 'Mode Limité', variant: 'destructive', icon: XCircle, desc: "Accès 1 minute / jour." };
    }
  };

  const status = getStatusInfo();

  if (isUserLoading || isProfileLoading || isSharedTokenLoading) return <div className="space-y-6 px-1"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1">
       <Card className="w-full shadow-none border-2">
        <CardHeader className="p-6 border-b bg-muted/10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background shadow-lg">
              <User className="size-10 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-black uppercase tracking-tighter">{user?.email?.split('@')[0]}</CardTitle>
              <Badge variant={status.variant as any} className="font-black uppercase tracking-widest text-[10px]">
                {status.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="p-2 bg-background rounded-lg shadow-sm"><status.icon className="size-5 text-primary" /></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Statut Compte</span>
                  <span className="text-sm font-bold">{status.desc || "Limité"}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="p-2 bg-background rounded-lg shadow-sm"><Mail className="size-5 text-muted-foreground" /></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Email</span>
                  <span className="text-xs font-bold truncate max-w-[200px]">{user?.email}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="p-2 bg-background rounded-lg shadow-sm">
                  {userProfile?.notificationsEnabled ? <Bell className="size-5 text-green-600" /> : <BellOff className="size-5 text-muted-foreground" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Notifications Push</span>
                  <span className="text-sm font-bold">{userProfile?.notificationsEnabled ? 'Activées' : 'Désactivées'}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              {userProfile?.subscriptionStatus !== 'active' && userProfile?.subscriptionStatus !== 'admin' && !isSharedAccessActive && (
                <Button onClick={handleSubscribe} className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg">
                  S'abonner (4.19€ / mois)
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} className="w-full h-12 font-black uppercase text-xs tracking-widest border-2">
                <LogOut className="mr-2 size-4" /> Déconnexion
              </Button>
            </div>
        </CardContent>
       </Card>

      <PushNotificationManager />

      {!isSharedAccessActive && userProfile?.subscriptionStatus !== 'admin' && (
        <Card className="w-full shadow-none border-2">
            <CardHeader className="p-6 pb-2">
                <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2"><Ticket className="text-primary" /> Activer un jeton</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
                <div className="flex flex-col gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="token-input" className="text-[10px] font-black uppercase ml-1">Code Jeton</Label>
                        <Input 
                            id="token-input" 
                            placeholder="LBN-XXXX-XXXX" 
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            className="h-14 font-black text-center uppercase tracking-[0.2em] text-lg border-2"
                        />
                    </div>
                    <Button onClick={handleRedeemToken} disabled={isRedeeming || !accessToken} className="w-full h-12 font-black uppercase tracking-widest">
                        {isRedeeming ? 'Validation...' : 'Valider le code'}
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
