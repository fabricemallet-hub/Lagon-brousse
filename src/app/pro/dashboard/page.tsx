'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, orderBy, deleteDoc, updateDoc, getCountFromServer } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, CampaignPricingSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  Store, 
  RefreshCw, 
  ImageIcon, 
  X, 
  Pencil, 
  UserCircle, 
  BrainCircuit, 
  MapPin, 
  ChevronDown, 
  Globe, 
  Smartphone, 
  Mail, 
  Zap, 
  Wand2,
  Check, 
  CheckCircle2, 
  CreditCard
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { allCommuneNames } from '@/lib/locations';
import { analyzeProduct } from '@/ai/flows/analyze-product-flow';
import { generateCampaignMessages } from '@/ai/flows/generate-campaign-messages-flow';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type TargetScope = 'SPECIFIC' | 'CALEDONIE' | 'TAHITI' | 'ALL';
type WizardStep = 'IDLE' | 'INFO' | 'TONE' | 'GENERATING' | 'OPTIONS' | 'STRATEGY';
type CampaignWizardStep = 'IDLE' | 'TONE' | 'LENGTH' | 'GENERATING' | 'SELECTION' | 'PREVIEW';

const MAIN_CATEGORIES = ["Pêche", "Chasse", "Jardinage"];
const AVAILABLE_TONES = [
    { id: 'Local (Caillou)', label: 'Local (Caillou)', desc: 'Parle au coeur des Calédoniens' },
    { id: 'Commercial', label: 'Commercial', desc: 'Ton vendeur et dynamique' },
    { id: 'Humoristique', label: 'Humoristique', desc: 'Un peu de rire pour accrocher' },
    { id: 'Sérieux', label: 'Sérieux', desc: 'Sobriété et efficacité' },
    { id: 'Professionnel', label: 'Professionnel', desc: 'Ton expert et rassurant' },
    { id: 'Simple', label: 'Simple', desc: 'Direct et facile à lire' },
];

