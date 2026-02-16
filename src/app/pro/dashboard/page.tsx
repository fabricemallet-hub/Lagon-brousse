
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, getDocs, orderBy, deleteDoc, updateDoc, getCountFromServer } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, Campaign, CampaignPricingSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Plus, Trash2, Send, DollarSign, Users, ShoppingBag, Store, Camera, RefreshCw, Percent, Tag, FileText, ImageIcon, X, Info, Pencil, Save, AlertCircle, LogOut, HelpCircle, Copy, Check, UserCircle, ShieldCheck, BrainCircuit, MapPin, ChevronDown, Globe, Smartphone, Mail, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn, getDistance } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { locations } from '@/lib/locations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type TargetScope = 'SPECIFIC' | 'CALEDONIE' | 'TAHITI' | 'ALL';

const MAIN_CATEGORIES = ["Pêche", "Chasse", "Jardinage"];

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  const pricingRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'campaign_pricing');
  }, [firestore]);
  const { data: pricing } = useDoc<CampaignPricingSettings>(pricingRef);

  useEffect(() => {
    if (!isUserLoading && profile && !isProfileLoading) {
        const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com'];
        const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2'];
        const isMaster = masterEmails.includes(user?.email?.toLowerCase() || '') || masterUids.includes(user?.uid || '');
        const isPro = isMaster || profile.role === 'professional' || profile.role === 'admin' || profile.subscriptionStatus === 'professional' || profile.subscriptionStatus === 'admin';
        if (!isPro) router.replace('/compte');
    }
  }, [profile, isProfileLoading, isUserLoading, router, user]);

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !profile?.businessId) return null;
    return doc(firestore, 'businesses', profile.businessId);
  }, [firestore, profile?.businessId]);
  const { data: business, isLoading: isBusinessLoading } = useDoc<Business>(businessRef);

  const promosRef = useMemoFirebase(() => {
    if (!firestore || !business?.id) return null;
    return query(collection(firestore, 'businesses', business.id, 'promotions'), orderBy('createdAt', 'desc'));
  }, [firestore, business?.id]);
  const { data: promotions, isLoading: isPromosLoading } = useCollection<Promotion>(promosRef);

  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
  const [targetCategory, setTargetCategory] = useState<string>('Pêche');
  
  const [pushTargetCount, setPushTargetCount] = useState<number | null>(null);
  const [mailTargetCount, setMailTargetCount] = useState<number | null>(null);
  const [smsTargetCount, setSmsTargetCount] = useState<number | null>(null);
  const [baseTargetCount, setBaseTargetCount] = useState<number | null>(null);
  
  const [isCalculatingReach, setIsCalculatingReach] = useState(false);
  const [reachError, setReachError] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['PUSH', 'MAIL']);
  const [targetScope, setTargetScope] = useState<TargetScope>('SPECIFIC');
  const [selectedTargetCommunes, setSelectedTargetCommunes] = useState<string[]>([]);
  const [communeSearch, setCommuneSearch] = useState('');
  
  const allCommuneNames = useMemo(() => Object.keys(locations).sort(), []);
  const filteredCommuneList = useMemo(() => {
    return allCommuneNames.filter(name => name.toLowerCase().includes(communeSearch.toLowerCase()));
  }, [allCommuneNames, communeSearch]);

  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCategory, setPromoCategory] = useState('Pêche');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoPrice, setPromoPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [manualDiscountInput, setManualDiscountInput] = useState('');
  const [promoImages, setPromoImages] = useState<string[]>([]);
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCopiedUid, setHasCopiedUid] = useState(false);

  useEffect(() => {
    if (manualDiscountInput && originalPrice) {
        const pct = parseFloat(manualDiscountInput);
        const origPrice = parseFloat(originalPrice);
        if (pct >= 0 && pct <= 100 && origPrice > 0) {
            const calculatedSale = origPrice * (1 - pct / 100);
            setPromoPrice(Math.round(calculatedSale).toString());
        }
    }
  }, [manualDiscountInput, originalPrice]);

  const calculatedDiscount = useMemo(() => {
    const priceNum = parseFloat(promoPrice);
    const originalPriceNum = parseFloat(originalPrice);
    if (priceNum && originalPriceNum && originalPriceNum > priceNum) {
      return Math.round(((originalPriceNum - priceNum) / originalPriceNum) * 100);
    }
    return null;
  }, [promoPrice, originalPrice]);

  useEffect(() => {
    if (business) {
      if ((business.categories || []).length > 0) {
        const defaultCat = business.categories[0];
        if (!targetCategory) setTargetCategory(defaultCat);
        if (!promoCategory) setPromoCategory(defaultCat);
      }
      if (selectedTargetCommunes.length === 0) setSelectedTargetCommunes([business.commune]);
    }
  }, [business]);

  useEffect(() => {
    if (!firestore || !business || isUserLoading || !user) return;
    
    const calculateReach = async () => {
      setIsCalculatingReach(true);
      setReachError(false);
      try {
        const usersRef = collection(firestore, 'users');
        
        const getBaseQuery = () => {
            let q = query(usersRef, where('subscribedCategories', 'array-contains', targetCategory));
            
            if (targetScope === 'CALEDONIE') {
                q = query(q, where('selectedRegion', '==', 'CALEDONIE'));
            } else if (targetScope === 'TAHITI') {
                q = query(q, where('selectedRegion', '==', 'TAHITI'));
            } else if (targetScope === 'SPECIFIC') {
                if (selectedTargetCommunes.length > 0) {
                    q = query(q, where('lastSelectedLocation', 'in', selectedTargetCommunes.slice(0, 30)));
                } else {
                    return null;
                }
            }
            return q;
        };

        const qBase = getBaseQuery();
        
        if (!qBase) {
            setBaseTargetCount(0);
            setPushTargetCount(0);
            setMailTargetCount(0);
            setSmsTargetCount(0);
            setIsCalculatingReach(false);
            return;
        }
        
        const qPush = query(qBase, where('allowsPromoPush', '==', true));
        const qMail = query(qBase, where('allowsPromoEmails', '==', true));
        const qSms = query(qBase, where('allowsPromoSMS', '==', true));

        const [snapBase, snapPush, snapMail, snapSms] = await Promise.all([
            getCountFromServer(qBase),
            getCountFromServer(qPush),
            getCountFromServer(qMail),
            getCountFromServer(qSms)
        ]);
        
        setBaseTargetCount(snapBase.data().count);
        setPushTargetCount(snapPush.data().count);
        setMailTargetCount(snapMail.data().count);
        setSmsTargetCount(snapSms.data().count);

      } catch (e: any) {
        console.warn("Reach calculation error", e);
        setReachError(true);
      } finally {
        setIsCalculatingReach(false);
      }
    };
    
    const timer = setTimeout(calculateReach, 500);
    return () => clearTimeout(timer);
  }, [firestore, business, targetCategory, isUserLoading, user, targetScope, selectedTargetCommunes]);

  const totalCalculatedCost = useMemo(() => {
    if (!pricing || baseTargetCount === null || selectedPromoIds.length === 0) return 0;
    
    const articleCount = selectedPromoIds.length;
    let baseCampaignCost = pricing.fixedPrice; 
    let costPerArticle = 0;
    
    costPerArticle += (baseTargetCount * pricing.unitPricePerUser);
    
    if (selectedChannels.includes('SMS') && smsTargetCount !== null) costPerArticle += (smsTargetCount * (pricing.priceSMS || 0));
    if (selectedChannels.includes('PUSH') && pushTargetCount !== null) costPerArticle += (pushTargetCount * (pricing.pricePush || 0));
    if (selectedChannels.includes('MAIL') && mailTargetCount !== null) costPerArticle += (mailTargetCount * (pricing.priceMail || 0));

    return Math.ceil(baseCampaignCost + (costPerArticle * articleCount));
  }, [pricing, baseTargetCount, smsTargetCount, pushTargetCount, mailTargetCount, selectedChannels, selectedPromoIds]);

  const handleCopyUid = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setHasCopiedUid(true);
    toast({ title: "UID Copié !" });
    setTimeout(() => setHasCopiedUid(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const canAdd = 4 - promoImages.length;
    if (canAdd <= 0) { toast({ variant: 'destructive', title: "Limite atteinte" }); return; }
    files.slice(0, canAdd).forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => setPromoImages(prev => [...prev, ev.target?.result as string].slice(0, 4));
        reader.readAsDataURL(f);
    });
  };

  const handleSavePromotion = async () => {
    if (!firestore || !business || !promoTitle || !promoCategory) return;
    setIsSaving(true);
    try {
      const priceNum = parseFloat(promoPrice) || 0;
      const originalPriceNum = parseFloat(originalPrice) || null;
      let discount = (originalPriceNum && originalPriceNum > priceNum) ? ((originalPriceNum - priceNum) / originalPriceNum) * 100 : null;

      const promoData: any = {
        businessId: business.id, title: promoTitle, category: promoCategory, description: promoDescription,
        price: priceNum, originalPrice: originalPriceNum, discountPercentage: discount, promoType,
        imageUrl: promoImages[0] || '', images: promoImages, updatedAt: serverTimestamp(),
      };

      if (editingPromoId) await updateDoc(doc(firestore, 'businesses', business.id, 'promotions', editingPromoId), promoData);
      else { promoData.createdAt = serverTimestamp(); await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), promoData); }
      resetForm();
      toast({ title: "Article enregistré !" });
    } finally { setIsSaving(false); }
  };

  const resetForm = () => { 
    setEditingPromoId(null); 
    setPromoTitle(''); 
    setPromoDescription(''); 
    setPromoPrice(''); 
    setOriginalPrice(''); 
    setManualDiscountInput('');
    setPromoImages([]); 
    setPromoCategory('Pêche'); 
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromoId(promo.id); 
    setPromoTitle(promo.title); 
    setPromoCategory(promo.category || 'Pêche'); 
    setPromoDescription(promo.description || '');
    setPromoPrice(promo.price?.toString() || ''); 
    setOriginalPrice(promo.originalPrice?.toString() || ''); 
    if (promo.price && promo.originalPrice && promo.originalPrice > promo.price) {
        setManualDiscountInput(Math.round(((promo.originalPrice - promo.price) / promo.originalPrice) * 100).toString());
    } else {
        setManualDiscountInput('');
    }
    setPromoImages(promo.images || [promo.imageUrl || '']);
    setPromoType(promo.promoType); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePromotion = async (id: string) => {
    if (!firestore || !business) return;
    try {
        await deleteDoc(doc(firestore, 'businesses', business.id, 'promotions', id));
        toast({ title: "Article supprimé" });
    } catch (e) {}
  };

  const handleDiffuse = async () => {
    if (!firestore || !business || baseTargetCount === null || selectedPromoIds.length === 0) return;
    setIsSaving(true);
    try {
      const selectedPromos = promotions?.filter(p => selectedPromoIds.includes(p.id)) || [];
      await addDoc(collection(firestore, 'campaigns'), {
        ownerId: user!.uid, businessId: business.id, businessName: business.name,
        title: `${business.name} : ${selectedPromos.length} offres !`,
        message: `Offres : ${selectedPromos.map(p => p.title).join(', ')}.`,
        targetCommune: targetScope === 'ALL' ? 'GLOBAL' : (targetScope === 'SPECIFIC' ? selectedTargetCommunes.join(', ') : targetScope),
        targetCategory, reach: baseTargetCount, cost: totalCalculatedCost, status: 'pending', createdAt: serverTimestamp(), selectedChannels
      });
      toast({ title: "Campagne envoyée pour validation !" });
    } finally { setIsSaving(false); }
  };

  if (isUserLoading || isProfileLoading || isBusinessLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-1">
      <Card className="border-2 border-primary bg-primary/5 shadow-lg overflow-hidden">
        <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary text-white rounded-lg"><UserCircle className="size-6" /></div>
                <div>
                    <p className="font-black text-xl uppercase leading-none mb-1 text-slate-800">{business?.name || 'Magasin Pro'}</p>
                    <p className="font-mono font-black text-[10px] opacity-70 leading-none select-all">{user?.uid}</p>
                </div>
            </div>
            <Button variant="outline" size="sm" className="font-black uppercase text-[10px] border-2 bg-white" onClick={handleCopyUid}>{hasCopiedUid ? <Check className="size-3" /> : <Copy className="size-3" />}</Button>
        </CardContent>
      </Card>

      {!business ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
            <Store className="size-16 text-muted-foreground" />
            <h2 className="text-xl font-black uppercase">Compte non relié</h2>
            <p className="text-sm opacity-60">Transmettez votre UID à l'admin pour activer votre boutique.</p>
        </div>
      ) : (
        <>
          <Card className={cn("border-2 shadow-xl overflow-hidden", editingPromoId ? "border-accent" : "border-primary")}>
            <CardHeader className={cn(editingPromoId ? "bg-accent" : "bg-primary", "text-white")}>
              <CardTitle className="text-2xl font-black uppercase tracking-tighter">{editingPromoId ? "Modifier l'article" : "Gestion Boutique"}</CardTitle>
              <CardDescription className="text-white/80 font-bold uppercase text-[10px]">Catalogue & Campagnes publicitaires</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase flex items-center gap-2 border-b pb-2"><ShoppingBag className="size-4" /> {editingPromoId ? "Mise à jour" : "Nouveau Produit"}</h3>
                  <div className="space-y-3">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Titre</Label><Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} className="font-bold border-2" /></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Rayon</Label><Select value={promoCategory} onValueChange={setPromoCategory}><SelectTrigger className="border-2 font-black uppercase text-xs"><SelectValue /></SelectTrigger><SelectContent>{MAIN_CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-black text-xs uppercase">{cat}</SelectItem>)}</SelectContent></Select></div>
                    
                    <div className="grid grid-cols-2 gap-3 p-4 bg-muted/10 rounded-2xl border-2 border-dashed border-primary/5">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix Barré (Origine)</Label>
                            <Input 
                                type="number" 
                                value={originalPrice} 
                                onChange={e => setOriginalPrice(e.target.value)} 
                                className="border-2 bg-white" 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Remise (%)</Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    placeholder="Ex: 50" 
                                    value={manualDiscountInput}
                                    onChange={e => setManualDiscountInput(e.target.value)}
                                    className="h-10 border-2 font-black text-center text-xs bg-white pl-8" 
                                />
                                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-primary opacity-40" />
                            </div>
                        </div>
                        <div className="col-span-2 space-y-1 mt-2">
                            <Label className="text-[10px] font-black uppercase text-primary ml-1 flex items-center justify-between">
                                Prix Final (S'affiche à l'écran)
                                {calculatedDiscount && (
                                    <Badge variant="destructive" className="h-5 px-2 text-[10px] font-black animate-pulse shadow-md">
                                        -{calculatedDiscount}%
                                    </Badge>
                                )}
                            </Label>
                            <Input 
                                type="number" 
                                value={promoPrice} 
                                onChange={e => {
                                    setPromoPrice(e.target.value);
                                    if (!originalPrice) setManualDiscountInput('');
                                }} 
                                className={cn(
                                    "font-black text-lg border-2 h-12 transition-all",
                                    calculatedDiscount ? "border-red-200 bg-red-50 text-red-600 ring-2 ring-red-100" : "bg-white"
                                )} 
                            />
                        </div>
                    </div>

                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Description</Label><Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} className="font-medium border-2 min-h-[80px]" /></div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Photos (Max 4)</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {promoImages.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl border-2 overflow-hidden bg-muted"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setPromoImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="size-3" /></button></div>
                            ))}
                            {promoImages.length < 4 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex items-center justify-center text-primary/40"><Plus className="size-5" /></button>}
                        </div>
                        <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    </div>
                    <div className="flex gap-2 pt-2">
                        {editingPromoId && <Button variant="ghost" onClick={resetForm} className="flex-1 border-2">Annuler</Button>}
                        <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle} className="flex-[2] h-12 font-black uppercase shadow-lg">Sauvegarder l'article</Button>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6">
                    <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Megaphone className="size-4" /> Ciblage & Audiences</h3>
                    <div className="space-y-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Rayon cible</Label><Select value={targetCategory} onValueChange={setTargetCategory}><SelectTrigger className="h-10 border-2 bg-background font-black text-xs"><SelectValue /></SelectTrigger><SelectContent>{MAIN_CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-black text-xs">{cat}</SelectItem>)}</SelectContent></Select></div>
                        
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Portée géographique</Label><Select value={targetScope} onValueChange={(v: any) => setTargetScope(v)}><SelectTrigger className="h-10 border-2 bg-background font-black text-xs"><Globe className="size-3 mr-2 text-primary" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SPECIFIC">Communes spécifiques</SelectItem><SelectItem value="CALEDONIE">Nouvelle-Calédonie</SelectItem><SelectItem value="TAHITI">Tahiti</SelectItem><SelectItem value="ALL">Tout le réseau</SelectItem></SelectContent></Select></div>

                        {targetScope === 'SPECIFIC' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Sélection des communes (Max 30)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-10 border-2 bg-background justify-between font-bold text-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                <MapPin className="size-3 text-primary" />
                                                {selectedTargetCommunes.length === 0 ? "Aucune commune" : 
                                                 selectedTargetCommunes.length === 1 ? selectedTargetCommunes[0] :
                                                 `${selectedTargetCommunes.length} communes`}
                                            </div>
                                            <ChevronDown className="size-3 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <div className="p-3 border-b bg-slate-50/50">
                                            <p className="text-[10px] font-black uppercase tracking-tight">Sélecteur de communes</p>
                                            <p className="text-[8px] font-bold uppercase text-muted-foreground">Zones de diffusion de la campagne</p>
                                        </div>
                                        <div className="p-2 border-b">
                                            <Input 
                                                placeholder="Filtrer..." 
                                                className="h-8 text-xs" 
                                                value={communeSearch}
                                                onChange={(e) => setCommuneSearch(e.target.value)}
                                            />
                                        </div>
                                        <ScrollArea className="h-[250px]">
                                            <div className="p-2 space-y-1">
                                                {filteredCommuneList.map(name => (
                                                    <div key={name} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded cursor-pointer transition-colors" onClick={() => {
                                                        setSelectedTargetCommunes(prev => 
                                                            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name].slice(0, 30)
                                                        );
                                                    }}>
                                                        <Checkbox id={`check-${name}`} checked={selectedTargetCommunes.includes(name)} />
                                                        <span className="text-xs font-bold uppercase">{name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Audiences Réelles :</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-black uppercase text-muted-foreground">Potentiel Zone:</span>
                                    <Badge variant="secondary" className="h-4 text-[9px] font-black">{isCalculatingReach ? '...' : `${baseTargetCount ?? 0}`}</Badge>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className={cn("p-3 rounded-xl border-2 flex items-center justify-between transition-all", selectedChannels.includes('PUSH') ? "bg-primary/10 border-primary/30" : "bg-background opacity-50")}>
                                    <div className="flex items-center gap-2">
                                        <Zap className="size-4 text-primary" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase leading-none">Push Notifications</span>
                                            <span className="text-[8px] font-bold opacity-60 uppercase">Opt-in valide</span>
                                        </div>
                                    </div>
                                    <span className="font-black text-xs">{isCalculatingReach ? <RefreshCw className="size-3 animate-spin text-primary"/> : `${pushTargetCount ?? 0} client${(pushTargetCount ?? 0) > 1 ? 's' : ''}`}</span>
                                </div>
                                <div className={cn("p-3 rounded-xl border-2 flex items-center justify-between transition-all", selectedChannels.includes('MAIL') ? "bg-green-50 border-green-200" : "bg-background opacity-50")}>
                                    <div className="flex items-center gap-2">
                                        <Mail className="size-4 text-green-600" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase leading-none">Newsletter Email</span>
                                            <span className="text-[8px] font-bold opacity-60 uppercase">Opt-in valide</span>
                                        </div>
                                    </div>
                                    <span className="font-black text-xs">{isCalculatingReach ? <RefreshCw className="size-3 animate-spin text-green-600"/> : `${mailTargetCount ?? 0} client${(mailTargetCount ?? 0) > 1 ? 's' : ''}`}</span>
                                </div>
                                <div className={cn("p-3 rounded-xl border-2 flex items-center justify-between transition-all", selectedChannels.includes('SMS') ? "bg-blue-50 border-blue-200" : "bg-background opacity-50")}>
                                    <div className="flex items-center gap-2">
                                        <Smartphone className="size-4 text-blue-600" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase leading-none">Alerte SMS</span>
                                            <span className="text-[8px] font-bold opacity-60 uppercase">Mobile renseigné</span>
                                        </div>
                                    </div>
                                    <span className="font-black text-xs">{isCalculatingReach ? <RefreshCw className="size-3 animate-spin text-blue-600"/> : `${smsTargetCount ?? 0} client${(smsTargetCount ?? 0) > 1 ? 's' : ''}`}</span>
                                </div>
                            </div>
                            {reachError && <p className="text-[8px] font-bold text-red-500 text-center uppercase animate-pulse">Erreur de calcul. Sélectionnez une zone.</p>}
                        </div>

                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Canaux souhaités</Label>
                            <div className="flex flex-wrap gap-2">
                                {[{ id: 'SMS', label: 'SMS' }, { id: 'PUSH', label: 'Push' }, { id: 'MAIL', label: 'Email' }].map(ch => (
                                    <Badge key={ch.id} variant={selectedChannels.includes(ch.id) ? "default" : "outline"} className="cursor-pointer font-black uppercase h-8 px-3 border-2" onClick={() => setSelectedChannels(prev => prev.includes(ch.id) ? prev.filter(c => c !== ch.id) : [...prev, ch.id])}>{ch.label}</Badge>
                                ))}
                            </div>
                        </div>

                        {pricing && selectedPromoIds.length > 0 && !isCalculatingReach && (
                            <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl space-y-3 animate-in fade-in">
                                <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><DollarSign className="size-3" /> Devis (x{selectedPromoIds.length} article{selectedPromoIds.length > 1 ? 's' : ''})</p>
                                <div className="space-y-1.5 text-[11px] font-bold text-slate-600">
                                    <div className="flex justify-between"><span className="opacity-60">Frais fixes (Campagne)</span><span>{pricing.fixedPrice} F</span></div>
                                    <div className="flex justify-between border-t border-dashed pt-1 mt-1"><span className="opacity-60">Base Reach ({baseTargetCount} x {pricing.unitPricePerUser}F)</span><span>{Math.round((baseTargetCount || 0) * pricing.unitPricePerUser * selectedPromoIds.length)} F</span></div>
                                    {selectedChannels.includes('SMS') && <div className="flex justify-between text-blue-600"><span>Canal SMS ({smsTargetCount} x {pricing.priceSMS}F)</span><span>{Math.round((smsTargetCount || 0) * (pricing.priceSMS || 0) * selectedPromoIds.length)} F</span></div>}
                                    {selectedChannels.includes('PUSH') && <div className="flex justify-between text-primary"><span>Canal Push ({pushTargetCount} x {pricing.pricePush}F)</span><span>{Math.round((pushTargetCount || 0) * (pricing.pricePush || 0) * selectedPromoIds.length)} F</span></div>}
                                    {selectedChannels.includes('MAIL') && <div className="flex justify-between text-green-600"><span>Canal Email ({mailTargetCount} x {pricing.priceMail}F)</span><span>{Math.round((mailTargetCount || 0) * (pricing.priceMail || 0) * selectedPromoIds.length)} F</span></div>}
                                    <div className="flex justify-between items-center bg-primary/10 p-3 rounded-xl border border-primary/20 mt-3"><span className="text-[10px] font-black uppercase text-primary">Total estimé</span><span className="text-xl text-primary font-black">{totalCalculatedCost} FCFP</span></div>
                                </div>
                            </div>
                        )}

                        <Button onClick={handleDiffuse} disabled={isSaving || !baseTargetCount || selectedChannels.length === 0 || selectedPromoIds.length === 0} className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase shadow-lg gap-2"><Megaphone className="size-5" /> Lancer la campagne</Button>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center justify-between">
                <span>Vos articles ({promotions?.length || 0})</span>
                <span className="text-[10px] text-primary">{selectedPromoIds.length} sélectionné{selectedPromoIds.length > 1 ? 's' : ''}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isPromosLoading ? [1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />) : promotions?.map(promo => (
                    <Card key={promo.id} className={cn("overflow-hidden border-2 shadow-sm flex h-32 transition-all cursor-pointer", selectedPromoIds.includes(promo.id) ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/30")} onClick={() => setSelectedPromoIds(prev => prev.includes(promo.id) ? prev.filter(pid => pid !== promo.id) : [...prev, promo.id])}>
                        <div className="w-8 bg-muted/30 border-r flex items-center justify-center shrink-0"><Checkbox checked={selectedPromoIds.includes(promo.id)} onCheckedChange={() => {}} /></div>
                        <div className="w-24 bg-muted/20 shrink-0 relative overflow-hidden flex items-center justify-center border-r">{promo.imageUrl ? <img src={promo.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="size-6 opacity-20" />}</div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black uppercase text-xs truncate flex-1">{promo.title}</h4>
                                    {promo.discountPercentage && (
                                        <Badge variant="destructive" className="h-3.5 px-1 text-[7px] font-black">-{Math.round(promo.discountPercentage)}%</Badge>
                                    )}
                                </div>
                                <p className="text-[9px] text-muted-foreground line-clamp-2 italic">{promo.description || "Pas de description."}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-[7px] h-4 font-black uppercase border-primary/20 text-primary">{promo.price} F</Badge>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon" className="size-7 border rounded-full" onClick={() => handleEditPromotion(promo)}><Pencil className="size-3" /></Button><Button variant="ghost" size="icon" className="size-7 text-destructive border rounded-full" onClick={() => handleDeletePromotion(promo.id)}><Trash2 className="size-3" /></Button></div>
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
