'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, serverTimestamp, addDoc, deleteDoc, where, getCountFromServer, updateDoc } from 'firebase/firestore';
import type { UserAccount, Business, Promotion, Campaign, CampaignPricingSettings, Region } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Save, 
  Store, 
  RefreshCw, 
  ImageIcon, 
  X, 
  Pencil, 
  BrainCircuit, 
  Sparkles,
  Wand2,
  Check,
  Copy,
  AlertCircle,
  Megaphone,
  Users,
  Target,
  Send,
  ChevronRight,
  Smartphone,
  Mail,
  Zap,
  DollarSign,
  History,
  LayoutGrid,
  MapPin,
  Globe
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { analyzeProduct } from '@/ai/flows/analyze-product-flow';
import { generateCampaignMessages } from '@/ai/flows/generate-campaign-messages-flow';
import type { AnalyzeProductOutput, GenerateCampaignOutput } from '@/ai/schemas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { locationsByRegion, regions } from '@/lib/locations';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AVAILABLE_TONES = [
    { id: 'Local (Caillou)', label: 'Local (Caillou)', desc: 'Parle au coeur des gens du pays' },
    { id: 'Commercial', label: 'Commercial', desc: 'Dynamique et vendeur' },
    { id: 'Humoristique', label: 'Humoristique', desc: 'Léger et complice' },
];

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const YEARS = ["2025", "2026", "2027", "2028"];

