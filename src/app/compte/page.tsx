'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { UserAccount, Business, AccessToken, SharedAccessToken, RibSettings, Region } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isBefore, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Crown, Star, XCircle, Ticket, Gift, LogOut, Mail, User, Bell, BellOff, Landmark, CreditCard, Download, ExternalLink, Copy, Check, MapPin, RefreshCw, Store, Zap, Pencil, LayoutGrid, Heart, Save, Globe, Smartphone, Phone, Home, Map as MapIcon, Target, LocateFixed, Expand, Shrink
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { PushNotificationManager } from '@/components/push-notification-manager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { locationsByRegion, regions } from '@/lib/locations';
import { navLinks } from '@/lib/nav-links';
import { cn } from '@/lib/utils';
import { useLocation } from '@/context/location-context';
import { Switch } from '@/components/ui/switch';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

export default function ComptePage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { selectedRegion, setSelectedRegion, selectedLocation } = useLocation();
  const { isLoaded: isMapLoaded } = useGoogleMaps();
  
  const [accessToken, setAccessToken] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Name editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Contact details states
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [tempPhone, setTempPhone] = useState('');
  const [tempLandline, setTempLandline] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [tempLocation, setTempLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Favorites state
  const [tempFavorites, setTempFavorites] = useState<string[]>([]);
  const [isSavingFavorites, setIsSavingFavorites] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const businessDataRef = useMemoFirebase(() => {
    if (!firestore || !userProfile?.businessId) return null;
    return doc(firestore, 'businesses', userProfile.businessId);
  }, [firestore, userProfile?.businessId]);
  const { data: businessData } = useDoc<Business>(businessDataRef);

  useEffect(() => {
    if (userProfile?.displayName) {
      setNewName(userProfile.displayName);
    } else if (user?.displayName) {
      setNewName(user.displayName);
    }
    
    if (userProfile) {
        setTempPhone(userProfile.phoneNumber || '');
        setTempLandline(userProfile.landline || '');
        setTempAddress(userProfile.address || '');
        setTempLocation(userProfile.contactLocation || null);
    }

    if (userProfile?.favoriteNavLinks) {
      setTempFavorites(userProfile.favoriteNavLinks);
    } else {
      setTempFavorites(['/', '/peche', '/vessel-tracker', '/chasse', '/champs', '/compte']);
    }
  }, [userProfile, user]);

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
      sessionStorage.clear();
      localStorage.removeItem('usage_seconds');
      router.replace('/login');
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de se déconnecter." });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleUpdateName = () => {
    if (!user || !firestore || !newName.trim()) return;
    setIsSavingName(true);
    
    const userUpdates = { displayName: newName.trim() };
    const userRef = doc(firestore, 'users', user.uid);

    updateProfile(user, userUpdates).catch(err => console.error("Auth profile update error:", err));

    updateDoc(userRef, userUpdates)
      .then(() => {
        if (userProfile?.businessId) {
          const bizRef = doc(firestore, 'businesses', userProfile.businessId);
          updateDoc(bizRef, { name: newName.trim() })
            .catch(async (serverError) => {
              const permissionError = new FirestorePermissionError({
                path: bizRef.path,
                operation: 'update',
                requestResourceData: { name: newName.trim() },
              });
              errorEmitter.emit('permission-error', permissionError);
            });
        }
        
        toast({ title: userProfile?.role === 'professional' ? "Nom du magasin mis à jour !" : "Nom mis à jour !" });
        setIsEditingName(false);
        setIsSavingName(false);
      })
      .catch(async (serverError) => {
        setIsSavingName(false);
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: userUpdates,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const newLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setTempLocation(newLoc);
            if (map) {
                map.panTo({ lat: newLoc.latitude, lng: newLoc.longitude });
                map.setZoom(17);
            }
            toast({ title: "Position détectée" });
        }, () => {
            toast({ variant: "destructive", title: "Erreur GPS", description: "Impossible de vous localiser." });
        });
    }
  };

  const handleSaveContact = () => {
    if (!user || !firestore) return;
    setIsSavingContact(true);
    const userRef = doc(firestore, 'users', user.uid);
    const updates = {
        phoneNumber: tempPhone,
        landline: tempLandline,
        address: tempAddress,
        contactLocation: tempLocation
    };

    updateDoc(userRef, updates)
      .then(() => {
        toast({ title: "Coordonnées enregistrées !" });
        setIsEditingContact(false);
        setIsSavingContact(false);
      })
      .catch(async (serverError) => {
        setIsSavingContact(false);
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: updates,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleUpdateLocation = async (newLoc: string) => {
    if (!user || !firestore) return;
    const userRef = doc(firestore, 'users', user.uid);
    updateDoc(userRef, { lastSelectedLocation: newLoc })
      .then(() => {
        toast({ title: "Localité mise à jour", description: `Votre commune favorite est désormais ${newLoc}.` });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { lastSelectedLocation: newLoc },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleTogglePreferenceCategory = (cat: string) => {
    if (!user || !firestore || !userProfile) return;
    const current = userProfile.subscribedCategories || [];
    const updated = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
    const userRef = doc(firestore, 'users', user.uid);
    
    updateDoc(userRef, { subscribedCategories: updated })
      .then(() => {
        toast({ title: "Intérêts mis à jour" });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { subscribedCategories: updated },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleTogglePreferenceChannel = (field: 'allowsPromoEmails' | 'allowsPromoPush' | 'allowsPromoSMS') => {
    if (!user || !firestore || !userProfile) return;
    const userRef = doc(firestore, 'users', user.uid);
    const newVal = !userProfile[field];
    
    updateDoc(userRef, { [field]: newVal })
      .then(() => {
        toast({ title: "Canaux de notification mis à jour" });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { [field]: newVal },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleToggleFavorite = (href: string) => {
    setTempFavorites(prev => {
      if (prev.includes(href)) {
        if (prev.length <= 2) return prev;
        return prev.filter(h => h !== href);
      }
      if (prev.length >= 6) {
        toast({ title: "Limite atteinte", description: "Maximum 6 favoris autorisés." });
        return prev;
      }
      return [...prev, href];
    });
  };

  const handleSaveFavorites = () => {
    if (!user || !firestore) return;
    setIsSavingFavorites(true);
    const userRef = doc(firestore, 'users', user.uid);
    
    updateDoc(userRef, { favoriteNavLinks: tempFavorites })
      .then(() => {
        toast({ title: "Raccourcis mis à jour !", description: "Votre barre de navigation a été personnalisée." });
        setIsSavingFavorites(false);
      })
      .catch(async (serverError) => {
        setIsSavingFavorites(false);
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { favoriteNavLinks: tempFavorites },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
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

    if (userProfile.id === 't8nPnZLcTiaLJSKMuLzib3C5nPn1' || userProfile.email?.toLowerCase() === 'f.mallet81@outlook.com' || roleLower === 'admin') {
        return { label: 'Administrateur', variant: 'default', icon: Crown, desc: "Accès illimité Master." };
    }

    if (roleLower === 'professional' || subLower === 'professional') {
        return { label: 'Professionnel', variant: 'outline', icon: Store, desc: "Compte Partenaire Professionnel." };
    }

    if (subLower === 'active') {
        const exp = userProfile.subscriptionExpiryDate ? new Date(userProfile.subscriptionExpiryDate) : null;
        if (exp && isBefore(new Date(), exp)) {
            return { label: 'Abonné', variant: 'default', icon: Star, desc: `Actif jusqu'au ${format(exp, 'dd MMMM yyyy', { locale: fr })}.` };
        }
    }

    if (subLower === 'trial') {
        const tExp = userProfile.subscriptionExpiryDate ? new Date(userProfile.subscriptionExpiryDate) : null;
        if (tExp && isBefore(new Date(), tExp)) {
            return { label: 'Essai Gratuit', variant: 'secondary', icon: Zap, desc: `Période d'essai jusqu'au ${format(tExp, 'dd/MM/yy', { locale: fr })}.` };
        }
    }

    if (isSharedAccessActive) {
        return { label: 'Accès Offert', variant: 'default', icon: Gift, desc: `Accès global jusqu'au ${format(sharedToken!.expiresAt.toDate(), 'dd/MM/yyyy', { locale: fr })}.` };
    }
    
    return { label: 'Mode Limité', variant: 'destructive', icon: XCircle, desc: "Accès 1 minute / jour." };
  };

  const status = getStatusInfo();

  const filteredNavLinks = useMemo(() => {
    return navLinks.filter(link => {
      const isAdmin = userProfile?.id === 't8nPnZLcTiaLJSKMuLzib3C5nPn1' || userProfile?.role === 'admin';
      if (link.adminOnly && !isAdmin) return false;
      if (link.proOnly && userProfile?.role !== 'professional' && !isAdmin) return false;
      if (['/aide/faq', '/aide', '/login', '/signup'].includes(link.href)) return false;
      return true;
    });
  }, [userProfile]);

  const availableLocations = useMemo(() => {
    return Object.keys(locationsByRegion[selectedRegion] || {}).sort();
  }, [selectedRegion]);

  if (isUserLoading || isProfileLoading || isSharedTokenLoading) return <div className="space-y-6 px-1"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
       <Card className="w-full shadow-none border-2">
        <CardHeader className="p-6 border-b bg-muted/10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background shadow-lg relative group">
              <User className="size-10 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-xl font-black uppercase tracking-tighter">
                  {businessData?.name || userProfile?.displayName || user?.displayName || user?.email?.split('@')[0]}
                </CardTitle>
                <Dialog open={isEditingName} onOpenChange={setIsEditingName}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-primary/10 text-primary">
                      <Pencil className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xs rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-black uppercase tracking-tighter">
                        {userProfile?.role === 'professional' ? "Nom du magasin" : "Modifier mon nom"}
                      </DialogTitle>
                      <DialogDescription className="text-[10px] font-bold uppercase">
                        {userProfile?.role === 'professional' ? "Saisissez le nouveau nom de votre établissement" : "Saisissez votre nouveau nom d'affichage"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Input 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)} 
                        placeholder={userProfile?.role === 'professional' ? "Nom de l'établissement" : "Nouveau nom..."} 
                        className="font-bold h-12 border-2"
                      />
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateName} disabled={isSavingName || !newName.trim()} className="w-full font-black uppercase tracking-widest h-12">
                        {isSavingName ? <RefreshCw className="size-4 animate-spin mr-2" /> : null}
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
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

              <div className="flex flex-col gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-background rounded-lg shadow-sm"><Globe className="size-5 text-primary" /></div>
                  <div className="flex flex-col flex-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground mb-1">Ma Région</span>
                    <Select value={selectedRegion} onValueChange={(v: Region) => setSelectedRegion(v)}>
                      <SelectTrigger className="h-9 border-2 font-bold text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map(reg => <SelectItem key={reg} value={reg} className="text-xs font-black uppercase">{reg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t border-dashed pt-3 mt-1">
                  <div className="p-2 bg-background rounded-lg shadow-sm"><MapPin className="size-5 text-primary" /></div>
                  <div className="flex flex-col flex-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground mb-1">Ma Commune ({selectedRegion})</span>
                    <Select 
                      value={userProfile?.lastSelectedLocation || selectedLocation} 
                      onValueChange={handleUpdateLocation}
                    >
                      <SelectTrigger className="h-9 border-2 font-bold text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {availableLocations.map(loc => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Card className="border-2 border-primary/10 bg-muted/5 shadow-inner">
                <CardHeader className="p-4 pb-2 flex-row justify-between items-center">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Phone className="size-3 text-primary" /> Mes Coordonnées
                    </CardTitle>
                    <Dialog open={isEditingContact} onOpenChange={setIsEditingContact}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-primary border border-primary/20">Modifier</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto p-0">
                            <DialogHeader className="p-6 bg-slate-50 border-b">
                                <DialogTitle className="font-black uppercase tracking-tight">Mes Coordonnées</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase">Informations de contact pour le Shopping</DialogDescription>
                            </DialogHeader>
                            <div className="p-6 space-y-5 pb-32">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase opacity-60">Mobile</Label>
                                        <Input type="tel" value={tempPhone} onChange={e => setTempPhone(e.target.value)} placeholder="00 00 00" className="font-bold border-2" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase opacity-60">Fixe</Label>
                                        <Input type="tel" value={tempLandline} onChange={e => setTempLandline(e.target.value)} placeholder="00 00 00" className="font-bold border-2" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase opacity-60">Adresse physique</Label>
                                    <Input value={tempAddress} onChange={e => setTempAddress(e.target.value)} placeholder="Rue, quartier..." className="font-bold border-2" />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-2">
                                            <MapIcon className="size-3" /> Point GPS Boutique
                                        </Label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-[8px] font-black uppercase text-primary border border-primary/10 gap-1 bg-white"
                                            onClick={handleLocateMe}
                                        >
                                            <LocateFixed className="size-3" /> Ma position actuelle
                                        </Button>
                                    </div>
                                    <div className={cn("rounded-xl overflow-hidden border-2 relative transition-all duration-300", isMapExpanded ? "h-80" : "h-48")}>
                                        {isMapLoaded ? (
                                            <GoogleMap
                                                mapContainerClassName="w-full h-full"
                                                center={tempLocation ? { lat: tempLocation.latitude, lng: tempLocation.longitude } : INITIAL_CENTER}
                                                zoom={tempLocation ? 17 : 8}
                                                onClick={(e) => { if (e.latLng) setTempLocation({ latitude: e.latLng.lat(), longitude: e.latLng.lng() }); }}
                                                onLoad={setMap}
                                                options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
                                            >
                                                {tempLocation && (
                                                    <OverlayView position={{ lat: tempLocation.latitude, lng: tempLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center">
                                                            <div className="p-1.5 bg-primary rounded-full border-2 border-white shadow-lg"><MapPin className="size-4 text-white" /></div>
                                                        </div>
                                                    </OverlayView>
                                                )}
                                            </GoogleMap>
                                        ) : <Skeleton className="h-full w-full" />}
                                        
                                        <div className="absolute top-2 right-2 flex flex-col gap-2">
                                            <Button 
                                                size="icon" 
                                                className="bg-white/90 backdrop-blur-md border shadow-lg h-8 w-8 text-primary hover:bg-white"
                                                onClick={() => setIsMapExpanded(!isMapExpanded)}
                                            >
                                                {isMapExpanded ? <Shrink className="size-4" /> : <Expand className="size-4" />}
                                            </Button>
                                        </div>

                                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg text-[8px] text-white text-center font-bold uppercase pointer-events-none">
                                            Cliquez sur la carte pour définir votre position
                                        </div>
                                    </div>
                                    {tempLocation && (
                                        <Button variant="ghost" size="sm" className="w-full h-6 text-[8px] font-black uppercase text-destructive" onClick={() => setTempLocation(null)}>
                                            Supprimer le point GPS
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <DialogFooter className="p-4 bg-white border-t sticky bottom-0 z-20">
                                <Button onClick={handleSaveContact} disabled={isSavingContact} className="w-full h-14 font-black uppercase tracking-widest shadow-xl">
                                    {isSavingContact ? <RefreshCw className="size-5 animate-spin mr-2" /> : <Save className="size-5 mr-2" />}
                                    Sauvegarder mes coordonnées
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                            <Smartphone className="size-3 text-primary opacity-40" /> 
                            {userProfile?.phoneNumber || 'Non renseigné'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                            <Phone className="size-3 text-primary opacity-40" /> 
                            {userProfile?.landline || 'Non renseigné'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                        <Home className="size-3 text-primary opacity-40" /> 
                        <span className="truncate">{userProfile?.address || 'Adresse non renseignée'}</span>
                    </div>
                    {userProfile?.contactLocation && (
                        <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase">
                            <Target className="size-3" /> Position GPS enregistrée
                        </div>
                    )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="p-2 bg-background rounded-lg shadow-sm"><Mail className="size-5 text-muted-foreground" /></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Email</span>
                  <span className="text-xs font-bold truncate max-w-[200px]">{user?.email}</span>
                </div>
              </div>
            </div>

            <Card className="border-2 border-dashed border-primary/20 bg-muted/5">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Bell className="size-4 text-primary" /> Abonnements & Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase text-muted-foreground ml-1">Recevoir les offres par thématique :</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {['Pêche', 'Chasse', 'Jardinage'].map(cat => (
                      <div key={cat} className="flex items-center justify-between p-2.5 bg-white rounded-xl border shadow-sm">
                        <span className="text-xs font-bold">{cat}</span>
                        <Switch 
                          checked={userProfile?.subscribedCategories?.includes(cat)} 
                          onCheckedChange={() => handleTogglePreferenceCategory(cat)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-3 border-t border-dashed">
                  <p className="text-[9px] font-black uppercase text-muted-foreground ml-1">Canaux de diffusion :</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="size-3 text-primary" />
                        <span className="text-xs font-bold">Email (Nouveautés)</span>
                      </div>
                      <Switch 
                        checked={userProfile?.allowsPromoEmails ?? true} 
                        onCheckedChange={() => handleTogglePreferenceChannel('allowsPromoEmails')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-center gap-2">
                        <Smartphone className="size-3 text-primary" />
                        <span className="text-xs font-bold">Notifications Push</span>
                      </div>
                      <Switch 
                        checked={userProfile?.allowsPromoPush ?? true} 
                        onCheckedChange={() => handleTogglePreferenceChannel('allowsPromoPush')}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-center gap-2">
                        <Smartphone className="size-3 text-primary" />
                        <span className="text-xs font-bold">Alertes SMS</span>
                      </div>
                      <Switch 
                        checked={userProfile?.allowsPromoSMS ?? true} 
                        onCheckedChange={() => handleTogglePreferenceChannel('allowsPromoSMS')}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-2 px-1">
                <LayoutGrid className="size-4 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Ma Barre de Navigation</h3>
              </div>
              
              <Card className="border-2 border-primary/10 bg-muted/5 shadow-inner">
                <CardContent className="p-4 space-y-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed italic">
                    Choisissez jusqu'à 6 raccourcis à afficher dans votre barre inférieure mobile.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {filteredNavLinks.map(link => {
                      const isSelected = tempFavorites.includes(link.href);
                      return (
                        <div 
                          key={link.href} 
                          onClick={() => handleToggleFavorite(link.href)}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none",
                            isSelected ? "bg-primary text-white border-primary shadow-md scale-95" : "bg-white border-slate-100 opacity-70 grayscale-[0.5]"
                          )}
                        >
                          <link.icon className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-primary")} />
                          <span className="text-[10px] font-black uppercase tracking-tighter truncate">{link.label}</span>
                          {isSelected && <Heart className="size-3 ml-auto fill-white" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black uppercase text-muted-foreground">Sélection : {tempFavorites.length} / 6</span>
                      {tempFavorites.length < 2 && <span className="text-[8px] font-bold text-red-500 uppercase">Min. 2 requis</span>}
                    </div>
                    <Button 
                      onClick={handleSaveFavorites} 
                      disabled={isSavingFavorites || tempFavorites.length < 2}
                      className="w-full h-12 font-black uppercase tracking-widest shadow-lg gap-2"
                    >
                      {isSavingFavorites ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Enregistrer mes raccourcis
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                    <DialogDescription className="text-center text-[10px] uppercase font-bold">Contribution financière pour maintenir l'application en ligne.</DialogDescription>
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
