
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
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Send, 
  DollarSign, 
  Users, 
  ShoppingBag, 
  Store, 
  Camera, 
  RefreshCw, 
  Percent, 
  Tag, 
  FileText, 
  ImageIcon, 
  X, 
  Info, 
  Pencil, 
  Save, 
  AlertCircle, 
  UserCircle, 
  BrainCircuit, 
  MapPin, 
  ChevronDown, 
  Globe, 
  Smartphone, 
  Mail, 
  Zap, 
  ChevronRight,
  ArrowLeft,
  Wand2,
  Copy,
  Check,
  CheckCircle2,
  LayoutTemplate,
  CreditCard
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { locations } from '@/lib/locations';
import { analyzeProduct } from '@/ai/flows/analyze-product-flow';
import { generateCampaignMessages } from '@/ai/flows/generate-campaign-messages-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AnalyzeProductOutput, GenerateCampaignOutput } from '@/ai/schemas';
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
type CampaignWizardStep = 'IDLE' | 'TONE' | 'LENGTH' | 'GENERATING' | 'SELECTION' | 'PREVIEW' | 'EDIT';

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
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
  const [selectedChannels, setSelectedChannels] = useState<('SMS' | 'PUSH' | 'MAIL')[]>(['PUSH', 'MAIL']);
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

  // Stock management fields
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [nextArrivalMonth, setNextArrivalMonth] = useState('Mars');
  const [nextArrivalYear, setNextArrivalYear] = useState('2025');

  // --- AI WIZARD STATES (Product) ---
  const [wizardStep, setWizardStep] = useState<WizardStep>('IDLE');
  const [aiAdditionalInfo, setAiAdditionalInfo] = useState('');
  const [aiSelectedTone, setAiSelectedTone] = useState('Commercial');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AnalyzeProductOutput | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);

  // --- AI CAMPAIGN WIZARD STATES ---
  const [campWizardStep, setCampWizardStep] = useState<CampaignWizardStep>('IDLE');
  const [campTone, setCampTone] = useState('Commercial');
  const [campLength, setCampLength] = useState<'Short' | 'Medium' | 'Long'>('Short');
  const [campProps, setCampProps] = useState<GenerateCampaignOutput | null>(null);
  
  const [selectedSmsIdx, setSelectedSmsIdx] = useState<number | null>(null);
  const [selectedPushIdx, setSelectedPushIdx] = useState<number | null>(null);
  const [selectedMailIdx, setSelectedMailIdx] = useState<number | null>(null);

  const [finalSms, setFinalSms] = useState('');
  const [finalPush, setFinalPush] = useState('');
  const [finalMailSubject, setFinalMailSubject] = useState('');
  const [finalMailBody, setFinalMailBody] = useState('');

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
                query(usersRef, where('lastSelectedLocation', 'in', selectedTargetCommunes.slice(0, 30)), where('subscribedCategories', 'array-contains', targetCategory)) :
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

  const startAiWizard = () => {
    if (!promoTitle || promoImages.length === 0) {
        toast({ variant: 'destructive', title: "Données manquantes", description: "Veuillez saisir un titre et ajouter au moins une photo." });
        return;
    }
    setWizardStep('INFO');
  };

  const processAiAnalysis = async () => {
    setWizardStep('GENERATING');
    try {
        const result = await analyzeProduct({
            title: promoTitle,
            type: promoType,
            category: promoCategory,
            photos: promoImages,
            price: parseFloat(promoPrice) || undefined,
            discountPercentage: calculatedDiscount || undefined,
            additionalInfo: aiAdditionalInfo,
            tone: aiSelectedTone
        });
        setAiAnalysisResult(result);
        setWizardStep('OPTIONS');
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur IA", description: "L'analyse a échoué." });
        setWizardStep('TONE');
    }
  };

  const handleSelectOption = (idx: number) => {
    if (!aiAnalysisResult) return;
    setSelectedOptionIdx(idx);
    setPromoDescription(aiAnalysisResult.commercialDescriptions[idx]);
    setWizardStep('STRATEGY');
  };

  const handleSavePromotion = () => {
    if (!firestore || !business || !promoTitle || !promoCategory) return;
    setIsSaving(true);
    
    const priceNum = parseFloat(promoPrice) || 0;
    const originalPriceNum = parseFloat(originalPrice) || null;
    const discount = (originalPriceNum && originalPriceNum > priceNum) ? ((originalPriceNum - priceNum) / originalPriceNum) * 100 : null;

    const promoData: any = {
      businessId: business.id, 
      title: promoTitle, 
      category: promoCategory, 
      description: promoDescription,
      price: priceNum, 
      originalPrice: originalPriceNum, 
      discountPercentage: discount, 
      promoType,
      imageUrl: promoImages[0] || '', 
      images: promoImages, 
      isOutOfStock,
      nextArrival: isOutOfStock ? `${nextArrivalMonth} ${nextArrivalYear}` : null,
      updatedAt: serverTimestamp(),
    };

    const targetDoc = editingPromoId 
      ? doc(firestore, 'businesses', business.id, 'promotions', editingPromoId)
      : doc(collection(firestore, 'businesses', business.id, 'promotions'));

    const operation = editingPromoId ? 'update' : 'create';
    if (!editingPromoId) promoData.createdAt = serverTimestamp();

    setDoc(targetDoc, promoData, { merge: true })
      .then(() => {
        toast({ title: editingPromoId ? "Article mis à jour !" : "Article enregistré !" });
        resetForm();
        setIsSaving(false);
      })
      .catch(async (err) => {
        setIsSaving(false);
        const permissionError = new FirestorePermissionError({
          path: targetDoc.path,
          operation: operation as any,
          requestResourceData: promoData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
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
    setIsOutOfStock(false);
    setNextArrivalMonth('Mars');
    setNextArrivalYear('2025');
    setWizardStep('IDLE');
    setAiAdditionalInfo('');
    setAiSelectedTone('Commercial');
    setAiAnalysisResult(null);
    setSelectedOptionIdx(null);
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
    setIsOutOfStock(promo.isOutOfStock || false);
    if (promo.nextArrival) {
        const parts = promo.nextArrival.split(' ');
        if (parts.length === 2) {
            setNextArrivalMonth(parts[0]);
            setNextArrivalYear(parts[1]);
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePromotion = (id: string) => {
    if (!firestore || !business) return;
    const promoRef = doc(firestore, 'businesses', business.id, 'promotions', id);
    deleteDoc(promoRef)
      .then(() => {
        toast({ title: "Article supprimé" });
      })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: promoRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  // --- CAMPAIGN WIZARD LOGIC ---
  const startCampWizard = () => {
    if (selectedPromoIds.length === 0) {
        toast({ variant: 'destructive', title: "Sélection vide", description: "Choisissez au moins un article à promouvoir." });
        return;
    }
    setCampWizardStep('TONE');
  };

  const processCampGeneration = async () => {
    setCampWizardStep('GENERATING');
    try {
        const selectedPromos = promotions?.filter(p => selectedPromoIds.includes(p.id)) || [];
        const result = await generateCampaignMessages({
            businessName: business!.name,
            products: selectedPromos.map(p => ({
                title: p.title,
                description: p.description || '',
                type: p.promoType,
                price: p.price,
                discount: p.discountPercentage || undefined
            })),
            channels: selectedChannels,
            tone: campTone,
            length: campLength
        });
        setCampProps(result);
        setCampWizardStep('SELECTION');
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur IA", description: "La génération de campagne a échoué." });
        setCampWizardStep('LENGTH');
    }
  };

  const handleConfirmSelections = () => {
    if (selectedChannels.includes('SMS') && selectedSmsIdx !== null) {
        setFinalSms(campProps!.smsPropositions![selectedSmsIdx]);
    }
    if (selectedChannels.includes('PUSH') && selectedPushIdx !== null) {
        setFinalPush(campProps!.pushPropositions![selectedPushIdx]);
    }
    if (selectedChannels.includes('MAIL') && selectedMailIdx !== null) {
        setFinalMailSubject(campProps!.mailPropositions![selectedMailIdx].subject);
        setFinalMailBody(campProps!.mailPropositions![selectedMailIdx].body);
    }
    setCampWizardStep('PREVIEW');
  };

  const handleFinalDiffuse = (isDraft = false) => {
    if (!firestore || !business || !user) return;
    setIsSaving(true);
    
    const campaignData: any = {
      ownerId: user.uid, 
      businessId: business.id, 
      businessName: business.name,
      title: finalMailSubject || `${business.name} : Nouvelles offres`,
      message: finalPush || finalSms || "Découvrez nos offres !",
      smsContent: finalSms || null,
      pushContent: finalPush || null,
      mailSubject: finalMailSubject || null,
      mailBody: finalMailBody || null,
      targetCommune: targetScope === 'ALL' ? 'GLOBAL' : (targetScope === 'SPECIFIC' ? selectedTargetCommunes.join(', ') : targetScope),
      targetCategory, 
      reach: baseTargetCount, 
      cost: totalCalculatedCost, 
      status: isDraft ? 'draft' : 'pending', 
      createdAt: serverTimestamp(), 
      selectedChannels,
      promotedPromoIds: selectedPromoIds
    };

    const campaignRef = collection(firestore, 'campaigns');
    addDoc(campaignRef, campaignData)
      .then(() => {
        toast({ 
            title: isDraft ? "Brouillon sauvegardé" : "Campagne envoyée !", 
            description: isDraft ? "Vous pourrez la modifier plus tard." : "L'admin validera votre envoi sous 24h." 
        });
        setCampWizardStep('IDLE');
        setSelectedPromoIds([]);
        setIsSaving(false);
      })
      .catch(async (err) => {
        setIsSaving(false);
        const permissionError = new FirestorePermissionError({
          path: campaignRef.path,
          operation: 'create',
          requestResourceData: campaignData,
        });
        errorEmitter.emit('permission-error', permissionError);
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
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] border-2 bg-white" onClick={handleCopyUid}>{hasCopiedUid ? <Check className="size-3" /> : <Copy className="size-3" />}</Button>
            </div>
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
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-black uppercase flex items-center gap-2"><ShoppingBag className="size-4" /> {editingPromoId ? "Mise à jour" : "Nouveau Produit"}</h3>
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
                                onChange={e => setPromoPrice(e.target.value)} 
                                className={cn(
                                    "font-black text-lg border-2 h-12 transition-all",
                                    calculatedDiscount ? "border-red-200 bg-red-50 text-red-600 ring-2 ring-red-100" : "bg-white"
                                )} 
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-red-50/50 border-2 border-dashed border-red-200 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-[10px] font-black uppercase text-red-800">Stock vide</Label>
                                <p className="text-[8px] font-bold text-red-600/60 uppercase italic">Marquer comme indisponible</p>
                            </div>
                            <Switch checked={isOutOfStock} onCheckedChange={setIsOutOfStock} />
                        </div>

                        {isOutOfStock && (
                            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <Label className="text-[9px] font-black uppercase text-red-800 ml-1">Prochain arrivage prévu</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={nextArrivalMonth} onValueChange={setNextArrivalMonth}>
                                        <SelectTrigger className="h-10 border-2 font-bold text-xs bg-white text-slate-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTHS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={nextArrivalYear} onValueChange={setNextArrivalYear}>
                                        <SelectTrigger className="h-10 border-2 font-bold text-xs bg-white text-slate-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {YEARS.map(y => <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Photos (Max 4)</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {promoImages.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl border-2 overflow-hidden bg-muted"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setPromoImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="size-3" /></button></div>
                            ))}
                            {promoImages.length < 4 && (
                                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 hover:bg-primary/5 transition-colors gap-1">
                                    <Plus className="size-4" />
                                    <span className="text-[7px] font-black uppercase">Galerie</span>
                                </button>
                            )}
                            {promoImages.length < 4 && (
                                <button onClick={() => cameraInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 hover:bg-primary/5 transition-colors gap-1">
                                    <Camera className="size-4" />
                                    <span className="text-[7px] font-black uppercase">Appareil</span>
                                </button>
                            )}
                        </div>
                        <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileChange} />
                    </div>

                    <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between items-center mb-1">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Description commerciale</Label>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[8px] font-black uppercase border-primary/30 text-primary bg-primary/5 gap-1.5 shadow-sm"
                                onClick={startAiWizard}
                                disabled={!promoTitle || promoImages.length === 0}
                            >
                                <Wand2 className="size-2.5" /> Assistant Magicien IA
                            </Button>
                        </div>
                        <Textarea 
                            value={promoDescription} 
                            onChange={e => setPromoDescription(e.target.value)} 
                            className="font-medium border-2 min-h-[100px] text-sm" 
                            placeholder="Décrivez votre offre ou utilisez l'Assistant Magicien IA..."
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        {editingPromoId && <Button variant="ghost" onClick={resetForm} className="flex-1 border-2">Annuler</Button>}
                        <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle || !business} className="flex-[2] h-12 font-black uppercase shadow-lg">Sauvegarder l'article</Button>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed space-y-6">
                    <h3 className="text-sm font-black uppercase flex items-center gap-2 text-accent"><Megaphone className="size-4" /> Ciblage & Audiences</h3>
                    <div className="space-y-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Rayon cible</Label><Select value={targetCategory} onValueChange={setTargetCategory}><SelectTrigger className="h-10 border-2 bg-background font-black text-xs"><SelectValue /></SelectTrigger><SelectContent>{MAIN_CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-black text-xs uppercase">{cat}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Portée géographique</Label>
                            <Select value={targetScope} onValueChange={(v: any) => setTargetScope(v)}>
                                <SelectTrigger className="h-10 border-2 bg-background font-black text-xs">
                                    <Globe className="size-3 mr-2 text-primary" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SPECIFIC">Communes spécifiques</SelectItem>
                                    <SelectItem value="CALEDONIE">Nouvelle-Calédonie</SelectItem>
                                    <SelectItem value="TAHITI">Tahiti</SelectItem>
                                    <SelectItem value="ALL">Tout le réseau</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {targetScope === 'SPECIFIC' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Sélection des communes (Max 30)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-10 border-2 bg-background justify-between font-bold text-xs">
                                            <div className="flex items-center gap-2 truncate"><MapPin className="size-3 text-primary" />{selectedTargetCommunes.length === 0 ? "Aucune commune" : selectedTargetCommunes.length === 1 ? selectedTargetCommunes[0] : `${selectedTargetCommunes.length} communes`}</div>
                                            <ChevronDown className="size-3 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <div className="p-3 border-b bg-slate-50/50"><p className="text-[10px] font-black uppercase tracking-tight">Sélecteur de communes</p></div>
                                        <div className="p-2 border-b"><Input placeholder="Filtrer..." className="h-8 text-xs" value={communeSearch} onChange={(e) => setCommuneSearch(e.target.value)} /></div>
                                        <ScrollArea className="h-[250px]"><div className="p-2 space-y-1">{filteredCommuneList.map(name => (<div key={name} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded cursor-pointer transition-colors" onClick={() => { setSelectedTargetCommunes(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name].slice(0, 30)); }}><Checkbox id={`check-${name}`} checked={selectedTargetCommunes.includes(name)} /><span className="text-xs font-bold uppercase">{name}</span></div>))}</div></ScrollArea>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Audiences Réelles :</p><div className="flex items-center gap-1.5"><span className="text-[8px] font-black uppercase text-muted-foreground">Potentiel Zone:</span><Badge variant="secondary" className="h-4 text-[9px] font-black">{isCalculatingReach ? '...' : `${baseTargetCount ?? 0}`}</Badge></div></div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className={cn("p-3 rounded-xl border-2 flex items-center justify-between transition-all", selectedChannels.includes('PUSH') ? "bg-primary/10 border-primary/30" : "bg-background opacity-50")}>
                                    <div className="flex items-center gap-2"><Zap className="size-4 text-primary" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase leading-none">Push Notifications</span><span className="text-[8px] font-bold opacity-60 uppercase">Opt-in valide</span></div></div>
                                    <span className="font-black text-xs">{isCalculatingReach ? <RefreshCw className="size-3 animate-spin text-primary"/> : `${pushTargetCount ?? 0} client${(pushTargetCount ?? 0) > 1 ? 's' : ''}`}</span>
                                </div>
                                <div className={cn("p-3 rounded-xl border-2 flex items-center justify-between transition-all", selectedChannels.includes('MAIL') ? "bg-green-50 border-green-200" : "bg-background opacity-50")}>
                                    <div className="flex items-center gap-2"><Mail className="size-4 text-green-600" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase leading-none">Newsletter Email</span><span className="text-[8px] font-bold opacity-60 uppercase">Opt-in valide</span></div></div>
                                    <span className="font-black text-xs">{isCalculatingReach ? <RefreshCw className="size-3 animate-spin text-green-600"/> : `${mailTargetCount ?? 0} client${(mailTargetCount ?? 0) > 1 ? 's' : ''}`}</span>
                                </div>
                                <div className={cn("p-3 rounded-xl border-2 flex items-center justify-between transition-all", selectedChannels.includes('SMS') ? "bg-blue-50 border-blue-200" : "bg-background opacity-50")}>
                                    <div className="flex items-center gap-2"><Smartphone className="size-4 text-blue-600" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase leading-none">Alerte SMS</span><span className="text-[8px] font-bold opacity-60 uppercase">Mobile renseigné</span></div></div>
                                    <span className="font-black text-xs">{isCalculatingReach ? <RefreshCw className="size-3 animate-spin text-blue-600"/> : `${smsTargetCount ?? 0} client${(smsTargetCount ?? 0) > 1 ? 's' : ''}`}</span>
                                </div>
                            </div>
                            {reachError && <p className="text-[8px] font-bold text-red-500 text-center uppercase animate-pulse">Erreur de calcul. Sélectionnez une zone.</p>}
                        </div>

                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Canaux souhaités</Label><div className="flex flex-wrap gap-2">{[{ id: 'SMS', label: 'SMS' }, { id: 'PUSH', label: 'Push' }, { id: 'MAIL', label: 'Email' }].map(ch => (<Badge key={ch.id} variant={selectedChannels.includes(ch.id as any) ? "default" : "outline"} className="cursor-pointer font-black uppercase h-8 px-3 border-2" onClick={() => setSelectedChannels(prev => prev.includes(ch.id as any) ? prev.filter(c => c !== ch.id) : [...prev, ch.id as any])}>{ch.label}</Badge>))}</div></div>

                        {pricing && selectedPromoIds.length > 0 && !isCalculatingReach && (
                            <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl space-y-3 animate-in fade-in"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><DollarSign className="size-3" /> Devis (x{selectedPromoIds.length} article{selectedPromoIds.length > 1 ? 's' : ''})</p><div className="space-y-1.5 text-[11px] font-bold text-slate-600"><div className="flex justify-between"><span className="opacity-60">Frais fixes (Campagne)</span><span>{pricing.fixedPrice} F</span></div><div className="flex justify-between border-t border-dashed pt-1 mt-1"><span className="opacity-60">Base Reach ({baseTargetCount} {baseTargetCount !== null && baseTargetCount > 1 ? 'utilisateurs' : 'utilisateur'} x {pricing.unitPricePerUser}F)</span><span>{Math.round((baseTargetCount || 0) * pricing.unitPricePerUser * selectedPromoIds.length)} F</span></div>{selectedChannels.includes('SMS') && <div className="flex justify-between text-blue-600"><span>Canal SMS ({smsTargetCount} x {pricing.priceSMS}F)</span><span>{Math.round((smsTargetCount || 0) * (pricing.priceSMS || 0) * selectedPromoIds.length)} F</span></div>}{selectedChannels.includes('PUSH') && <div className="flex justify-between text-primary"><span>Canal Push ({pushTargetCount} x {pricing.pricePush}F)</span><span>{Math.round((pushTargetCount || 0) * (pricing.pricePush || 0) * selectedPromoIds.length)} F</span></div>}{selectedChannels.includes('MAIL') && <div className="flex justify-between text-green-600"><span>Canal Email ({mailTargetCount} x {pricing.priceMail}F)</span><span>{Math.round((mailTargetCount || 0) * (pricing.priceMail || 0) * selectedPromoIds.length)} F</span></div>}<div className="flex justify-between items-center bg-primary/10 p-3 rounded-xl border border-primary/20 mt-3"><span className="text-[10px] font-black uppercase text-primary">Total estimé</span><span className="textxl text-primary font-black">{totalCalculatedCost} FCFP</span></div></div></div>
                        )}

                        <Button onClick={startCampWizard} disabled={isSaving || !baseTargetCount || selectedChannels.length === 0 || selectedPromoIds.length === 0} className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black uppercase shadow-lg gap-2"><Megaphone className="size-5" /> Configurer la campagne (IA)</Button>
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
                        <div className="w-8 bg-muted/30 border-r flex items-center justify-center shrink-0" onClick={e => e.stopPropagation()}><Checkbox checked={selectedPromoIds.includes(promo.id)} onCheckedChange={() => setSelectedPromoIds(prev => prev.includes(promo.id) ? prev.filter(pid => pid !== promo.id) : [...prev, promo.id])} /></div>
                        <div className="w-24 bg-muted/20 shrink-0 relative overflow-hidden flex items-center justify-center border-r">
                            {promo.imageUrl ? (
                                <img src={promo.imageUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <ImageIcon className="size-6 opacity-20" />
                            )}
                            <Badge className={cn(
                                "absolute top-1 left-1 font-black text-[7px] uppercase border-none shadow-md px-1.5 h-4",
                                promo.promoType === 'Promo' ? "bg-red-600" : "bg-primary"
                            )}>
                                {promo.promoType === 'Promo' ? 'Promo' : 'New'}
                            </Badge>
                            {promo.isOutOfStock && (
                                <div className="absolute inset-0 bg-red-600/40 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-white uppercase text-center leading-tight">STOCK VIDE</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-black uppercase text-xs truncate flex-1 leading-none">{promo.title}</h4>
                                    {promo.discountPercentage && <Badge variant="destructive" className="h-3.5 px-1 text-[7px] font-black">-{Math.round(promo.discountPercentage)}%</Badge>}
                                </div>
                                <p className="text-[9px] text-muted-foreground line-clamp-2 italic">{promo.description || "Pas de description."}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={cn(
                                    "font-black text-sm tracking-tight",
                                    promo.promoType === 'Promo' ? "text-red-600" : "text-primary"
                                )}>
                                    {promo.price.toLocaleString('fr-FR').replace(/\s/g, ' ')} <span className="text-[8px] uppercase opacity-60">CFP</span>
                                </span>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon" className="size-7 border rounded-full" onClick={() => handleEditPromotion(promo)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-destructive border rounded-full" onClick={() => handleDeletePromotion(promo.id)}><Trash2 className="size-3.5" /></Button></div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
          </div>

          <Dialog open={wizardStep !== 'IDLE'} onOpenChange={(open) => !open && setWizardStep('IDLE')}>
            <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10 shrink-0">
                    <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-3">
                        <Wand2 className="size-6 text-primary" /> Assistant Magicien IA
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-[10px] font-bold uppercase mt-1">
                        Créez une annonce percutante en quelques clics
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow overflow-y-auto p-6 bg-slate-50/50 scrollbar-hide">
                    {wizardStep === 'INFO' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Infos supplémentaires (Optionnel)</Label>
                                <Textarea 
                                    placeholder="Ex: Arrivage direct, Garantie 2 ans, Quantité limitée..." 
                                    value={aiAdditionalInfo} 
                                    onChange={e => setAiAdditionalInfo(e.target.value)}
                                    className="min-h-[120px] border-2 font-medium bg-white"
                                />
                                <p className="text-[9px] font-bold text-muted-foreground italic px-1">L'IA utilisera ces détails pour enrichir votre annonce.</p>
                            </div>
                        </div>
                    )}

                    {wizardStep === 'TONE' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Quel ton doit utiliser l'IA ?</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {AVAILABLE_TONES.map(tone => (
                                    <div 
                                        key={tone.id} 
                                        onClick={() => setAiSelectedTone(tone.id)}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 transition-all cursor-pointer select-none",
                                            aiSelectedTone === tone.id ? "bg-primary border-primary text-white shadow-md scale-[1.02]" : "bg-white border-slate-100 hover:border-primary/20"
                                        )}
                                    >
                                        <p className="font-black uppercase text-[11px]">{tone.label}</p>
                                        <p className={cn("text-[9px] font-medium uppercase opacity-60", aiSelectedTone === tone.id ? "text-white" : "text-muted-foreground")}>{tone.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {wizardStep === 'GENERATING' && (
                        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                            <div className="relative">
                                <RefreshCw className="size-16 text-primary animate-spin" />
                                <BrainCircuit className="size-8 text-slate-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-black uppercase tracking-tighter text-xl">Le magicien travaille...</h3>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Analyse des visuels et rédaction des variantes</p>
                            </div>
                        </div>
                    )}

                    {wizardStep === 'OPTIONS' && aiAnalysisResult && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Choisissez la meilleure variante :</Label>
                            <div className="grid grid-cols-1 gap-4">
                                {aiAnalysisResult.commercialDescriptions.map((text, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => handleSelectOption(idx)}
                                        className="group p-5 rounded-2xl border-2 bg-white hover:border-primary/40 transition-all cursor-pointer relative shadow-sm"
                                    >
                                        <div className="absolute -top-3 -left-3 size-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">{idx + 1}</div>
                                        <p className="text-xs font-medium leading-relaxed text-slate-700 italic">"{text}"</p>
                                        <div className="mt-4 pt-4 border-t border-dashed flex justify-end">
                                            <span className="text-[9px] font-black uppercase text-primary flex items-center gap-1 group-hover:gap-2 transition-all">Valider ce texte <ChevronRight className="size-3" /></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {wizardStep === 'STRATEGY' && aiAnalysisResult && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl flex items-center gap-3">
                                <CheckCircle2 className="size-6 text-green-600 shrink-0" />
                                <p className="text-xs font-black uppercase text-green-800">Description validée avec succès !</p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 px-1">
                                    <Zap className="size-3 text-accent" /> Arguments de vente clés
                                </p>
                                <div className="grid gap-2">
                                    {aiAnalysisResult.sellingPoints.map((point, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-xl border shadow-sm">
                                            <div className="size-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{idx + 1}</div>
                                            <p className="text-xs font-bold text-slate-700 leading-snug">{point}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 bg-white border-2 border-dashed border-accent/20 rounded-2xl space-y-2 shadow-inner">
                                <p className="text-[10px] font-black uppercase text-accent flex items-center gap-2">
                                    <BrainCircuit className="size-3" /> Conseil Marketing IA
                                </p>
                                <p className="text-xs font-medium leading-relaxed italic text-slate-600">"{aiAnalysisResult.marketingAdvice}"</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 bg-white border-t shrink-0 flex flex-col gap-2">
                    {wizardStep === 'INFO' && (
                        <div className="flex gap-2 w-full">
                            <Button variant="ghost" onClick={() => setWizardStep('IDLE')} className="flex-1 font-bold uppercase text-[10px]">Annuler</Button>
                            <Button onClick={() => setWizardStep('TONE')} className="flex-[2] h-12 font-black uppercase tracking-widest shadow-lg gap-2">
                                Suivant <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    )}
                    {wizardStep === 'TONE' && (
                        <div className="flex gap-2 w-full">
                            <Button variant="ghost" onClick={() => setWizardStep('INFO')} className="flex-1 font-bold uppercase text-[10px] border-2">Retour</Button>
                            <Button onClick={processAiAnalysis} className="flex-[2] h-12 font-black uppercase tracking-widest shadow-lg gap-2">
                                Analyser <Wand2 className="size-4" />
                            </Button>
                        </div>
                    )}
                    {wizardStep === 'OPTIONS' && (
                        <Button variant="ghost" onClick={() => setWizardStep('TONE')} className="w-full font-bold uppercase text-[10px] gap-2">
                            <ArrowLeft className="size-3" /> Retour au choix du ton
                        </Button>
                    )}
                    {wizardStep === 'STRATEGY' && (
                        <Button onClick={() => setWizardStep('IDLE')} className="w-full h-12 font-black uppercase tracking-widest shadow-lg">
                            Terminer le Magicien
                        </Button>
                    )}
                    {wizardStep !== 'GENERATING' && wizardStep !== 'STRATEGY' && (
                        <Button variant="ghost" onClick={() => setWizardStep('IDLE')} className="w-full font-black uppercase text-[9px] h-8 opacity-40">Quitter l'assistant</Button>
                    )}
                </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* --- CAMPAIGN AI WIZARD DIALOG --- */}
          <Dialog open={campWizardStep !== 'IDLE'} onOpenChange={(open) => !open && setCampWizardStep('IDLE')}>
            <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10 shrink-0">
                    <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-3">
                        <Megaphone className="size-6 text-accent" /> Assistant Campagne IA
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-[10px] font-bold uppercase mt-1">
                        Générez vos messages optimisés par canal
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow overflow-y-auto p-6 bg-slate-50/50 scrollbar-hide">
                    {campWizardStep === 'TONE' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Ton de la campagne</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {AVAILABLE_TONES.map(tone => (
                                    <div 
                                        key={tone.id} 
                                        onClick={() => setCampTone(tone.id)}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 transition-all cursor-pointer select-none",
                                            campTone === tone.id ? "bg-accent border-accent text-white shadow-md scale-[1.02]" : "bg-white border-slate-100 hover:border-primary/20"
                                        )}
                                    >
                                        <p className="font-black uppercase text-[11px]">{tone.label}</p>
                                        <p className={cn("text-[9px] font-medium uppercase opacity-60", campTone === tone.id ? "text-white" : "text-muted-foreground")}>{tone.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {campWizardStep === 'LENGTH' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Longueur souhaitée</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {CAMPAIGN_LENGTHS.map(len => (
                                    <div 
                                        key={len.id} 
                                        onClick={() => setCampLength(len.id as any)}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 transition-all cursor-pointer select-none",
                                            campLength === len.id ? "bg-accent border-accent text-white shadow-md scale-[1.02]" : "bg-white border-slate-100 hover:border-primary/20"
                                        )}
                                    >
                                        <p className="font-black uppercase text-[11px]">{len.label}</p>
                                        <p className={cn("text-[9px] font-medium uppercase opacity-60", campLength === len.id ? "text-white" : "text-muted-foreground")}>{len.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <Alert className="bg-primary/5 border-dashed border-2">
                                <Info className="size-4 text-primary" />
                                <AlertDescription className="text-[10px] leading-relaxed font-medium">L'IA adaptera cette longueur selon les contraintes de chaque canal (ex: SMS toujours court).</AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {campWizardStep === 'GENERATING' && (
                        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                            <RefreshCw className="size-16 text-accent animate-spin" />
                            <div className="space-y-2">
                                <h3 className="font-black uppercase tracking-tighter text-xl">Rédaction multi-canaux...</h3>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Génération de 5 propositions par canal</p>
                            </div>
                        </div>
                    )}

                    {campWizardStep === 'SELECTION' && campProps && (
                        <div className="space-y-8 pb-10">
                            {selectedChannels.includes('SMS') && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><Smartphone className="size-3" /> Choisissez votre SMS</p>
                                    <div className="flex flex-col gap-2">
                                        {campProps.smsPropositions?.map((text, i) => (
                                            <div key={i} onClick={() => setSelectedSmsIdx(i)} className={cn("p-3 rounded-xl border-2 text-xs font-medium cursor-pointer transition-all", selectedSmsIdx === i ? "bg-blue-50 border-blue-600 shadow-md" : "bg-white border-slate-100")}>
                                                "{text}"
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedChannels.includes('PUSH') && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Zap className="size-3" /> Choisissez votre Push</p>
                                    <div className="flex flex-col gap-2">
                                        {campProps.pushPropositions?.map((text, i) => (
                                            <div key={i} onClick={() => setSelectedPushIdx(i)} className={cn("p-3 rounded-xl border-2 text-xs font-medium cursor-pointer transition-all", selectedPushIdx === i ? "bg-primary/5 border-primary shadow-md" : "bg-white border-slate-100")}>
                                                "{text}"
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedChannels.includes('MAIL') && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-green-600 tracking-widest flex items-center gap-2"><Mail className="size-3" /> Choisissez votre Mail</p>
                                    <div className="flex flex-col gap-2">
                                        {campProps.mailPropositions?.map((mail, i) => (
                                            <div key={i} onClick={() => setSelectedMailIdx(i)} className={cn("p-3 rounded-xl border-2 text-xs font-medium cursor-pointer transition-all", selectedMailIdx === i ? "bg-green-50 border-green-600 shadow-md" : "bg-white border-slate-100")}>
                                                <p className="font-black uppercase text-[9px] mb-1">Objet : {mail.subject}</p>
                                                <p className="line-clamp-2 italic opacity-70">"{mail.body}"</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {campWizardStep === 'PREVIEW' && (
                        <div className="space-y-6 pb-10">
                            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-2xl flex items-center gap-3">
                                <CheckCircle2 className="size-6 text-green-600 shrink-0" />
                                <p className="text-xs font-black uppercase text-green-800">Messages prêts pour diffusion !</p>
                            </div>
                            
                            <div className="space-y-4">
                                {selectedChannels.includes('SMS') && (
                                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-blue-600 ml-1">Aperçu SMS</Label><div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed font-medium text-xs italic">"{finalSms}"</div></div>
                                )}
                                {selectedChannels.includes('PUSH') && (
                                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary ml-1">Aperçu Push</Label><div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed font-medium text-xs italic">"{finalPush}"</div></div>
                                )}
                                {selectedChannels.includes('MAIL') && (
                                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-green-600 ml-1">Aperçu Mail</Label><div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed space-y-2"><p className="font-black text-[10px] uppercase border-b pb-1">Objet : {finalMailSubject}</p><p className="font-medium text-xs italic leading-relaxed">"{finalMailBody}"</p></div></div>
                                )}
                            </div>
                        </div>
                    )}

                    {campWizardStep === 'EDIT' && (
                        <div className="space-y-6 pb-10">
                            <p className="text-[10px] font-black uppercase text-muted-foreground text-center">Édition manuelle des textes</p>
                            {selectedChannels.includes('SMS') && (
                                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Texte SMS</Label><Textarea value={finalSms} onChange={e => setFinalSms(e.target.value)} className="border-2 font-medium" /></div>
                            )}
                            {selectedChannels.includes('PUSH') && (
                                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Texte Push</Label><Textarea value={finalPush} onChange={e => setFinalPush(e.target.value)} className="border-2 font-medium" /></div>
                            )}
                            {selectedChannels.includes('MAIL') && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Objet Mail</Label><Input value={finalMailSubject} onChange={e => setFinalMailSubject(e.target.value)} className="border-2 font-bold" /></div>
                                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Corps Mail</Label><Textarea value={finalMailBody} onChange={e => setFinalMailBody(e.target.value)} className="border-2 font-medium min-h-[150px]" /></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 bg-white border-t shrink-0 flex flex-col gap-2">
                    {campWizardStep === 'TONE' && (
                        <div className="flex gap-2 w-full">
                            <Button variant="ghost" onClick={() => setCampWizardStep('IDLE')} className="flex-1 font-bold uppercase text-[10px]">Annuler</Button>
                            <Button onClick={() => setCampWizardStep('LENGTH')} className="flex-[2] h-12 font-black uppercase tracking-widest shadow-lg gap-2">Suivant <ChevronRight className="size-4" /></Button>
                        </div>
                    )}
                    {campWizardStep === 'LENGTH' && (
                        <div className="flex gap-2 w-full">
                            <Button variant="ghost" onClick={() => setCampTone(tone => tone)} className="flex-1 font-bold uppercase text-[10px] border-2">Retour</Button>
                            <Button onClick={processCampGeneration} className="flex-[2] h-12 font-black uppercase tracking-widest shadow-lg gap-2">Généner les variantes <Wand2 className="size-4" /></Button>
                        </div>
                    )}
                    {campWizardStep === 'SELECTION' && (
                        <div className="flex gap-2 w-full">
                            <Button variant="ghost" onClick={() => setCampWizardStep('LENGTH')} className="flex-1 font-bold uppercase text-[10px] border-2">Retour</Button>
                            <Button onClick={handleConfirmSelections} className="flex-[2] h-12 font-black uppercase tracking-widest shadow-lg gap-2">Valider mes choix <ChevronRight className="size-4" /></Button>
                        </div>
                    )}
                    {campWizardStep === 'PREVIEW' && (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" onClick={() => setCampWizardStep('EDIT')} className="h-12 font-black uppercase text-[10px] border-2 gap-2"><Pencil className="size-3" /> Éditer textes</Button>
                                <Button variant="secondary" onClick={() => handleFinalDiffuse(true)} className="h-12 font-black uppercase text-[10px] border-2 gap-2"><Save className="size-3" /> Sauver plus tard</Button>
                            </div>
                            <Button onClick={() => handleFinalDiffuse(false)} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base gap-3 bg-accent hover:bg-accent/90">
                                <CreditCard className="size-6" /> PAIEMENT & ENVOI
                            </Button>
                        </div>
                    )}
                    {campWizardStep === 'EDIT' && (
                        <Button onClick={() => setCampWizardStep('PREVIEW')} className="w-full h-12 font-black uppercase tracking-widest shadow-lg">Enregistrer modifications</Button>
                    )}
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
