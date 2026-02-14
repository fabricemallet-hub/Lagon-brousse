'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, SharedAccessToken, RibSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isBefore, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Crown, Star, XCircle, Ticket, Gift, LogOut, Mail, User, Bell, BellOff, Landmark, CreditCard, Download, ExternalLink, Copy, Check, MapPin, RefreshCw, Store, Zap
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { PushNotificationManager } from '@/components/push-notification-manager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { locations } from '@/lib/locations';

export default function ComptePage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const ribRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'rib');
  }, [firestore]);
  const { data: ribData } = useDoc<RibSettings>(ribRef);

  const isSharedAccessActive = sharedToken && sharedToken.expiresAt && isBefore(new Date(), sharedToken.expiresAt.toDate());

  const handleLogout = async () => {
    if (!auth) return;
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      // Nettoyage complet pour forcer le rafraîchissement de l'état
      sessionStorage.clear();
      localStorage.removeItem('usage_seconds'); // Reset du timer quotidien aussi
      router.replace('/login');
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de se déconnecter." });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleUpdateLocation = async (newLoc: string) => {
    if (!user || !firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        lastSelectedLocation: newLoc
      });
      toast({ title: "Localité mise à jour", description: `Votre commune favorite est désormais ${newLoc}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de mettre à jour la commune." });
    }
  };

  const handleSubscribe = () => {
    const paypalLink = process.env.NEXT_PUBLIC_PAYPAL_LINK;
    if (paypalLink) window.open(paypalLink, '_blank');
    else toast({ variant: "destructive", title: "Erreur", description: "Lien non configuré." });
  };

  const handlePaypalDonate = () => {
    const donationLink = "https://www.paypal.com/ncp/payment/G5GSMQHE3P6NA";
    window.open(donationLink, '_blank');
  };

  const handleCopyRib = () => {
    if (!ribData?.details) return;
    navigator.clipboard.writeText(ribData.details);
    setHasCopied(true);
    toast({ title: "Copié !", description: "Les coordonnées ont été copiées." });
    setTimeout(() => setHasCopied(false), 2000);
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
    
    const roleLower = userProfile.role?.toLowerCase() || '';
    const subLower = userProfile.subscriptionStatus?.toLowerCase() || '';

    // PRIORITÉ 1 : ADMIN
    if (roleLower === 'admin' || subLower === 'admin') {
        return { label: 'Administrateur', variant: 'default', icon: Crown, desc: "Accès illimité Master." };
    }

    // PRIORITÉ 2 : PRO
    if (roleLower === 'professional' || subLower === 'professional' || roleLower === 'pro' || subLower === 'pro') {
        return { label: 'Professionnel', variant: 'outline', icon: Store, desc: "Compte Partenaire Professionnel." };
    }

    // PRIORITÉ 3 : ABONNÉS ACTIFS (Statut Utilisateur Payant)
    if (subLower === 'active') {
        const exp = userProfile.subscriptionExpiryDate ? new Date(userProfile.subscriptionExpiryDate) : null;
        if (exp && isBefore(new Date(), exp)) {
            return { label: 'Abonné', variant: 'default', icon: Star, desc: `Actif jusqu'au ${format(exp, 'dd MMMM yyyy', { locale: fr })}.` };
        }
    }

    // PRIORITÉ 4 : ESSAI GRATUIT ACTIF
    if (subLower === 'trial') {
        const tExp = userProfile.subscriptionExpiryDate ? new Date(userProfile.subscriptionExpiryDate) : null;
        if (tExp && isBefore(new Date(), tExp)) {
            return { label: 'Essai Gratuit', variant: 'secondary', icon: Zap, desc: `Période d'essai jusqu'au ${format(tExp, 'dd/MM/yy', { locale: fr })}.` };
        }
    }

    // PRIORITÉ 5 : ACCÈS GLOBAL (CADEAU) - Seulement si non abonné/pro/essai
    if (isSharedAccessActive) {
        return { label: 'Accès Offert', variant: 'default', icon: Gift, desc: `Accès global jusqu'au ${format(sharedToken!.expiresAt.toDate(), 'dd/MM/yyyy', { locale: fr })}.` };
    }
    
    // CAS D'EXPIRATION
    if (subLower === 'active' || subLower === 'trial') {
        return { label: 'Expiré', variant: 'destructive', icon: XCircle, desc: "Abonnement ou essai terminé." };
    }

    // PAR DÉFAUT
    return { label: 'Mode Limité', variant: 'destructive', icon: XCircle, desc: "Accès 1 minute / jour." };
  };

  const status = getStatusInfo();

  if (isUserLoading || isProfileLoading || isSharedTokenLoading) return <div className="space-y-6 px-1"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
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

              {/* SECTION MA COMMUNE */}
              <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="p-2 bg-background rounded-lg shadow-sm"><MapPin className="size-5 text-primary" /></div>
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-black uppercase text-muted-foreground mb-1">Ma Localité (NC)</span>
                  <Select 
                    defaultValue={userProfile?.lastSelectedLocation || 'Nouméa'} 
                    onValueChange={handleUpdateLocation}
                  >
                    <SelectTrigger className="h-9 border-2 font-bold text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Object.keys(locations).sort().map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              {userProfile?.subscriptionStatus !== 'active' && userProfile?.subscriptionStatus !== 'admin' && userProfile?.subscriptionStatus !== 'professional' && !isSharedAccessActive && (
                <Button onClick={handleSubscribe} className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg">
                  S'abonner (4.19€ / mois)
                </Button>
              )}
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg bg-accent hover:bg-accent/90">DONS</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xs rounded-2xl overflow-hidden p-0">
                  <DialogHeader className="p-6 bg-slate-50 border-b">
                    <DialogTitle className="font-black uppercase tracking-tighter text-center">Soutenir le projet</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 p-6">
                    {ribData?.details && (
                      <div className="space-y-3">
                        <div className="p-4 bg-muted/30 rounded-xl border-2 border-dashed border-primary/20 relative">
                          <p className="text-[10px] font-black uppercase text-primary mb-2 flex items-center gap-2"><Landmark className="size-3" /> Virement Bancaire</p>
                          <pre className="text-[10px] font-mono whitespace-pre-wrap leading-tight break-all">{ribData.details}</pre>
                          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={handleCopyRib}>
                            {hasCopied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-2" onClick={handlePaypalDonate}>
                      <div className="flex items-center gap-2 text-xs font-black uppercase"><CreditCard className="size-4 text-accent" /> PayPal</div>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1"><ExternalLink className="size-2" /> Montant libre</span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                onClick={handleLogout} 
                disabled={isLoggingOut}
                className="w-full h-12 font-black uppercase text-xs tracking-widest border-2"
              >
                {isLoggingOut ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <LogOut className="mr-2 size-4" />}
                {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
              </Button>
            </div>
        </CardContent>
       </Card>

      <PushNotificationManager />

      {!isSharedAccessActive && userProfile?.subscriptionStatus !== 'admin' && userProfile?.subscriptionStatus !== 'professional' && (
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