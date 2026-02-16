
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, addDoc, setDoc, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
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
  Send, 
  DollarSign, 
  ShoppingBag, 
  Store, 
  Camera, 
  RefreshCw, 
  Percent, 
  ImageIcon, 
  X, 
  Pencil, 
  Save, 
  UserCircle, 
  BrainCircuit, 
  MapPin, 
  ChevronDown, 
  Globe, 
  Smartphone, 
  Mail, 
  Zap, 
  ChevronRight,
  Wand2,
  Check,
  CheckCircle2,
  CreditCard,
  Copy
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { allCommuneNames } from '@/lib/locations';
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

type WizardStep = 'IDLE' | 'INFO' | 'TONE' | 'GENERATING' | 'OPTIONS' | 'STRATEGY';
type CampaignWizardStep = 'IDLE' | 'TONE' | 'LENGTH' | 'GENERATING' | 'SELECTION' | 'PREVIEW';

const AVAILABLE_TONES = [
    { id: 'Local (Caillou)', label: 'Local (Caillou)', desc: 'Parle au coeur des gens' },
    { id: 'Commercial', label: 'Commercial', desc: 'Dynamique' },
    { id: 'Humoristique', label: 'Humoristique', desc: 'Léger' },
];

const CAMPAIGN_LENGTHS = [
    { id: 'Short', label: 'Court', desc: 'Direct' },
    { id: 'Medium', label: 'Moyen', desc: 'Équilibré' },
    { id: 'Long', label: 'Long', desc: 'Détaillé' },
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

  // Magicien IA Produit States
  const [wizardStep, setWizardStep] = useState<WizardStep>('IDLE');
  const [aiAdditionalInfo, setAiAdditionalInfo] = useState('');
  const [aiSelectedTone, setAiSelectedTone] = useState('Commercial');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AnalyzeProductOutput | null>(null);
  
  // Magicien Campagne States
  const [campWizardStep, setCampWizardStep] = useState<CampaignWizardStep>('IDLE');
  const [campTone, setCampTone] = useState('Commercial');
  const [campLength, setCampLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [campProps, setCampProps] = useState<GenerateCampaignOutput | null>(null);

  // Form States
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

  const handleStartAiWizard = () => {
    if (!promoTitle) { toast({ variant: "destructive", title: "Titre requis" }); return; }
    if (promoImages.length === 0) { toast({ variant: "destructive", title: "Photo requise" }); return; }
    setWizardStep('TONE');
  };

  const generateProductAdvice = async () => {
    setWizardStep('GENERATING');
    try {
        const result = await analyzeProduct({
            title: promoTitle,
            type: promoType,
            category: promoCategory,
            photos: promoImages,
            price: parseFloat(promoPrice) || undefined,
            tone: aiSelectedTone,
            additionalInfo: aiAdditionalInfo
        });
        setAiAnalysisResult(result);
        setWizardStep('OPTIONS');
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur IA" });
        setWizardStep('IDLE');
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

  if (isUserLoading || !profile) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

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
            <Button variant="outline" size="sm" className="font-black uppercase text-[10px] border-2 bg-white" onClick={handleCopyUid}>
                {hasCopiedUid ? <Check className="size-3" /> : <Copy className="size-3" />}
            </Button>
        </CardContent>
      </Card>

      {business ? (
        <div className="space-y-8">
            <Card className="border-2 border-primary shadow-xl overflow-hidden">
                <CardHeader className="bg-primary text-white flex-row justify-between items-center space-y-0">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Ajouter un article</CardTitle>
                    <Badge variant="outline" className="text-white border-white/30 text-[9px] font-black uppercase">{promoCategory}</Badge>
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
                                    <Label className="text-[10px] font-black uppercase ml-1">Prix (CFP)</Label>
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
                                    Enregistrer dans le rayon
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
                                    <Button variant="ghost" className="h-6 text-[9px] font-black uppercase text-primary gap-1" onClick={handleStartAiWizard}>
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
                    <ShoppingBag className="size-4" /> Articles en ligne ({promotions?.length || 0})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {promotions?.map(p => (
                        <Card key={p.id} className="overflow-hidden border-2 shadow-sm flex h-32 hover:border-primary/30 transition-all group">
                            <div className="w-28 bg-muted/20 shrink-0 relative overflow-hidden flex items-center justify-center border-r">
                                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="size-8 opacity-10" />}
                                {p.isOutOfStock && (
                                    <div className="absolute inset-0 bg-red-600/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-1">
                                        <span className="text-[10px] font-black uppercase">Rupture</span>
                                        <span className="text-[7px] font-bold uppercase">{p.restockDate}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                <h4 className={cn("font-black uppercase text-xs truncate leading-none", p.isOutOfStock && "line-through opacity-50")}>{p.title}</h4>
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
            <AlertTitle className="font-black uppercase">Compte PRO non configuré</AlertTitle>
            <AlertDescription className="text-sm font-medium">Veuillez transmettre votre UID à l'administrateur pour activer votre accès commerçant.</AlertDescription>
        </Alert>
      )}

      {/* MODAL IA PRODUIT */}
      <Dialog open={wizardStep !== 'IDLE'} onOpenChange={(open) => !open && setWizardStep('IDLE')}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 bg-slate-50 border-b">
                <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2">
                    <BrainCircuit className="size-5 text-primary" /> Magicien Produit IA
                </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6">
                {wizardStep === 'TONE' && (
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-center block opacity-60">Choisissez le ton de rédaction</Label>
                        <div className="grid gap-3">
                            {AVAILABLE_TONES.map(t => (
                                <div key={t.id} onClick={() => setAiSelectedTone(t.id)} className={cn("p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-95", aiSelectedTone === t.id ? "border-primary bg-primary/5 shadow-md" : "border-slate-100 hover:border-slate-200")}>
                                    <p className="font-black uppercase text-xs">{t.label}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t.desc}</p>
                                </div>
                            ))}
                        </div>
                        <Button className="w-full h-14 font-black uppercase tracking-widest mt-4" onClick={generateProductAdvice}>Analyser & Rédiger</Button>
                    </div>
                )}

                {wizardStep === 'GENERATING' && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <RefreshCw className="size-12 text-primary animate-spin" />
                        <p className="font-black uppercase text-xs tracking-widest animate-pulse">L'IA prépare vos fiches...</p>
                    </div>
                )}

                {wizardStep === 'OPTIONS' && aiAnalysisResult && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descriptions proposées (Cliquez pour choisir)</Label>
                            <div className="space-y-3">
                                {aiAnalysisResult.commercialDescriptions.map((desc, idx) => (
                                    <div key={idx} onClick={() => { setPromoDescription(desc); setWizardStep('STRATEGY'); }} className="p-4 rounded-xl border-2 bg-white text-xs leading-relaxed font-medium italic hover:border-primary cursor-pointer transition-all">
                                        "{desc}"
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {wizardStep === 'STRATEGY' && aiAnalysisResult && (
                    <div className="space-y-6">
                        <div className="p-5 bg-primary/5 border-2 border-primary/20 rounded-2xl space-y-4">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest">Conseil Marketing NC</p>
                            <p className="text-xs font-bold leading-relaxed">{aiAnalysisResult.marketingAdvice}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase opacity-40 ml-1">Arguments de vente</p>
                            <div className="flex flex-wrap gap-2">
                                {aiAnalysisResult.sellingPoints.map((pt, i) => <Badge key={i} variant="outline" className="bg-white border-2 text-[10px] font-bold px-3 py-1">{pt}</Badge>)}
                            </div>
                        </div>
                        <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl" onClick={() => setWizardStep('IDLE')}>Terminer</Button>
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