const CAMPAIGN_LENGTHS = [
    { id: 'Short', label: 'Court', desc: 'Direct à l\'essentiel' },
    { id: 'Medium', label: 'Moyen', desc: 'Équilibre parfait' },
    { id: 'Long', label: 'Long', desc: 'Détaillé et persuasif' },
];

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const YEARS = ["2025", "2026", "2027", "2028"];

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
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

  // States for Product Wizard
  const [wizardStep, setWizardStep] = useState<WizardStep>('IDLE');
  const [aiAdditionalInfo, setAiAdditionalInfo] = useState('');
  const [aiSelectedTone, setAiSelectedTone] = useState('Commercial');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AnalyzeProductOutput | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);

  // States for Campaign Wizard
  const [campWizardStep, setCampWizardStep] = useState<CampaignWizardStep>('IDLE');
  const [campTone, setCampTone] = useState('Commercial');
  const [campLength, setCampLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [campProps, setCampProps] = useState<GenerateCampaignOutput | null>(null);
  const [selectedSmsIdx, setSelectedSmsIdx] = useState<number | null>(null);
  const [selectedPushIdx, setSelectedPushIdx] = useState<number | null>(null);
  const [selectedMailIdx, setSelectedMailIdx] = useState<number | null>(null);
  const [finalSms, setFinalSms] = useState('');
  const [finalPush, setFinalPush] = useState('');
  const [finalMailSubject, setFinalMailSubject] = useState('');
  const [finalMailBody, setFinalMailBody] = useState('');

  // Article Form State
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
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [nextArrivalMonth, setNextArrivalMonth] = useState('Mars');
  const [nextArrivalYear, setNextArrivalYear] = useState('2025');

  // Campaign Config State
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
  const [targetCategory, setTargetCategory] = useState<string>('Pêche');
  const [pushTargetCount, setPushTargetCount] = useState<number | null>(null);
  const [mailTargetCount, setMailTargetCount] = useState<number | null>(null);
  const [smsTargetCount, setSmsTargetCount] = useState<number | null>(null);
  const [baseTargetCount, setBaseTargetCount] = useState<number | null>(null);
  const [isCalculatingReach, setIsCalculatingReach] = useState(false);
  const [reachError, setReachError] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<('SMS' | 'PUSH' | 'MAIL')[]>(['PUSH', 'MAIL']);
  const [targetScope, setTargetScope] = useState<TargetScope>('SPECIFIC');
  const [selectedTargetCommunes, setSelectedTargetCommunes] = useState<string[]>([]);
  const [communeSearch, setCommuneSearch] = useState('');

  useEffect(() => {
    if (!isUserLoading && profile && !isProfileLoading) {
        const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com'];
        const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2'];
        const isMaster = masterEmails.includes(user?.email?.toLowerCase() || '') || masterUids.includes(user?.uid || '');
        const isPro = isMaster || profile.role === 'professional' || profile.role === 'admin' || profile.subscriptionStatus === 'professional' || profile.subscriptionStatus === 'admin';
        if (!isPro) router.replace('/compte');
    }
  }, [profile, isProfileLoading, isUserLoading, router, user]);

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
  }, [business, selectedTargetCommunes.length, targetCategory, promoCategory]);

  useEffect(() => {
    if (!firestore || !business || isUserLoading || !user) return;
    
    const calculateReach = async () => {
      setIsCalculatingReach(true);
      setReachError(false);
      try {
        const usersRef = collection(firestore, 'users');
        const qBase = (targetScope === 'ALL') ? 
            query(usersRef, where('subscribedCategories', 'array-contains', targetCategory)) :
            (targetScope === 'SPECIFIC' ? 
                query(usersRef, where('lastSelectedLocation', 'in', selectedTargetCommunes.length > 0 ? selectedTargetCommunes.slice(0, 30) : ['NONE']), where('subscribedCategories', 'array-contains', targetCategory)) :
                query(usersRef, where('selectedRegion', '==', targetScope), where('subscribedCategories', 'array-contains', targetCategory))
            );
        
        const [snapBase, snapPush, snapMail, snapSms] = await Promise.all([
            getCountFromServer(qBase),
            getCountFromServer(query(qBase, where('allowsPromoPush', '==', true))),
            getCountFromServer(query(qBase, where('allowsPromoEmails', '==', true))),
            getCountFromServer(query(qBase, where('allowsPromoSMS', '==', true)))
        ]);
        
        setBaseTargetCount(snapBase.data().count);
        setPushTargetCount(snapPush.data().count);
        setMailTargetCount(snapMail.data().count);
        setSmsTargetCount(snapSms.data().count);
      } catch (e: any) {
        setReachError(true);
        setBaseTargetCount(0);
        setPushTargetCount(0);
        setMailTargetCount(0);
        setSmsTargetCount(0);
      } finally {
        setIsCalculatingReach(false);
      }
    };
    
    const timer = setTimeout(calculateReach, 500);
    return () => clearTimeout(timer);
  }, [firestore, business, targetCategory, isUserLoading, user, targetScope, selectedTargetCommunes]);

  const totalCalculatedCost = useMemo(() => {
    if (!pricing || baseTargetCount === null || selectedPromoIds.length === 0) return 0;
    let cost = pricing.fixedPrice + (selectedPromoIds.length * baseTargetCount * pricing.unitPricePerUser);
    if (selectedChannels.includes('SMS') && smsTargetCount) cost += (smsTargetCount * (pricing.priceSMS || 0));
    if (selectedChannels.includes('PUSH') && pushTargetCount) cost += (pushTargetCount * (pricing.pricePush || 0));
    if (selectedChannels.includes('MAIL') && mailTargetCount) cost += (mailTargetCount * (pricing.priceMail || 0));
    return Math.ceil(cost);
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

  const handleSavePromotion = () => {
    if (!firestore || !business || !promoTitle || !promoCategory) return;
    setIsSaving(true);
    const priceNum = parseFloat(promoPrice) || 0;
    const originalPriceNum = parseFloat(originalPrice) || null;
    const discount = (originalPriceNum && originalPriceNum > priceNum) ? ((originalPriceNum - priceNum) / originalPriceNum) * 100 : null;

    const promoData: any = {
      businessId: business.id, title: promoTitle, category: promoCategory, description: promoDescription,
      price: priceNum, originalPrice: originalPriceNum, discountPercentage: discount, promoType,
      imageUrl: promoImages[0] || '', images: promoImages, isOutOfStock,
      restockDate: isOutOfStock ? `${nextArrivalMonth} ${nextArrivalYear}` : null,
      updatedAt: serverTimestamp(),
    };

    const targetDoc = editingPromoId ? doc(firestore, 'businesses', business.id, 'promotions', editingPromoId) : doc(collection(firestore, 'businesses', business.id, 'promotions'));
    if (!editingPromoId) promoData.createdAt = serverTimestamp();

    setDoc(targetDoc, promoData, { merge: true }).then(() => {
        toast({ title: editingPromoId ? "Article mis à jour !" : "Article enregistré !" });
        resetForm();
        setIsSaving(false);
    }).catch(async (err) => {
        setIsSaving(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: targetDoc.path, operation: editingPromoId ? 'update' : 'create', requestResourceData: promoData }));
    });
  };

  const resetForm = () => { 
    setEditingPromoId(null); setPromoTitle(''); setPromoDescription(''); setPromoPrice(''); setOriginalPrice(''); setManualDiscountInput('');
    setPromoImages([]); setPromoCategory('Pêche'); setIsOutOfStock(false); setNextArrivalMonth('Mars'); setNextArrivalYear('2025');
    setWizardStep('IDLE'); setAiAdditionalInfo(''); setAiSelectedTone('Commercial'); setAiAnalysisResult(null); setSelectedOptionIdx(null);
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromoId(promo.id); setPromoTitle(promo.title); setPromoCategory(promo.category || 'Pêche'); setPromoDescription(promo.description || '');
    setPromoPrice(promo.price?.toString() || ''); setOriginalPrice(promo.originalPrice?.toString() || ''); 
    if (promo.price && promo.originalPrice && promo.originalPrice > promo.price) setManualDiscountInput(Math.round(((promo.originalPrice - promo.price) / promo.originalPrice) * 100).toString());
    else setManualDiscountInput('');
    setPromoImages(promo.images || [promo.imageUrl || '']); setPromoType(promo.promoType); setIsOutOfStock(promo.isOutOfStock || false);
    if (promo.restockDate) { const parts = promo.restockDate.split(' '); if (parts.length === 2) { setNextArrivalMonth(parts[0]); setNextArrivalYear(parts[1]); } }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePromotion = (id: string) => {
    if (!firestore || !business) return;
    deleteDoc(doc(firestore, 'businesses', business.id, 'promotions', id)).then(() => toast({ title: "Article supprimé" }));
  };

  const startAiWizard = () => {
    if (!promoTitle || promoImages.length === 0) { toast({ variant: 'destructive', title: "Données manquantes" }); return; }
    setWizardStep('INFO');
  };

  const processAiAnalysis = async () => {
    setWizardStep('GENERATING');
    try {
        const result = await analyzeProduct({ title: promoTitle, type: promoType, category: promoCategory, photos: promoImages, price: parseFloat(promoPrice) || undefined, discountPercentage: calculatedDiscount || undefined, additionalInfo: aiAdditionalInfo, tone: aiSelectedTone });
        setAiAnalysisResult(result);
        setWizardStep('OPTIONS');
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur IA" });
        setWizardStep('TONE');
    }
  };

  const handleSelectOption = (idx: number) => {
    if (!aiAnalysisResult) return;
    setSelectedOptionIdx(idx);
    setPromoDescription(aiAnalysisResult.commercialDescriptions[idx]);
    setWizardStep('STRATEGY');
  };

  const startCampWizard = () => {
    if (selectedPromoIds.length === 0) { toast({ variant: 'destructive', title: "Sélection vide" }); return; }
    setCampWizardStep('TONE');
  };

  const processCampGeneration = async () => {
    setCampWizardStep('GENERATING');
    try {
        const selectedPromos = promotions?.filter(p => selectedPromoIds.includes(p.id)) || [];
        const result = await generateCampaignMessages({
            businessName: business!.name,
            products: selectedPromos.map(p => ({ title: p.title, description: p.description || '', type: p.promoType, price: p.price, discount: p.discountPercentage || undefined })),
            channels: selectedChannels, tone: campTone, length: campLength
        });
        setCampProps(result);
        setCampWizardStep('SELECTION');
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur IA" });
        setCampWizardStep('LENGTH');
    }
  };

  const handleConfirmSelections = () => {
    if (selectedChannels.includes('SMS') && selectedSmsIdx !== null) setFinalSms(campProps!.smsPropositions![selectedSmsIdx]);
    if (selectedChannels.includes('PUSH') && selectedPushIdx !== null) setFinalPush(campProps!.pushPropositions![selectedPushIdx]);
    if (selectedChannels.includes('MAIL') && selectedMailIdx !== null) {
        setFinalMailSubject(campProps!.mailPropositions![selectedMailIdx].subject);
        setFinalMailBody(campProps!.mailPropositions![selectedMailIdx].body);
    }
    setCampWizardStep('PREVIEW');
  };

  const handleFinalDiffuse = () => {
    if (!firestore || !business || !user) return;
    setIsSaving(true);
    const campaignData: any = {
      ownerId: user.uid, businessId: business.id, businessName: business.name,
      title: finalMailSubject || `${business.name} : Nouvelles offres`,
      message: finalPush || finalSms || "Découvrez nos offres !",
      smsContent: finalSms || null, pushContent: finalPush || null, mailSubject: finalMailSubject || null, mailBody: finalMailBody || null,
      targetCommune: targetScope === 'ALL' ? 'GLOBAL' : (targetScope === 'SPECIFIC' ? selectedTargetCommunes.join(', ') : targetScope),
      targetCategory, reach: baseTargetCount, cost: totalCalculatedCost, status: 'pending', selectedChannels, promotedPromoIds: selectedPromoIds,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    addDoc(collection(firestore, 'campaigns'), campaignData).then(() => {
        toast({ title: "Campagne envoyée !" });
        setCampWizardStep('IDLE');
        setSelectedPromoIds([]);
        setIsSaving(false);
    }).catch(async (err) => {
        setIsSaving(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'campaigns', operation: 'create', requestResourceData: campaignData }));
    });
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
        <div className="space-y-8">
            <Card className={cn("border-2 shadow-xl overflow-hidden", editingPromoId ? "border-accent" : "border-primary")}>
                <CardHeader className={cn(editingPromoId ? "bg-accent" : "bg-primary", "text-white")}>
                    <CardTitle className="text-2xl font-black uppercase tracking-tighter">{editingPromoId ? "Modifier l'article" : "Gestion Boutique"}</CardTitle>
                    <CardDescription className="text-white/80 font-bold uppercase text-[10px]">Catalogue & Campagnes publicitaires</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="text-sm font-black uppercase flex items-center gap-2"><ShoppingBag className="size-4" /> Produit</h3>
                                <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}>
                                    <SelectTrigger className="h-8 w-32 border-2 font-black uppercase text-[9px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Promo" className="text-[9px] font-black uppercase text-red-600">Promotion</SelectItem>
                                        <SelectItem value="Nouvel Arrivage" className="text-[9px] font-black uppercase text-primary">Nouveauté</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Titre</Label><Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} className="font-bold border-2" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Rayon</Label><Select value={promoCategory} onValueChange={setPromoCategory}><SelectTrigger className="border-2 font-black uppercase text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent>{MAIN_CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-black text-xs uppercase">{cat}</SelectItem>)}</SelectContent></Select></div>
                                
                                <div className="grid grid-cols-2 gap-3 p-4 bg-muted/10 rounded-2xl border-2 border-dashed border-primary/5">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix Barré</Label>
                                        <Input type="number" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} className="border-2 bg-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Remise (%)</Label>
                                        <Input type="number" value={manualDiscountInput} onChange={e => setManualDiscountInput(e.target.value)} className="border-2 font-black text-center bg-white" />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-[10px] font-black uppercase text-primary ml-1">Prix Final {calculatedDiscount && <Badge variant="destructive" className="h-4 px-1 text-[8px]">-{calculatedDiscount}%</Badge>}</Label>
                                        <Input type="number" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} className="font-black text-lg border-2 h-12 bg-white" />
                                    </div>
                                </div>

                                <div className="p-4 bg-red-50/50 border-2 border-dashed border-red-200 rounded-2xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-black uppercase text-red-800">Produit épuisé</Label>
                                        <Switch checked={isOutOfStock} onCheckedChange={setIsOutOfStock} />
                                    </div>
                                    {isOutOfStock && (
                                        <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                                            <Select value={nextArrivalMonth} onValueChange={setNextArrivalMonth}>
                                                <SelectTrigger className="h-10 border-2 bg-white"><SelectValue /></SelectTrigger>
                                                <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <Select value={nextArrivalYear} onValueChange={setNextArrivalYear}>
                                                <SelectTrigger className="h-10 border-2 bg-white"><SelectValue /></SelectTrigger>
                                                <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase opacity-60">Photos (Max 4)</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {promoImages.map((img, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-xl border-2 overflow-hidden bg-muted"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setPromoImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="size-3" /></button></div>
                                        ))}
                                        {promoImages.length < 4 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 hover:bg-primary/5 transition-colors gap-1"><Plus className="size-4" /><span className="text-[7px] font-black uppercase">Ajouter</span></button>}
                                    </div>
                                    <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Description commerciale</Label><Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase border-primary/30 text-primary gap-1.5" onClick={startAiWizard} disabled={!promoTitle || promoImages.length === 0}><Wand2 className="size-2.5" /> Magicien IA</Button></div>
                                    <Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} className="font-medium border-2 min-h-[100px] text-sm bg-white" />
                                </div>

                                <div className="flex gap-2">
                                    {editingPromoId && <Button variant="ghost" onClick={resetForm} className="flex-1 border-2">Annuler</Button>}
                                    <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle} className="flex-[2] h-12 font-black uppercase shadow-lg">Sauvegarder</Button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6">
                            <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Megaphone className="size-4" /> Campagne</h3>
                            <div className="space-y-4">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Rayon cible</Label><Select value={targetCategory} onValueChange={setTargetCategory}><SelectTrigger className="h-10 border-2 bg-background font-black text-xs"><SelectValue /></SelectTrigger><SelectContent>{MAIN_CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-black text-xs uppercase">{cat}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Portée</Label><Select value={targetScope} onValueChange={(v: any) => setTargetScope(v)}><SelectTrigger className="h-10 border-2 bg-background font-black text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SPECIFIC">Communes spécifiques</SelectItem><SelectItem value="CALEDONIE">Nouvelle-Calédonie</SelectItem><SelectItem value="TAHITI">Tahiti</SelectItem><SelectItem value="ALL">Tout le réseau</SelectItem></SelectContent></Select></div>
                                {targetScope === 'SPECIFIC' && (
                                    <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full h-10 border-2 bg-background justify-between font-bold text-xs"><div className="flex items-center gap-2 truncate"><MapPin className="size-3 text-primary" />{selectedTargetCommunes.length === 0 ? "Aucune commune" : `${selectedTargetCommunes.length} communes`}</div><ChevronDown className="size-3 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[300px] p-0 z-[160]"><div className="p-2 border-b"><Input placeholder="Filtrer..." className="h-8 text-xs" value={communeSearch} onChange={(e) => setCommuneSearch(e.target.value)} /></div><ScrollArea className="h-[250px]"><div className="p-2 space-y-1">{allCommuneNames.filter(n => n.toLowerCase().includes(communeSearch.toLowerCase())).map(name => (<div key={name} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded cursor-pointer" onClick={() => setSelectedTargetCommunes(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name].slice(0, 30))}><Checkbox checked={selectedTargetCommunes.includes(name)} /><span className="text-xs font-bold uppercase">{name}</span></div>))}</div></ScrollArea></PopoverContent></Popover>
                                )}
                                <div className="space-y-2 p-3 rounded-xl border bg-background/50">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground">Reach estimé : {isCalculatingReach ? '...' : (baseTargetCount ?? 0)} abonnés</p>
                                    <div className="flex flex-wrap gap-2">{[{ id: 'SMS', label: 'SMS' }, { id: 'PUSH', label: 'Push' }, { id: 'MAIL', label: 'Email' }].map(ch => (<Badge key={ch.id} variant={selectedChannels.includes(ch.id as any) ? "default" : "outline"} className="cursor-pointer font-black uppercase h-7 px-3" onClick={() => setSelectedChannels(prev => prev.includes(ch.id as any) ? prev.filter(c => c !== ch.id) : [...prev, ch.id as any])}>{ch.label}</Badge>))}</div>
                                </div>
                                {pricing && selectedPromoIds.length > 0 && (
                                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-[10px] font-bold"><div className="flex justify-between"><span>Total Devis (x{selectedPromoIds.length})</span><span className="text-primary font-black">{totalCalculatedCost} FCFP</span></div></div>
                                )}
                                <Button onClick={startCampWizard} disabled={isSaving || !baseTargetCount || selectedPromoIds.length === 0} className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-black uppercase shadow-lg gap-2"><Megaphone className="size-4" /> Configurer Campagne IA</Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1">Votre Catalogue ({promotions?.length || 0})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isPromosLoading ? <Skeleton className="h-32 w-full" /> : promotions?.map(promo => (
                        <Card key={promo.id} className={cn("overflow-hidden border-2 shadow-sm flex h-32 transition-all cursor-pointer", selectedPromoIds.includes(promo.id) ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/30")} onClick={() => setSelectedPromoIds(prev => prev.includes(promo.id) ? prev.filter(pid => pid !== promo.id) : [...prev, promo.id])}>
                            <div className="w-8 bg-muted/30 border-r flex items-center justify-center shrink-0" onClick={e => e.stopPropagation()}><Checkbox checked={selectedPromoIds.includes(promo.id)} onCheckedChange={() => setSelectedPromoIds(prev => prev.includes(promo.id) ? prev.filter(pid => pid !== promo.id) : [...prev, promo.id])} /></div>
                            <div className="w-24 bg-muted/20 shrink-0 relative overflow-hidden flex items-center justify-center border-r">
                                {promo.imageUrl ? <img src={promo.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="size-6 opacity-20" />}
                                <Badge className={cn("absolute top-1 left-1 font-black text-[7px] uppercase", promo.promoType === 'Promo' ? "bg-red-600" : "bg-primary")}>{promo.promoType === 'Promo' ? 'Promo' : 'New'}</Badge>
                                {promo.isOutOfStock && <div className="absolute inset-0 bg-red-600/40 flex items-center justify-center"><span className="text-[8px] font-black text-white uppercase text-center">STOCK VIDE</span></div>}
                            </div>
                            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                <div className="space-y-1">
                                    <h4 className={cn("font-black uppercase text-xs truncate leading-none", promo.isOutOfStock && "line-through decoration-red-600")}>{promo.title}</h4>
                                    {promo.isOutOfStock ? <p className="text-[8px] font-black text-red-600 uppercase">Arrivage prévu le {promo.restockDate}</p> : <p className="text-[9px] text-muted-foreground line-clamp-2 italic">{promo.description}</p>}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={cn("font-black text-sm", promo.isOutOfStock ? "line-through opacity-40" : (promo.promoType === 'Promo' ? "text-red-600" : "text-primary"))}>{(promo.price || 0).toLocaleString('fr-FR').replace(/\s/g, ' ')} <span className="text-[8px]">CFP</span></span>
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="size-7 border rounded-full" onClick={() => handleEditPromotion(promo)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-destructive border rounded-full" onClick={() => handleDeletePromotion(promo.id)}><Trash2 className="size-3.5" /></Button></div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Assistant Product Wizard */}
      <Dialog open={wizardStep !== 'IDLE'} onOpenChange={(open) => !open && setWizardStep('IDLE')}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh] z-[170]">
            <DialogHeader className="p-6 bg-slate-900 text-white border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-3"><Wand2 className="size-6 text-primary" /> Magicien IA</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto p-6 bg-slate-50/50 scrollbar-hide">
                {wizardStep === 'INFO' && <div className="space-y-4 animate-in fade-in"><Label className="text-[10px] font-black uppercase opacity-60">Infos complémentaires</Label><Textarea placeholder="Garantie, arrivage direct..." value={aiAdditionalInfo} onChange={e => setAiAdditionalInfo(e.target.value)} className="min-h-[120px] border-2 bg-white" /></div>}
                {wizardStep === 'TONE' && <div className="grid gap-2 animate-in fade-in">{AVAILABLE_TONES.map(t => (<div key={t.id} onClick={() => setAiSelectedTone(t.id)} className={cn("p-4 rounded-2xl border-2 transition-all cursor-pointer", aiSelectedTone === t.id ? "bg-primary border-primary text-white" : "bg-white")}>
                    <p className="font-black uppercase text-[11px]">{t.label}</p><p className={cn("text-[9px] uppercase opacity-60", aiSelectedTone === t.id ? "text-white" : "text-muted-foreground")}>{t.desc}</p></div>))}</div>}
                {wizardStep === 'GENERATING' && <div className="py-20 text-center space-y-4"><RefreshCw className="size-16 text-primary animate-spin mx-auto" /><p className="font-black uppercase">Analyse vision en cours...</p></div>}
                {wizardStep === 'OPTIONS' && aiAnalysisResult && <div className="grid gap-4 animate-in fade-in">{aiAnalysisResult.commercialDescriptions.map((text, idx) => (<div key={idx} onClick={() => handleSelectOption(idx)} className="p-5 rounded-2xl border-2 bg-white hover:border-primary transition-all cursor-pointer italic text-xs leading-relaxed">"{text}"</div>))}</div>}
                {wizardStep === 'STRATEGY' && aiAnalysisResult && <div className="space-y-6 animate-in fade-in pb-10"><div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl flex items-center gap-3"><CheckCircle2 className="size-6 text-green-600" /><p className="text-xs font-black uppercase">Description validée !</p></div><div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-60">Conseil Marketing</p><p className="p-4 bg-white border-2 rounded-xl text-xs italic font-medium">"{aiAnalysisResult.marketingAdvice}"</p></div></div>}
            </div>
            <DialogFooter className="p-4 bg-white border-t shrink-0 flex flex-col gap-2">
                {wizardStep === 'INFO' && <Button onClick={() => setWizardStep('TONE')} className="w-full h-12 font-black uppercase">Suivant</Button>}
                {wizardStep === 'TONE' && <Button onClick={processAiAnalysis} className="w-full h-12 font-black uppercase">Analyser</Button>}
                {wizardStep === 'STRATEGY' && <Button onClick={() => setWizardStep('IDLE')} className="w-full h-12 font-black uppercase">Terminer</Button>}
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assistant Campagne IA */}
      <Dialog open={campWizardStep !== 'IDLE'} onOpenChange={(open) => !open && setCampWizardStep('IDLE')}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh] z-[170]">
            <DialogHeader className="p-6 bg-slate-900 text-white border-b shrink-0">
                <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-3"><Megaphone className="size-6 text-accent" /> Campagne IA</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto p-6 bg-slate-50/50 scrollbar-hide">
                {campWizardStep === 'TONE' && <div className="grid gap-2 animate-in fade-in">{AVAILABLE_TONES.map(t => (<div key={t.id} onClick={() => setCampTone(t.id)} className={cn("p-4 rounded-2xl border-2 transition-all cursor-pointer", campTone === t.id ? "bg-accent border-accent text-white" : "bg-white")}><p className="font-black uppercase text-[11px]">{t.label}</p></div>))}</div>}
                {campWizardStep === 'LENGTH' && <div className="grid gap-2 animate-in fade-in">{CAMPAIGN_LENGTHS.map(l => (<div key={l.id} onClick={() => setCampLength(l.id as any)} className={cn("p-4 rounded-2xl border-2 transition-all cursor-pointer", campLength === l.id ? "bg-accent border-accent text-white" : "bg-white")}><p className="font-black uppercase text-[11px]">{l.label}</p></div>))}</div>}
                {campWizardStep === 'GENERATING' && <div className="py-20 text-center"><RefreshCw className="size-16 text-accent animate-spin mx-auto" /></div>}
                {campWizardStep === 'SELECTION' && campProps && (
                    <div className="space-y-6 pb-10">
                        {selectedChannels.includes('SMS') && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2"><Smartphone className="size-3" /> Propositions SMS</p>
                                {campProps.smsPropositions?.map((t, i) => (<div key={i} onClick={() => setSelectedSmsIdx(i)} className={cn("p-3 rounded-xl border-2 text-xs cursor-pointer", selectedSmsIdx === i ? "bg-blue-50 border-blue-600" : "bg-white")}>"{t}"</div>))}
                            </div>
                        )}
                        {selectedChannels.includes('PUSH') && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Zap className="size-3" /> Propositions Push</p>
                                {campProps.pushPropositions?.map((t, i) => (
                                    <div key={i} onClick={() => setSelectedPushIdx(i)} className={cn("p-3 rounded-xl border-2 text-xs cursor-pointer", selectedPushIdx === i ? "bg-primary/5 border-primary" : "bg-white")}>"{t}"</div>
                                ))}
                            </div>
                        )}
                        {selectedChannels.includes('MAIL') && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-green-600 flex items-center gap-2"><Mail className="size-3" /> Propositions Email</p>
                                {campProps.mailPropositions?.map((t, i) => (
                                    <div key={i} onClick={() => setSelectedMailIdx(i)} className={cn("p-3 rounded-xl border-2 text-xs cursor-pointer", selectedMailIdx === i ? "bg-green-50 border-green-600" : "bg-white")}>
                                        <p className="font-black text-[10px] mb-1">OBJET : {t.subject}</p>
                                        <p className="opacity-70 line-clamp-2">{t.body}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {campWizardStep === 'PREVIEW' && (
                    <div className="space-y-4 pb-10">
                        <div className="p-4 bg-slate-50 border-2 border-dashed rounded-xl space-y-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase opacity-40">Devis final estimé</p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-black text-primary">{totalCalculatedCost.toLocaleString('fr-FR').replace(/\s/g, ' ')}</p>
                                    <span className="text-xs font-black uppercase opacity-60">FCFP</span>
                                </div>
                            </div>
                            <Button onClick={handleFinalDiffuse} className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase gap-3 shadow-xl text-base tracking-widest border-2 border-white/20">
                                <CreditCard className="size-6" /> PAIEMENT & ENVOI
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter className="p-4 bg-white border-t shrink-0 flex flex-col gap-2">
                {campWizardStep === 'TONE' && <Button onClick={() => setCampWizardStep('LENGTH')} className="w-full h-12 font-black uppercase">Suivant</Button>}
                {campWizardStep === 'LENGTH' && <Button onClick={processCampGeneration} className="w-full h-12 font-black uppercase">Générer les messages</Button>}
                {campWizardStep === 'SELECTION' && <Button onClick={handleConfirmSelections} className="w-full h-12 font-black uppercase">Aperçu Final & Devis</Button>}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}