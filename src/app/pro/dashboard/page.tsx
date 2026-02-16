
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { allCommuneNames } from '@/lib/locations';
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
type CampaignWizardStep = 'IDLE' | 'TONE' | 'LENGTH' | 'GENERATING' | 'SELECTION' | 'PREVIEW';

const MAIN_CATEGORIES = ["Pêche", "Chasse", "Jardinage"];
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

  // States
  const [wizardStep, setWizardStep] = useState<WizardStep>('IDLE');
  const [aiAdditionalInfo, setAiAdditionalInfo] = useState('');
  const [aiSelectedTone, setAiSelectedTone] = useState('Commercial');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AnalyzeProductOutput | null>(null);
  
  const [campWizardStep, setCampWizardStep] = useState<CampaignWizardStep>('IDLE');
  const [campTone, setCampTone] = useState('Commercial');
  const [campLength, setCampLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [campProps, setCampProps] = useState<GenerateCampaignOutput | null>(null);

  const [promoTitle, setPromoTitle] = useState('');
  const [promoCategory, setPromoCategory] = useState('Pêche');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [promoImages, setPromoImages] = useState<string[]>([]);
  const [promoType, setPromoType] = useState<'Promo' | 'Nouvel Arrivage'>('Promo');
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [nextArrivalMonth, setNextArrivalMonth] = useState('Mars');
  const [nextArrivalYear, setNextArrivalYear] = useState('2025');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
  const [targetCategory, setTargetCategory] = useState('Pêche');
  const [targetScope, setTargetScope] = useState<TargetScope>('SPECIFIC');
  const [selectedTargetCommunes, setSelectedTargetCommunes] = useState<string[]>([]);

  const handleCopyUid = () => { if (user?.uid) { navigator.clipboard.writeText(user.uid); toast({ title: "UID Copié" }); } };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 4 - promoImages.length).forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => setPromoImages(prev => [...prev, ev.target?.result as string]);
        reader.readAsDataURL(f);
    });
  };

  const handleSavePromotion = async () => {
    if (!firestore || !business || !promoTitle) return;
    setIsSaving(true);
    const data = {
      businessId: business.id, title: promoTitle, category: promoCategory, description: promoDescription,
      price: parseFloat(promoPrice) || 0, originalPrice: parseFloat(originalPrice) || null,
      promoType, images: promoImages, imageUrl: promoImages[0] || '', isOutOfStock,
      restockDate: isOutOfStock ? `${nextArrivalMonth} ${nextArrivalYear}` : null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    try {
        await addDoc(collection(firestore, 'businesses', business.id, 'promotions'), data);
        toast({ title: "Article ajouté" });
        setPromoTitle(''); setPromoPrice(''); setPromoImages([]); setPromoDescription('');
    } finally { setIsSaving(false); }
  };

  if (isUserLoading || !profile) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-1">
      <Card className="border-2 border-primary bg-primary/5 shadow-lg">
        <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary text-white rounded-lg"><Store className="size-6" /></div>
                <div><p className="font-black text-xl uppercase text-slate-800">{business?.name || 'Magasin Pro'}</p></div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyUid} className="font-black uppercase text-[10px] bg-white"><Copy className="size-3 mr-2" /> Copier UID</Button>
        </CardContent>
      </Card>

      {business && (
        <div className="space-y-8">
            <Card className="border-2 border-primary shadow-xl overflow-hidden">
                <CardHeader className="bg-primary text-white"><CardTitle className="text-2xl font-black uppercase">Gestion Catalogue</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Titre produit</Label><Input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} className="font-bold border-2" /></div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Prix</Label><Input type="number" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} className="border-2 font-black" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Type</Label>
                                    <Select value={promoType} onValueChange={(v: any) => setPromoType(v)}><SelectTrigger className="h-10 border-2 font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Promo">Promotion</SelectItem><SelectItem value="Nouvel Arrivage">Nouveauté</SelectItem></SelectContent></Select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-red-50 border-2 border-dashed border-red-200 rounded-xl">
                                <Label className="text-xs font-black uppercase text-red-800">En rupture</Label>
                                <Switch checked={isOutOfStock} onCheckedChange={setIsOutOfStock} />
                            </div>
                            <Button onClick={handleSavePromotion} disabled={isSaving || !promoTitle} className="w-full h-12 font-black uppercase shadow-lg">Enregistrer l'article</Button>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase opacity-60">Photos (Max 4)</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {promoImages.map((img, i) => <div key={i} className="relative aspect-square rounded-lg border-2 overflow-hidden"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setPromoImages(p => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="size-3" /></button></div>)}
                                {promoImages.length < 4 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40"><Plus className="size-4" /></button>}
                            </div>
                            <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">Description</Label><Textarea value={promoDescription} onChange={e => setPromoDescription(e.target.value)} className="min-h-[100px] border-2 text-sm" /></div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1">Votre Catalogue ({promotions?.length || 0})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {promotions?.map(p => (
                        <Card key={p.id} className="overflow-hidden border-2 shadow-sm flex h-32 hover:border-primary/30 transition-all">
                            <div className="w-24 bg-muted/20 shrink-0 relative overflow-hidden flex items-center justify-center border-r">
                                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="size-6 opacity-20" />}
                                {p.isOutOfStock && <div className="absolute inset-0 bg-red-600/40 flex items-center justify-center"><span className="text-[8px] font-black text-white">RUPTURE</span></div>}
                            </div>
                            <div className="flex-1 p-3 flex flex-col justify-between">
                                <h4 className="font-black uppercase text-xs truncate leading-none">{p.title}</h4>
                                <div className="flex items-center justify-between"><span className="font-black text-sm text-primary">{p.price} CFP</span><Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'businesses', business.id, 'promotions', p.id))}><Trash2 className="size-4" /></Button></div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