export default function ProDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('inventory');

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !profile?.businessId) return null;
    return doc(firestore, 'businesses', profile.businessId);
  }, [firestore, profile?.businessId]);
  const { data: business } = useDoc<Business>(businessRef);

  const promosRef = useMemoFirebase(() => {
    if (!firestore || !business?.id) return null;
    return query(collection(firestore, 'businesses', business.id, 'promotions'), orderBy('createdAt', 'desc'));
  }, [firestore, business?.id]);
  const { data: promotions } = useCollection<Promotion>(promosRef);

  const campaignsRef = useMemoFirebase(() => {
    if (!firestore || !business?.id) return null;
    return query(collection(firestore, 'campaigns'), where('businessId', '==', business.id), orderBy('createdAt', 'desc'));
  }, [firestore, business?.id]);
  const { data: campaigns } = useCollection<Campaign>(campaignsRef);

  const pricingRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'campaign_pricing');
  }, [firestore]);
  const { data: pricing } = useDoc<CampaignPricingSettings>(pricingRef);

  // --- INVENTORY FORM STATE ---
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCategory, setPromoCategory] = useState('Pêche');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [promoImages, setPromoImages] = useState<string[]>([]);
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [nextArrivalMonth, setNextArrivalMonth] = useState('Mars');
  const [nextArrivalYear, setNextArrivalYear] = useState('2025');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCopiedUid, setHasCopiedUid] = useState(false);

  // --- CAMPAIGN MAGICIAN STATE ---
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isCampWizardOpen, setIsCampWizardOpen] = useState(false);
  const [campStep, setCampStep] = useState<'SETUP' | 'GENERATING' | 'RESULTS' | 'DEVIS'>('SETUP');
  const [campTargetRegion, setCampTargetRegion] = useState<string>('USER_DEFAULT');
  const [campTargetCommune, setCampTargetCommune] = useState<string>('ALL');
  const [campChannels, setCampChannels] = useState<string[]>(['PUSH']);
  const [campTone, setCampTone] = useState('Commercial');
  const [campLength, setCampLength] = useState<'Short' | 'Medium' | 'Long'>('Short');
  const [reachCount, setReachCount] = useState(0);
  const [isCalculatingReach, setIsCalculatingReach] = useState(false);
  const [generatedMessages, setGeneratedMessages] = useState<GenerateCampaignOutput | null>(null);
  const [selectedSms, setSelectedSms] = useState('');
  const [selectedPush, setSelectedPush] = useState('');
  const [selectedMail, setSelectedMail] = useState<{ subject: string, body: string } | null>(null);

  // --- IA PRODUCT WIZARD STATE ---
  const [isAiProductOpen, setIsAiProductOpen] = useState(false);
  const [aiProductStep, setAiProductStep] = useState<'TONE' | 'GENERATING' | 'RESULTS'>('TONE');
  const [aiProductTone, setAiProductTone] = useState('Commercial');
  const [aiProductResult, setAiProductResult] = useState<AnalyzeProductOutput | null>(null);

  const userRegion = profile?.selectedRegion || 'CALEDONIE';

  const handleCopyUid = () => {
    if (user?.uid) {
        navigator.clipboard.writeText(user.uid);
        setHasCopiedUid(true);
        toast({ title: "UID Copié" });
        setTimeout(() => setHasCopiedUid(false), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 4 - promoImages.length).forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => setPromoImages(prev => [...prev, ev.target?.result as string]);
        reader.readAsDataURL(f);
    });
  };

  const handleStartAiProduct = () => {
    if (!promoTitle) { toast({ variant: "destructive", title: "Titre requis" }); return; }
    if (promoImages.length === 0) { toast({ variant: "destructive", title: "Photo requise" }); return; }
    setIsAiProductOpen(true);
    setAiProductStep('TONE');
  };

  const runAiProductAnalysis = async () => {
    setAiProductStep('GENERATING');
    try {
        const result = await analyzeProduct({
            title: promoTitle,
            type: promoType,
            category: promoCategory,
            photos: promoImages,
            price: parseFloat(promoPrice) || undefined,
            tone: aiProductTone
        });
        setAiProductResult(result);
        setAiProductStep('RESULTS');
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur IA" });
        setIsAiProductOpen(false);
    }
  };

  const handleSavePromotion = async () => {
    if (!firestore || !business || !promoTitle) return;
    setIsSaving(true);
    const data = {
      businessId: business.id,
      title: promoTitle,
      category: promoCategory,
      description: promoDescription,
      price: parseFloat(promoPrice) || 0,
      promoType,
      images: promoImages,
      imageUrl: promoImages[0] || '',
      isOutOfStock,
      restockDate: isOutOfStock ? `${nextArrivalMonth} ${nextArrivalYear}` : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
        await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), data);
        toast({ title: "Article ajouté !" });
        setPromoTitle(''); setPromoPrice(''); setPromoImages([]); setPromoDescription(''); setPromoType('Promo');
        setIsOutOfStock(false);
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur sauvegarde" });
    } finally {
        setIsSaving(false);
    }
  };

  // --- CAMPAIGN LOGIC ---
  const calculateReach = async () => {
    if (!firestore) return;
    setIsCalculatingReach(true);
    try {
        let q = collection(firestore, 'users');
        const constraints = [];
        
        const targetRegion = campTargetRegion === 'USER_DEFAULT' ? userRegion : campTargetRegion;
        if (targetRegion !== 'ALL') constraints.push(where('selectedRegion', '==', targetRegion));
        if (campTargetCommune !== 'ALL') constraints.push(where('lastSelectedLocation', '==', campTargetCommune));
        
        if (business?.categories?.length) {
            constraints.push(where('subscribedCategories', 'array-contains-any', business.categories));
        }

        const reachQ = query(q, ...constraints);
        const snap = await getCountFromServer(reachQ);
        setReachCount(snap.data().count);
    } catch (e) {
        console.error(e);
    } finally {
        setIsCalculatingReach(false);
    }
  };

  useEffect(() => {
    if (isCampWizardOpen) calculateReach();
  }, [campTargetRegion, campTargetCommune, isCampWizardOpen, business]);

  const handleStartCampaignWizard = () => {
    if (selectedProductIds.length === 0) {
        toast({ variant: "destructive", title: "Sélectionnez au moins un article." });
        return;
    }
    setCampStep('SETUP');
    setIsCampWizardOpen(true);
  };

  const runCampaignIA = async () => {
    setCampStep('GENERATING');
    try {
        const selectedPromos = promotions?.filter(p => selectedProductIds.includes(p.id)) || [];
        const result = await generateCampaignMessages({
            businessName: business?.name || 'Mon Magasin',
            products: selectedPromos.map(p => ({
                title: p.title,
                description: p.description || '',
                type: p.promoType,
                price: p.price,
                discount: p.discountPercentage || undefined
            })),
            channels: campChannels as any[],
            tone: campTone,
            length: campLength
        });
        setGeneratedMessages(result);
        
        if (result.smsPropositions) setSelectedSms(result.smsPropositions[0]);
        if (result.pushPropositions) setSelectedPush(result.pushPropositions[0]);
        if (result.mailPropositions) setSelectedMail(result.mailPropositions[0]);
        
        setCampStep('RESULTS');
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur IA Campagne" });
        setCampStep('SETUP');
    }
  };

  const campaignCost = useMemo(() => {
    if (!pricing) return 0;
    const base = pricing.fixedPrice || 0;
    let unitSum = 0;
    if (campChannels.includes('SMS')) unitSum += pricing.priceSMS || 0;
    if (campChannels.includes('PUSH')) unitSum += pricing.pricePush || 0;
    if (campChannels.includes('MAIL')) unitSum += pricing.priceMail || 0;
    
    return base + (reachCount * unitSum);
  }, [pricing, campChannels, reachCount]);

  const handleFinalizeCampaign = async () => {
    if (!firestore || !business) return;
    setIsSaving(true);
    const campaignData: Partial<Campaign> = {
        businessId: business.id,
        businessName: business.name,
        ownerId: user?.uid,
        title: `Campagne ${format(new Date(), 'dd/MM/yyyy')}`,
        status: 'pending',
        reach: reachCount,
        cost: campaignCost,
        selectedChannels: campChannels,
        smsContent: selectedSms || null,
        pushContent: selectedPush || null,
        mailSubject: selectedMail?.subject || null,
        mailBody: selectedMail?.body || null,
        promotedPromoIds: selectedProductIds,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(firestore, 'campaigns'), campaignData);
        toast({ title: "Campagne enregistrée !", description: "L'administrateur va valider l'envoi." });
        setIsCampWizardOpen(false);
        setSelectedProductIds([]);
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur validation" });
    } finally {
        setIsSaving(false);
    }
  };

  if (isUserLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-1">
      <Card className="border-2 border-primary bg-primary/5 shadow-lg overflow-hidden">
        <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary text-white rounded-lg"><Store className="size-6" /></div>
                <div>
                    <p className="font-black text-xl uppercase text-slate-800 leading-none">{business?.name || 'Magasin Partenaire'}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Dashboard Professionnel</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="hidden sm:flex bg-white font-mono text-[9px] border-primary/20">UID: {user?.uid.substring(0,8)}...</Badge>
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={handleCopyUid}>
                    {hasCopiedUid ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {hasCopiedUid ? "Copié" : "Copier ID"}
                </Button>
            </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 h-14 border-2 bg-white/50 p-1 mb-6">
            <TabsTrigger value="inventory" className="font-black uppercase text-[11px] tracking-widest gap-2">
                <LayoutGrid className="size-4" /> Magasin & Stocks
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="font-black uppercase text-[11px] tracking-widest gap-2">
                <Megaphone className="size-4" /> Publicité IA
            </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8 animate-in fade-in duration-300">
            {business ? (
                <div className="space-y-8">
                    <Card className="border-2 border-primary shadow-xl overflow-hidden rounded-3xl">
                        <CardHeader className="bg-primary text-white flex-row justify-between items-center space-y-0 p-6">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter">Ajouter un article</CardTitle>
                            <Badge variant="outline" className="text-white border-white/30 text-[9px] font-black uppercase">Rayon {promoCategory}</Badge>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nom du produit</Label>
                                        <Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ex: Moulinet Shimano..." className="h-12 border-2 font-black text-base" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Prix (CFP)</Label>
                                            <Input type="number" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} className="h-12 border-2 font-black text-lg" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase ml-1">Type d'offre</Label>
                                            <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}>
                                                <SelectTrigger className="h-12 border-2 font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Promo" className="font-black text-[10px] uppercase text-red-600">PROMOTION</SelectItem>
                                                    <SelectItem value="Nouvel Arrivage" className="font-black text-[10px] uppercase text-primary">NOUVEL ARRIVAGE</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-red-50 border-2 border-dashed border-red-200 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-black uppercase text-red-800">Stock vide (Rupture)</Label>
                                            <Switch checked={isOutOfStock} onCheckedChange={setIsOutOfStock} />
                                        </div>
                                        {isOutOfStock && (
                                            <div className="grid grid-cols-2 gap-2 animate-in zoom-in-95">
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black uppercase text-red-600/60 ml-1">Mois retour</p>
                                                    <Select value={nextArrivalMonth} onValueChange={setNextArrivalMonth}>
                                                        <SelectTrigger className="h-9 border-2 bg-white text-[10px] font-bold"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-black uppercase text-red-600/60 ml-1">Année</p>
                                                    <Select value={nextArrivalYear} onValueChange={setNextArrivalYear}>
                                                        <SelectTrigger className="h-9 border-2 bg-white text-[10px] font-bold"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-dashed">
                                        <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle} className="w-full h-14 font-black uppercase shadow-xl text-sm tracking-widest gap-2">
                                            {isSaving ? <RefreshCw className="size-5 animate-spin" /> : <Save className="size-5" />}
                                            Enregistrer l'article
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Photos (Analyse IA)</Label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {promoImages.map((img, i) => (
                                                <div key={i} className="relative aspect-square rounded-xl border-2 overflow-hidden shadow-sm">
                                                    <img src={img} className="w-full h-full object-cover" alt="" />
                                                    <button onClick={() => setPromoImages(p => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="size-3" /></button>
                                                </div>
                                            ))}
                                            {promoImages.length < 4 && (
                                                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
                                                    <Plus className="size-5" />
                                                    <span className="text-[8px] font-black uppercase mt-1">Ajouter</span>
                                                </button>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Description commerciale</Label>
                                            <Button variant="ghost" className="h-6 text-[9px] font-black uppercase text-primary gap-1" onClick={handleStartAiProduct}>
                                                <Wand2 className="size-3" /> Magicien IA
                                            </Button>
                                        </div>
                                        <Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} placeholder="Décrivez l'offre ou utilisez l'IA..." className="min-h-[150px] border-2 text-sm leading-relaxed" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                            <Store className="size-4" /> Mon Catalogue ({promotions?.length || 0})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {promotions?.map(p => (
                                <Card key={p.id} className="overflow-hidden border-2 shadow-sm flex h-32 hover:border-primary/30 transition-all group">
                                    <div className="w-28 bg-muted/20 shrink-0 relative overflow-hidden flex items-center justify-center border-r">
                                        {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="size-8 opacity-10" />}
                                        {p.isOutOfStock && (
                                            <div className="absolute inset-0 bg-red-600/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-1 text-center">
                                                <span className="text-[10px] font-black uppercase">Rupture</span>
                                                <span className="text-[7px] font-bold uppercase">{p.restockDate}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={cn("font-black uppercase text-xs truncate leading-none", p.isOutOfStock && "line-through opacity-50")}>{p.title}</h4>
                                            <Checkbox 
                                                checked={selectedProductIds.includes(p.id)} 
                                                onCheckedChange={() => {
                                                    setSelectedProductIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                                                }}
                                                className="size-5 border-2 border-primary/30"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex items-baseline gap-1">
                                                <span className={cn("text-base font-black", p.isOutOfStock ? "text-slate-400" : (p.promoType === 'Promo' ? "text-red-600" : "text-primary"))}>{(p.price || 0).toLocaleString('fr-FR')}</span>
                                                <span className="text-[8px] font-black uppercase opacity-40">CFP</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="size-8 text-destructive/40 hover:text-destructive hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDoc(doc(firestore!, 'businesses', business.id, 'promotions', p.id))}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertCircle className="size-5" />
                    <AlertDescription className="text-sm font-medium">Veuillez transmettre votre UID à l'administrateur pour activer votre accès boutique.</AlertDescription>
                </Alert>
            )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-8 animate-in fade-in duration-300">
            <Card className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-[2rem] p-8 text-center flex flex-col items-center gap-4">
                <div className="p-4 bg-primary text-white rounded-2xl shadow-xl"><Megaphone className="size-8" /></div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Prêt à booster vos ventes ?</h3>
                    <p className="text-xs text-muted-foreground font-medium max-w-xs mx-auto">Générez une campagne intelligente (SMS, Push, Mail) basée sur votre catalogue.</p>
                </div>
                <Button 
                    className="h-14 px-10 font-black uppercase tracking-widest shadow-xl gap-3 text-sm mt-2" 
                    onClick={handleStartCampaignWizard}
                    disabled={selectedProductIds.length === 0}
                >
                    <Zap className="size-5 fill-white" /> Créer une Campagne {selectedProductIds.length > 0 ? `(${selectedProductIds.length} articles)` : ''}
                </Button>
                {selectedProductIds.length === 0 && <p className="text-[9px] font-black uppercase text-destructive">Sélectionnez d'abord des articles dans l'onglet Magasin</p>}
            </Card>

            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                    <History className="size-4" /> Mes Campagnes ({campaigns?.length || 0})
                </h3>
                <div className="grid gap-3">
                    {campaigns?.map(c => (
                        <Card key={c.id} className="border-2 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 bg-muted/10 border-b flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-black text-xs uppercase text-slate-800">{c.title}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">{c.createdAt ? format(c.createdAt.toDate(), 'dd MMMM yyyy', { locale: fr }) : '...'}</span>
                                </div>
                                <Badge className={cn("font-black text-[9px] uppercase", c.status === 'sent' ? "bg-green-600" : "bg-orange-500")}>
                                    {c.status === 'sent' ? 'Envoyée' : 'En attente'}
                                </Badge>
                            </div>
                            <CardContent className="p-4 grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground">Reach total</p>
                                    <p className="text-xl font-black flex items-center gap-2"><Users className="size-4 text-primary" /> {c.reach} abonnés</p>
                                </div>
                                <div className="space-y-1 border-l pl-4">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground">Budget investi</p>
                                    <p className="text-xl font-black text-slate-800">{(c.cost || 0).toLocaleString('fr-FR')} F</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </TabsContent>
      </Tabs>

      {/* --- IA PRODUCT DIALOG --- */}
      <Dialog open={isAiProductOpen} onOpenChange={setIsAiProductOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 bg-slate-50 border-b">
                <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2">
                    <BrainCircuit className="size-5 text-primary" /> Magicien Produit IA
                </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6">
                {aiProductStep === 'TONE' && (
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-center block opacity-60">Choisissez le ton de rédaction</Label>
                        <div className="grid gap-3">
                            {AVAILABLE_TONES.map(t => (
                                <div key={t.id} onClick={() => setAiProductTone(t.id)} className={cn("p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-95", aiProductTone === t.id ? "border-primary bg-primary/5 shadow-md" : "border-slate-100 hover:border-slate-200")}>
                                    <p className="font-black uppercase text-xs">{t.label}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t.desc}</p>
                                </div>
                            ))}
                        </div>
                        <Button className="w-full h-14 font-black uppercase tracking-widest mt-4" onClick={runAiProductAnalysis}>Analyser & Rédiger</Button>
                    </div>
                )}

                {aiProductStep === 'GENERATING' && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="relative">
                            <RefreshCw className="size-16 text-primary animate-spin" />
                            <Sparkles className="absolute inset-0 m-auto size-6 text-accent animate-pulse" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black uppercase text-sm tracking-tighter">Vision Artificielle active</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase animate-pulse">Gemini 2.5 Flash analyse vos photos...</p>
                        </div>
                    </div>
                )}

                {aiProductStep === 'RESULTS' && aiProductResult && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descriptions proposées (Sélectionnez)</Label>
                            {aiProductResult.commercialDescriptions.map((desc, idx) => (
                                <div key={idx} onClick={() => { setPromoDescription(desc); setAiProductStep('TONE'); setIsAiProductOpen(false); }} className="p-4 rounded-xl border-2 bg-white text-xs font-medium leading-relaxed italic hover:border-primary cursor-pointer transition-all border-slate-100 hover:shadow-md">
                                    "{desc}"
                                </div>
                            ))}
                        </div>
                        <div className="p-5 bg-primary/5 border-2 border-primary/20 rounded-2xl space-y-4">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Target className="size-3" /> Stratégie Marketing</p>
                            <p className="text-xs font-bold leading-relaxed text-slate-700">{aiProductResult.marketingAdvice}</p>
                            <div className="flex flex-wrap gap-2">
                                {aiProductResult.sellingPoints.map((pt, i) => <Badge key={i} variant="secondary" className="bg-white border text-[9px] font-bold uppercase">{pt}</Badge>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>

      {/* --- CAMPAIGN WIZARD DIALOG --- */}
      <Dialog open={isCampWizardOpen} onOpenChange={setIsCampWizardOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Sparkles className="size-6 text-primary" /> Magicien de Campagne IA
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-bold uppercase text-[10px]">Boostez votre visibilité sur le Caillou</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {campStep === 'SETUP' && (
                    <div className="space-y-8 pb-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">1. Ciblage Géographique</Label>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold uppercase opacity-40 ml-1">Région</p>
                                        <Select value={campTargetRegion} onValueChange={setCampTargetRegion}>
                                            <SelectTrigger className="h-12 border-2 bg-white"><Globe className="size-4 mr-2 text-primary"/><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="USER_DEFAULT">Focus : {userRegion}</SelectItem>
                                                <SelectItem value="ALL">Toute la Nouvelle-Calédonie</SelectItem>
                                                {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold uppercase opacity-40 ml-1">Commune (Optionnel)</p>
                                        <Select value={campTargetCommune} onValueChange={setCampTargetCommune}>
                                            <SelectTrigger className="h-12 border-2 bg-white"><MapPin className="size-4 mr-2 text-primary"/><SelectValue /></SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                <SelectItem value="ALL">Toutes les communes</SelectItem>
                                                {Object.keys(locationsByRegion[campTargetRegion === 'USER_DEFAULT' ? userRegion : (campTargetRegion as Region)] || {}).sort().map(loc => (
                                                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">2. Canaux de Diffusion</Label>
                                <div className="grid gap-2">
                                    {[
                                        { id: 'PUSH', label: 'Push App', icon: Zap, color: 'text-primary' },
                                        { id: 'SMS', label: 'SMS Mobile', icon: Smartphone, color: 'text-blue-600' },
                                        { id: 'MAIL', label: 'E-mail Direct', icon: Mail, color: 'text-green-600' }
                                    ].map(ch => (
                                        <div key={ch.id} onClick={() => setCampChannels(prev => prev.includes(ch.id) ? prev.filter(c => c !== ch.id) : [...prev, ch.id])} className={cn("p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all", campChannels.includes(ch.id) ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 bg-white opacity-60")}>
                                            <div className="flex items-center gap-3">
                                                <ch.icon className={cn("size-4", ch.color)} />
                                                <span className="text-[10px] font-black uppercase">{ch.label}</span>
                                            </div>
                                            {campChannels.includes(ch.id) && <Check className="size-4 text-primary" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 p-6 bg-white border-2 rounded-[2rem] shadow-sm">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">3. Paramètres de Rédaction IA</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold uppercase opacity-40">Ton souhaité</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {AVAILABLE_TONES.map(t => (
                                            <div key={t.id} onClick={() => setCampTone(t.id)} className={cn("p-3 rounded-xl border-2 text-[10px] font-black uppercase cursor-pointer text-center", campTone === t.id ? "bg-primary text-white border-primary" : "bg-slate-50 border-slate-100")}>
                                                {t.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold uppercase opacity-40">Longueur des messages</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['Short', 'Medium', 'Long'].map(l => (
                                            <div key={l} onClick={() => setCampLength(l as any)} className={cn("p-3 rounded-xl border-2 text-[10px] font-black uppercase cursor-pointer text-center", campLength === l ? "bg-primary text-white border-primary" : "bg-slate-50 border-slate-100")}>
                                                {l === 'Short' ? 'Direct / Court' : l === 'Medium' ? 'Standard' : 'Détaillé / Story'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Card className="bg-slate-900 text-white border-none rounded-3xl overflow-hidden shadow-2xl">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/10 rounded-2xl"><Users className="size-6 text-primary" /></div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">Audience Estimée</p>
                                        {isCalculatingReach ? <Skeleton className="h-8 w-20 bg-white/10 mt-1" /> : <p className="text-3xl font-black">{reachCount} abonnés</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Budget estimé</p>
                                    <p className="text-2xl font-black text-white">{campaignCost.toLocaleString('fr-FR')} F</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {campStep === 'GENERATING' && (
                    <div className="py-24 flex flex-col items-center justify-center gap-6 text-center">
                        <div className="relative">
                            <div className="size-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            <BrainCircuit className="absolute inset-0 m-auto size-10 text-primary animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black uppercase tracking-tighter">Rédaction Multi-Canal</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase animate-pulse">L'IA analyse vos articles pour créer 15 variantes uniques...</p>
                        </div>
                    </div>
                )}

                {campStep === 'RESULTS' && generatedMessages && (
                    <div className="space-y-8 pb-10">
                        {campChannels.includes('SMS') && generatedMessages.smsPropositions && (
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 font-black uppercase text-xs text-blue-600"><Smartphone className="size-4" /> Variantes SMS (Max 160 car.)</Label>
                                <div className="space-y-2">
                                    {generatedMessages.smsPropositions.map((txt, i) => (
                                        <div key={i} onClick={() => setSelectedSms(txt)} className={cn("p-4 rounded-2xl border-2 cursor-pointer transition-all", selectedSms === txt ? "border-blue-600 bg-blue-50 shadow-md" : "bg-white border-slate-100")}>
                                            <p className="text-xs font-medium leading-relaxed italic">"{txt}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {campChannels.includes('PUSH') && generatedMessages.pushPropositions && (
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 font-black uppercase text-xs text-primary"><Zap className="size-4" /> Variantes Push (Max 80 car.)</Label>
                                <div className="space-y-2">
                                    {generatedMessages.pushPropositions.map((txt, i) => (
                                        <div key={i} onClick={() => setSelectedPush(txt)} className={cn("p-4 rounded-2xl border-2 cursor-pointer transition-all", selectedPush === txt ? "border-primary bg-primary/5 shadow-md" : "bg-white border-slate-100")}>
                                            <p className="text-xs font-black uppercase leading-tight">{txt}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {campChannels.includes('MAIL') && generatedMessages.mailPropositions && (
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 font-black uppercase text-xs text-green-600"><Mail className="size-4" /> Variantes E-mail</Label>
                                <div className="space-y-2">
                                    {generatedMessages.mailPropositions.map((mail, i) => (
                                        <div key={i} onClick={() => setSelectedMail(mail)} className={cn("p-4 rounded-2xl border-2 cursor-pointer transition-all", selectedMail?.body === mail.body ? "border-green-600 bg-green-50 shadow-md" : "bg-white border-slate-100")}>
                                            <p className="text-[10px] font-black uppercase text-green-800 mb-1">OBJET : {mail.subject}</p>
                                            <p className="text-[11px] leading-relaxed text-slate-600 line-clamp-3">{mail.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <DialogFooter className="p-6 bg-white border-t shrink-0">
                {campStep === 'SETUP' && (
                    <Button className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base gap-3" onClick={runCampaignIA} disabled={campChannels.length === 0}>
                        Générer avec l'IA <ChevronRight className="size-5" />
                    </Button>
                )}
                {campStep === 'RESULTS' && (
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <Button variant="outline" className="h-16 font-black uppercase border-2" onClick={() => setCampStep('SETUP')}>Modifier réglages</Button>
                        <Button className="h-16 font-black uppercase shadow-xl bg-green-600 hover:bg-green-700 text-white gap-3" onClick={handleFinalizeCampaign} disabled={isSaving}>
                            {isSaving ? <RefreshCw className="size-5 animate-spin" /> : <Send className="size-5" />} Valider & Envoyer
                        </Button>
                    </div>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}