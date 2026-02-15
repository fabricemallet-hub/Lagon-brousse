
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, getDocs, orderBy, deleteDoc, updateDoc, getCountFromServer } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Plus, Trash2, Send, DollarSign, Users, ShoppingBag, Store, Camera, RefreshCw, Percent, Tag, FileText, ImageIcon, X, Info, Pencil, Save, AlertCircle, LogOut, HelpCircle, Copy, Check, UserCircle, ShieldCheck, BrainCircuit, MapPin, ChevronDown, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { locations } from '@/lib/locations';

type TargetScope = 'SPECIFIC' | 'CALEDONIE' | 'TAHITI' | 'ALL';

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- BUSINESS DATA ---
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  // SÉCURITÉ : REDIRECTION SI NON PRO/ADMIN
  useEffect(() => {
    if (!isUserLoading && profile && !isProfileLoading) {
        const masterEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com', 'kledostyle@outlook.com'];
        const isMaster = (user?.email && masterEmails.includes(user.email.toLowerCase()));
        
        const isPro = isMaster || profile.role === 'professional' || profile.role === 'admin' || profile.subscriptionStatus === 'professional' || profile.subscriptionStatus === 'admin';
        
        if (!isPro) {
            router.replace('/compte');
        }
    }
  }, [profile, isProfileLoading, isUserLoading, router, user]);

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !profile?.businessId) return null;
    return doc(firestore, 'businesses', profile.businessId);
  }, [firestore, profile?.businessId]);
  const { data: business, isLoading: isBusinessLoading } = useDoc<Business>(businessRef);

  // --- PROMOTIONS LIST ---
  const promosRef = useMemoFirebase(() => {
    if (!firestore || !business?.id) return null;
    return query(collection(firestore, 'businesses', business.id, 'promotions'), orderBy('createdAt', 'desc'));
  }, [firestore, business?.id]);
  const { data: promotions, isLoading: isPromosLoading } = useCollection<Promotion>(promosRef);

  // --- REACH CALCULATION ---
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [totalCommuneUsers, setTotalCommuneUsers] = useState<number | null>(null);
  const [isCalculatingReach, setIsCalculatingReach] = useState(false);
  const [reachError, setReachError] = useState(false);

  // --- CIBLAGE GEOGRAPHIQUE ---
  const [targetScope, setTargetScope] = useState<TargetScope>('SPECIFIC');
  const [selectedTargetCommunes, setSelectedTargetCommunes] = useState<string[]>([]);
  const allCommuneNames = useMemo(() => Object.keys(locations).sort(), []);

  // --- FORM STATES ---
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCategory, setPromoCategory] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoPrice, setPromoPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [promoImage, setPromoImage] = useState('');
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCopiedUid, setHasCopiedUid] = useState(false);

  // Initialize target category and communes from business
  useEffect(() => {
    if (business) {
      if ((business.categories || []).length > 0) {
        const defaultCat = business.categories[0];
        if (!targetCategory) setTargetCategory(defaultCat);
        if (!promoCategory) setPromoCategory(defaultCat);
      }
      if (selectedTargetCommunes.length === 0) {
        setSelectedTargetCommunes([business.commune]);
      }
    }
  }, [business, targetCategory, promoCategory, selectedTargetCommunes.length]);

  useEffect(() => {
    if (!firestore || !business || isUserLoading || !user) return;
    
    const calculateReach = async () => {
      setIsCalculatingReach(true);
      setReachError(false);
      try {
        const usersRef = collection(firestore, 'users');
        
        let qTotal;
        let qTarget;

        if (targetScope === 'ALL') {
          qTotal = query(usersRef);
          qTarget = query(usersRef, where('subscribedCategories', 'array-contains', targetCategory));
        } else if (targetScope === 'CALEDONIE') {
          qTotal = query(usersRef, where('selectedRegion', '==', 'CALEDONIE'));
          qTarget = query(usersRef, where('selectedRegion', '==', 'CALEDONIE'), where('subscribedCategories', 'array-contains', targetCategory));
        } else if (targetScope === 'TAHITI') {
          qTotal = query(usersRef, where('selectedRegion', '==', 'TAHITI'));
          qTarget = query(usersRef, where('selectedRegion', '==', 'TAHITI'), where('subscribedCategories', 'array-contains', targetCategory));
        } else if (selectedTargetCommunes.length > 0) {
          // Firestore 'in' limitation: max 30 values.
          const communesToQuery = selectedTargetCommunes.slice(0, 30);
          qTotal = query(
            usersRef, 
            where('lastSelectedLocation', 'in', communesToQuery)
          );
          qTarget = query(
            usersRef, 
            where('lastSelectedLocation', 'in', communesToQuery),
            where('subscribedCategories', 'array-contains', targetCategory)
          );
        } else {
          setTotalCommuneUsers(0);
          setTargetCount(0);
          setIsCalculatingReach(false);
          return;
        }

        const snapTotal = await getCountFromServer(qTotal);
        const snapTarget = await getCountFromServer(qTarget);
        
        setTotalCommuneUsers(snapTotal.data().count);
        setTargetCount(snapTarget.data().count);

      } catch (e: any) {
        console.warn("Reach calculation restricted", e);
        setReachError(true);
        setTargetCount(0);
        setTotalCommuneUsers(0);
      } finally {
        setIsCalculatingReach(false);
      }
    };
    calculateReach();
  }, [firestore, business, targetCategory, isUserLoading, user, targetScope, selectedTargetCommunes]);

  const handleCopyUid = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setHasCopiedUid(true);
    toast({ title: "UID Copié !" });
    setTimeout(() => setHasCopiedUid(false), 2000);
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.replace('/login');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        setPromoImage(event.target?.result as string);
        toast({ title: "Photo chargée" });
    };
    reader.readAsDataURL(file);
  };

  const handleSavePromotion = async () => {
    if (!firestore || !business || !promoTitle || !promoCategory) return;
    setIsSaving(true);
    try {
      const priceNum = parseFloat(promoPrice) || 0;
      const originalPriceNum = parseFloat(originalPrice) || null;
      let discount = null;
      
      if (originalPriceNum && originalPriceNum > priceNum) {
        discount = ((originalPriceNum - priceNum) / originalPriceNum) * 100;
      }

      const promoData: any = {
        businessId: business.id,
        title: promoTitle,
        category: promoCategory,
        description: promoDescription,
        price: priceNum,
        originalPrice: originalPriceNum,
        discountPercentage: discount,
        promoType,
        imageUrl: promoImage,
        updatedAt: serverTimestamp(),
      };

      if (editingPromoId) {
        await updateDoc(doc(firestore, 'businesses', business.id, 'promotions', editingPromoId), promoData);
        toast({ title: "Produit mis à jour" });
      } else {
        promoData.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), promoData);
        toast({ title: "Produit ajouté" });
      }
      
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingPromoId(null);
    setPromoTitle('');
    setPromoDescription('');
    setPromoPrice('');
    setOriginalPrice('');
    setPromoImage('');
    if (business && (business.categories || []).length > 0) {
        setPromoCategory(business.categories[0]);
    }
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromoId(promo.id);
    setPromoTitle(promo.title);
    setPromoCategory(promo.category || (business?.categories?.[0] || ''));
    setPromoDescription(promo.description || '');
    setPromoPrice(promo.price?.toString() || '');
    setOriginalPrice(promo.originalPrice?.toString() || '');
    setPromoImage(promo.imageUrl || '');
    setPromoType(promo.promoType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePromotion = async (id: string) => {
    if (!firestore || !business) return;
    try {
        await deleteDoc(doc(firestore, 'businesses', business.id, 'promotions', id));
        toast({ title: "Produit supprimé" });
        if (editingPromoId === id) resetForm();
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  const handleDiffuse = async () => {
    if (!firestore || !business || targetCount === null || !targetCategory) return;
    setIsSaving(true);
    
    let targetLabel = "";
    if (targetScope === 'ALL') targetLabel = "TOUT LE RÉSEAU (NC & TAHITI)";
    else if (targetScope === 'CALEDONIE') targetLabel = "TOUTE LA NOUVELLE-CALÉDONIE";
    else if (targetScope === 'TAHITI') targetLabel = "TOUTE LA POLYNÉSIE (TAHITI)";
    else targetLabel = selectedTargetCommunes.join(', ');

    try {
      const campaignData: Omit<Campaign, 'id'> = {
        ownerId: user!.uid,
        businessId: business.id,
        businessName: business.name,
        title: `${business.name} : ${promoTitle || 'Nouvelle offre !'}`,
        message: promoDescription || `Découvrez nos offres en ${targetCategory}.`,
        targetCommune: targetLabel,
        targetCategory: targetCategory,
        reach: targetCount,
        cost: targetCount * 10,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      await addDoc(collection(firestore, 'campaigns'), campaignData);
      toast({ title: "Demande de diffusion envoyée" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTargetCommune = (name: string) => {
    setSelectedTargetCommunes(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  if (isUserLoading || isProfileLoading || isBusinessLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-1">
      {/* IDENTITÉ PRO CONSOLIDÉE */}
      <Card className="border-2 border-primary bg-primary/5 shadow-lg overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary text-white rounded-lg shadow-sm"><UserCircle className="size-6" /></div>
                    <div>
                        <p className="font-black text-xl uppercase leading-none mb-1 text-slate-800">
                          {profile?.displayName || user?.displayName || 'Utilisateur Pro'}
                        </p>
                        <div className="flex flex-col">
                            <p className="text-[9px] font-black uppercase text-primary/60">Identifiant de partage (UID)</p>
                            <p className="font-mono font-black text-xs tracking-tight select-all opacity-70 leading-none">{user?.uid}</p>
                        </div>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] h-10 gap-2 border-2 bg-white shadow-sm" onClick={handleCopyUid}>
                    {hasCopiedUid ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                    Copier
                </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-primary/10">
                <Badge className="font-black uppercase text-[9px] bg-primary tracking-wider">Rôle: {profile?.role}</Badge>
                <Badge variant="outline" className="font-black uppercase text-[9px] border-primary text-primary bg-white tracking-wider">Statut: {profile?.subscriptionStatus}</Badge>
            </div>
        </CardContent>
      </Card>

      {!business ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-4 text-center">
            <div className="p-6 bg-muted rounded-full text-muted-foreground shadow-inner">
                <Store className="size-16" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Compte non relié</h2>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-sm mt-2">
                Transmettez votre UID ci-dessus à l'administrateur pour qu'il puisse rattacher votre boutique à ce compte.
            </p>
            <Button onClick={() => router.push('/compte')} variant="ghost" className="mt-4 font-black uppercase text-[10px] tracking-widest border-2">Retour au profil</Button>
        </div>
      ) : (
        <>
          <Card className={cn("border-2 shadow-xl overflow-hidden transition-all", editingPromoId ? "border-accent ring-2 ring-accent/20" : "border-primary")}>
            <CardHeader className={cn(editingPromoId ? "bg-accent" : "bg-primary", "text-white")}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter">
                    {editingPromoId ? "Modifier la fiche" : business.name}
                  </CardTitle>
                  <CardDescription className="text-white/80 font-bold uppercase text-[10px]">
                    {editingPromoId ? `Produit ID : ${editingPromoId}` : `Dashboard Professionnel • ${business.commune}`}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                    {(business.categories || []).map(cat => (
                        <Badge key={cat} variant="outline" className="bg-white/10 text-white border-white/20 uppercase font-black text-[8px]">{cat}</Badge>
                    ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className={cn("text-sm font-black uppercase flex items-center gap-2 border-b pb-2", editingPromoId ? "text-accent border-accent/20" : "text-primary border-primary/20")}>
                    {editingPromoId ? <Pencil className="size-4" /> : <ShoppingBag className="size-4" />} 
                    {editingPromoId ? "Mise à jour" : "Nouveau Produit"}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Titre de l'article</Label>
                      <Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ex: Moulinet..." className="font-bold border-2 h-11" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Rayon / Catégorie</Label>
                      <Select value={promoCategory} onValueChange={setPromoCategory}>
                        <SelectTrigger className="h-11 border-2 font-black uppercase text-xs">
                            <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(business.categories || []).map(cat => (
                                <SelectItem key={cat} value={cat} className="font-black text-xs uppercase">{cat}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix de vente (F)</Label>
                            <Input 
                                type="number" 
                                value={promoPrice} 
                                onChange={e => setPromoPrice(e.target.value)} 
                                placeholder="Ex: 1500" 
                                className="font-bold border-2 h-11" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix d'origine (Barré)</Label>
                            <Input 
                                type="number" 
                                value={originalPrice} 
                                onChange={e => setOriginalPrice(e.target.value)} 
                                placeholder="Ex: 2000" 
                                className="font-medium border-2 h-11" 
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Description courte</Label>
                      <Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} placeholder="Détails de l'offre..." className="font-medium border-2 min-h-[80px]" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Type d'offre</Label>
                            <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}>
                            <SelectTrigger className="h-11 border-2 font-black text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Promo">Promotion</SelectItem>
                                <SelectItem value="Nouvel Arrivage">Nouveauté</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Photo smartphone</Label>
                            <Button variant="outline" className="w-full h-11 border-2 gap-2 font-black uppercase text-[10px]" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="size-3" /> Charger
                            </Button>
                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        {editingPromoId && (
                            <Button variant="ghost" onClick={resetForm} className="flex-1 font-bold uppercase text-xs h-14 border-2">Annuler</Button>
                        )}
                        <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle} className={cn("flex-[2] h-14 font-black uppercase gap-2 shadow-lg text-sm tracking-widest", editingPromoId ? "bg-accent" : "bg-primary")}>
                            {isSaving ? <RefreshCw className="size-5 animate-spin" /> : <Plus className="size-5" />}
                            {editingPromoId ? "Sauvegarder" : "Mettre en ligne"}
                        </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6">
                        <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Megaphone className="size-4" /> Reach & Diffusion</h3>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Ciblage Catégorie</Label>
                                <Select value={targetCategory} onValueChange={setTargetCategory}>
                                    <SelectTrigger className="h-10 border-2 bg-background font-black uppercase text-[10px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(business.categories || []).map(cat => (
                                            <SelectItem key={cat} value={cat} className="font-black uppercase text-[10px]">{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Portée du ciblage</Label>
                                <Select value={targetScope} onValueChange={(v: TargetScope) => setTargetScope(v)}>
                                    <SelectTrigger className="h-10 border-2 bg-background font-black uppercase text-[10px]">
                                        <Globe className="size-3 mr-2 text-primary" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SPECIFIC" className="text-[10px] font-black uppercase">Communes spécifiques</SelectItem>
                                        <SelectItem value="CALEDONIE" className="text-[10px] font-black uppercase">Toute la Nouvelle-Calédonie</SelectItem>
                                        <SelectItem value="TAHITI" className="text-[10px] font-black uppercase">Toute la Polynésie (Tahiti)</SelectItem>
                                        <SelectItem value="ALL" className="text-[10px] font-black uppercase">Tout le réseau (NC & Tahiti)</SelectItem>
                                    </SelectContent>
                                </Select>

                                {targetScope === 'SPECIFIC' && (
                                    <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full h-10 justify-between font-bold text-xs border-2 bg-white">
                                                    <span className="truncate">
                                                        {selectedTargetCommunes.length === 0 ? "Aucune commune" : 
                                                        selectedTargetCommunes.length === 1 ? selectedTargetCommunes[0] : 
                                                        `${selectedTargetCommunes.length} communes sélectionnées`}
                                                    </span>
                                                    <ChevronDown className="size-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[280px] p-0" align="start">
                                                <ScrollArea className="h-72 p-4">
                                                    <div className="space-y-2">
                                                        {allCommuneNames.map((name) => (
                                                            <div key={name} className="flex items-center space-x-2">
                                                                <Checkbox 
                                                                    id={`commune-${name}`} 
                                                                    checked={selectedTargetCommunes.includes(name)}
                                                                    onCheckedChange={() => toggleTargetCommune(name)}
                                                                />
                                                                <label htmlFor={`commune-${name}`} className="text-xs font-medium cursor-pointer">{name}</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between p-4 bg-background rounded-xl shadow-sm border-2">
                                    <div className="flex items-center gap-3">
                                        <Users className="size-5 text-primary" />
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Audience Potentielle ({targetCategory})</p>
                                            <p className="text-xl font-black leading-none">
                                                {isCalculatingReach ? <RefreshCw className="size-4 animate-spin text-primary" /> : `${targetCount ?? '0'}`}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-primary text-primary">
                                        {targetScope === 'ALL' ? 'Global' : targetScope === 'CALEDONIE' ? 'NC' : targetScope === 'TAHITI' ? 'Tahiti' : 'Ciblé'}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl shadow-sm border-2 border-dashed">
                                    <div className="flex items-center gap-3">
                                        <MapPin className="size-5 text-slate-400" />
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">
                                                Utilisateurs Actifs {targetScope === 'ALL' ? "sur le réseau" : targetScope === 'CALEDONIE' ? "en Calédonie" : targetScope === 'TAHITI' ? "à Tahiti" : "sur les zones cibles"}
                                            </p>
                                            <p className="text-lg font-black leading-none">
                                                {isCalculatingReach ? <RefreshCw className="size-3 animate-spin" /> : `${totalCommuneUsers ?? '0'}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {reachError && (
                                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-xl space-y-2">
                                    <p className="text-[9px] text-red-600 font-bold uppercase flex items-center gap-2">
                                        <AlertCircle className="size-3" /> Aide technique
                                    </p>
                                    <Button size="sm" variant="outline" className="w-full h-8 text-[8px] font-black uppercase border-red-200 text-red-600" onClick={handleLogout}>Déconnexion & Reconnexion</Button>
                                </div>
                            )}

                            <Button 
                                onClick={handleDiffuse} 
                                disabled={isSaving || !targetCount || reachError || (targetScope === 'SPECIFIC' && selectedTargetCommunes.length === 0)} 
                                className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest shadow-lg gap-2"
                            >
                                <Megaphone className="size-5" /> Lancer la campagne
                            </Button>
                        </div>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                <Store className="size-4" /> Vos articles en ligne ({promotions?.length || 0})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {promotions?.map(promo => (
                    <Card key={promo.id} className={cn("overflow-hidden border-2 shadow-sm flex h-32", editingPromoId === promo.id && "border-accent bg-accent/5")}>
                        <div className="w-24 bg-muted/20 shrink-0 relative flex items-center justify-center border-r">
                            {promo.imageUrl ? <img src={promo.imageUrl} className="w-full h-full object-cover" alt={promo.title} /> : <ImageIcon className="size-6 opacity-20" />}
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                                <h4 className="font-black uppercase text-xs truncate">{promo.title}</h4>
                                <p className="text-[9px] text-muted-foreground line-clamp-2 italic">{promo.description || "Pas de description."}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-[7px] h-4 font-black uppercase border-primary/20 text-primary">{promo.promoType}</Badge>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="size-7 border rounded-full" onClick={() => handleEditPromotion(promo)}><Pencil className="size-3" /></Button>
                                    <Button variant="ghost" size="icon" className="size-7 text-destructive border rounded-full" onClick={() => handleDeletePromotion(promo.id)}><Trash2 className="size-3" /></Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
