'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo, SoundLibraryEntry, FaqEntry, SupportTicket, CgvSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, Users, Crown, KeyRound, Trash2, Mail, 
  Palette, Save, Upload, 
  Fish, Plus, Minus, Pencil, DatabaseZap, Sparkles, UserX,
  Eye, Music, Volume2, Play, Download, HelpCircle, MessageSquare, Check, X, RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  FileText,
  Gavel,
  Calendar,
  ImageIcon,
  Clock,
  Type,
  ExternalLink,
  ShieldCheck,
  Ticket,
  Scale,
  Ruler,
  Landmark
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { INITIAL_FAQ_DATA } from '@/lib/faq-data';
import { format, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { lagoonFishData } from '@/lib/fish-data';
import Image from 'next/image';

const FAQ_CATEGORIES = ["General", "Peche", "Boat Tracker", "Chasse", "Champs", "Compte"];

type SortConfig = {
  field: keyof FaqEntry | null;
  direction: 'asc' | 'desc';
};

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // FAQ States
  const [isFaqDialogOpen, setIsFaqDialogOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<Partial<FaqEntry>>({});
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [faqSort, setFaqSort] = useState<SortConfig>({ field: null, direction: 'asc' });
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('all');

  // Tickets States
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  // CGV States
  const [cgvContent, setCgvContent] = useState('');
  const [isSavingCgv, setIsSavingCgv] = useState(false);

  // Splash States
  const [isSavingSplash, setIsSavingSplash] = useState(false);

  // Fish States
  const [isFishDialogOpen, setIsFishDialogOpen] = useState(false);
  const [currentFish, setCurrentFish] = useState<Partial<FishSpeciesInfo>>({});
  const [isSavingFish, setIsSavingFish] = useState(false);
  const [isAIGeneratingFish, setIsAIGeneratingFish] = useState(false);
  const [isReadjustingRisks, setIsReadjustingRisks] = useState(false);
  const fishFileInputRef = useRef<HTMLInputElement>(null);

  // Sound States
  const [isSoundDialogOpen, setIsSoundDialogOpen] = useState(false);
  const [currentSound, setCurrentSound] = useState<Partial<SoundLibraryEntry>>({});
  const [isSavingSound, setIsSavingSound] = useState(false);

  // Access States
  const [isSavingSharedToken, setIsSavingSharedToken] = useState(false);
  const [tokenMonths, setTokenMonths] = useState('3');
  const [tokenCount, setTokenCount] = useState('1');
  const [isGeneratingTokens, setIsGeneratingTokens] = useState(false);

  // Détection robuste admin (Email + UID)
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.toLowerCase();
    const uid = user.uid;
    return email === 'f.mallet81@outlook.com' || 
           email === 'f.mallet81@gmail.com' || 
           email === 'fabrice.mallet@gmail.com' ||
           uid === 'K9cVYLVUk1NV99YV3anebkugpPp1';
  }, [user]);

  // --- QUERIES ---
  const faqRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'faq', 'items'), orderBy('views', 'desc'));
  }, [firestore, isAdmin]);
  const { data: rawFaqs } = useCollection<FaqEntry>(faqRef);

  const usersRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'users'), orderBy('email', 'asc'));
  }, [firestore, isAdmin]);
  const { data: users } = useCollection<UserAccount>(usersRef);

  const sortedFaqs = useMemo(() => {
    if (!rawFaqs) return [];
    let filtered = [...rawFaqs];
    if (faqCategoryFilter !== 'all') {
      filtered = filtered.filter(f => f.categorie === faqCategoryFilter);
    }
    if (!faqSort.field) return filtered;
    return filtered.sort((a, b) => {
      const field = faqSort.field!;
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (valA < valB) return faqSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return faqSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rawFaqs, faqSort, faqCategoryFilter]);

  const ticketsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'tickets', 'items'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: tickets } = useCollection<SupportTicket>(ticketsRef);

  const cgvRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'cgv');
  }, [firestore, isAdmin]);
  const { data: dbCgv } = useDoc<CgvSettings>(cgvRef);

  const splashRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore, isAdmin]);
  const { data: splashSettings } = useDoc<SplashScreenSettings>(splashRef);

  const fishRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'fish_species'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: fishSpecies } = useCollection<FishSpeciesInfo>(fishRef);

  const soundsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore, isAdmin]);
  const { data: sounds } = useCollection<SoundLibraryEntry>(soundsRef);

  const sharedTokenRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'shared_access_tokens', 'GLOBAL');
  }, [firestore, isAdmin]);
  const { data: sharedToken } = useDoc<SharedAccessToken>(sharedTokenRef);

  useEffect(() => {
    if (dbCgv) setCgvContent(dbCgv.content || '');
  }, [dbCgv]);

  // --- HANDLERS FAQ ---
  const handleSort = (field: keyof FaqEntry) => {
    setFaqSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSaveFaq = async () => {
    if (!firestore || !isAdmin || !currentFaq.question) return;
    setIsSavingFaq(true);
    try {
      const faqId = currentFaq.id || Math.random().toString(36).substring(7);
      await setDoc(doc(firestore, 'cms_support', 'faq', 'items', faqId), {
        ...currentFaq,
        id: faqId,
        views: currentFaq.views || 0,
        ordre: currentFaq.ordre || 0
      }, { merge: true });
      toast({ title: "FAQ mise à jour" });
      setIsFaqDialogOpen(false);
    } finally {
      setIsSavingFaq(false);
    }
  };

  const handleClearFaq = async () => {
    if (!firestore || !isAdmin || !rawFaqs) return;
    setIsClearing(true);
    try {
        const batch = writeBatch(firestore);
        rawFaqs.forEach(f => batch.delete(doc(firestore, 'cms_support', 'faq', 'items', f.id)));
        await batch.commit();
        toast({ title: "FAQ vidée." });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur suppression" });
    } finally {
        setIsClearing(false);
    }
  };

  const handleSeedFaq = async () => {
    if (!firestore || !isAdmin) return;
    setIsGenerating(true);
    try {
        const batch = writeBatch(firestore);
        INITIAL_FAQ_DATA.forEach(item => {
            const id = Math.random().toString(36).substring(7);
            batch.set(doc(firestore, 'cms_support', 'faq', 'items', id), { ...item, id, views: 0 });
        });
        await batch.commit();
        toast({ title: "FAQ peuplée (100 entrées) !" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur injection" });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!firestore || !isAdmin) return;
    await deleteDoc(doc(firestore, 'cms_support', 'faq', 'items', id));
    toast({ title: "Entrée supprimée" });
  };

  // --- HANDLERS TICKETS ---
  const handleRespondToTicket = async () => {
    if (!firestore || !isAdmin || !currentTicket || !adminResponse) return;
    setIsResponding(true);
    try {
      await updateDoc(doc(firestore, 'cms_support', 'tickets', 'items', currentTicket.id), {
        adminResponse,
        respondedAt: serverTimestamp(),
        statut: 'ferme'
      });
      toast({ title: "Réponse envoyée" });
      setCurrentTicket(null);
      setAdminResponse('');
    } finally {
      setIsResponding(false);
    }
  };

  // --- HANDLERS CGV ---
  const handleSaveCgv = async () => {
    if (!firestore || !isAdmin) return;
    setIsSavingCgv(true);
    try {
      const newVersion = Date.now();
      await setDoc(doc(firestore, 'app_settings', 'cgv'), {
        content: cgvContent,
        updatedAt: serverTimestamp(),
        version: newVersion
      });
      toast({ title: "CGV sauvegardées !", description: `Version ${newVersion} active.` });
    } finally {
      setIsSavingCgv(false);
    }
  };

  const loadCgvTemplate = () => {
    const today = new Date().toLocaleDateString('fr-FR');
    const template = `CONDITIONS GÉNÉRALES DE VENTE (CGV) - LAGON & BROUSSE NC\nDernière mise à jour : ${today}\n\nARTICLE 1 : OBJET...`;
    setCgvContent(template);
    toast({ title: "Modèle chargé" });
  };

  // --- HANDLERS DESIGN ---
  const handleSaveSplash = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !isAdmin) return;
    setIsSavingSplash(true);
    const formData = new FormData(e.currentTarget);
    const settings = {
      splashMode: formData.get('splashMode'),
      splashText: formData.get('splashText'),
      splashTextColor: formData.get('splashTextColor'),
      splashFontSize: formData.get('splashFontSize'),
      splashBgColor: formData.get('splashBgColor'),
      splashImageUrl: formData.get('splashImageUrl'),
      splashImageFit: formData.get('splashImageFit'),
      splashDuration: parseFloat(formData.get('splashDuration') as string || '2.5'),
    };
    try {
      await setDoc(doc(firestore, 'app_settings', 'splash'), settings, { merge: true });
      toast({ title: "Design mis à jour" });
    } finally {
      setIsSavingSplash(false);
    }
  };

  // --- HANDLERS FISH ---
  const handleAIGenerateFish = async () => {
    if (!currentFish.name) return;
    setIsAIGeneratingFish(true);
    try {
      const info = await generateFishInfo({ name: currentFish.name });
      // On fusionne mais on garde les données existantes pour ne pas écraser les images
      setCurrentFish(prev => ({ 
        ...prev,
        ...info, 
      }));
      toast({ title: "Fiche générée par IA" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur IA" });
    } finally {
      setIsAIGeneratingFish(false);
    }
  };

  const handleFishPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCurrentFish(prev => ({ ...prev, imageUrl: base64 }));
      toast({ title: "Photo prête" });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveFish = async () => {
    if (!firestore || !isAdmin || !currentFish.name) return;
    setIsSavingFish(true);
    try {
      const id = currentFish.id || currentFish.name.toLowerCase().replace(/\s+/g, '-');
      
      // Sanitisation du payload pour éviter les erreurs "undefined" de Firebase
      const payload: any = { 
        id,
        name: currentFish.name || "",
        scientificName: currentFish.scientificName || "",
        gratteRiskSmall: Number(currentFish.gratteRiskSmall) || 0,
        gratteRiskMedium: Number(currentFish.gratteRiskMedium) || 0,
        gratteRiskLarge: Number(currentFish.gratteRiskLarge) || 0,
        gratteRisk: Number(currentFish.gratteRiskMedium || currentFish.gratteRisk || 0),
        lengthSmall: currentFish.lengthSmall || "",
        lengthMedium: currentFish.lengthMedium || "",
        lengthLarge: currentFish.lengthLarge || "",
        culinaryAdvice: currentFish.culinaryAdvice || "",
        fishingAdvice: currentFish.fishingAdvice || "",
        category: currentFish.category || "Lagon",
        imageUrl: currentFish.imageUrl || null,
        imagePlaceholder: currentFish.imagePlaceholder || null
      };

      await setDoc(doc(firestore, 'fish_species', id), payload, { merge: true });
      toast({ title: "Poisson enregistré" });
      setIsFishDialogOpen(false);
    } catch (e) {
      console.error("Firestore Save Error:", e);
      toast({ variant: 'destructive', title: "Erreur enregistrement", description: "Une valeur invalide a bloqué l'accès à Firestore." });
    } finally {
      setIsSavingFish(false);
    }
  };

  const handleDeleteFish = async (id: string) => {
    if (!firestore || !isAdmin) return;
    try {
      await deleteDoc(doc(firestore, 'fish_species', id));
      toast({ title: "Poisson supprimé" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur suppression" });
    }
  };

  const handleReadjustRisks = async () => {
    if (!firestore || !isAdmin || !fishSpecies) return;
    setIsReadjustingRisks(true);
    try {
      const batch = writeBatch(firestore);
      let count = 0;

      for (const fish of fishSpecies) {
        const statsRef = collection(firestore, 'fish_species', fish.id, 'commune_stats');
        const statsSnap = await getDocs(statsRef);
        
        const sums = { small: 0, medium: 0, large: 0 };
        const counts = { small: 0, medium: 0, large: 0 };

        statsSnap.forEach(docSnap => {
          const d = docSnap.data();
          sums.small += d.small_sum || 0;
          counts.small += d.small_count || 0;
          sums.medium += d.medium_sum || 0;
          counts.medium += d.medium_count || 0;
          sums.large += d.large_sum || 0;
          counts.large += d.large_count || 0;
        });

        const updates: any = {};
        if (counts.small > 0) updates.gratteRiskSmall = parseFloat((sums.small / counts.small).toFixed(1));
        if (counts.medium > 0) updates.gratteRiskMedium = parseFloat((sums.medium / counts.medium).toFixed(1));
        if (counts.large > 0) updates.gratteRiskLarge = parseFloat((sums.large / counts.large).toFixed(1));

        if (Object.keys(updates).length > 0) {
          batch.update(doc(firestore, 'fish_species', fish.id), updates);
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        toast({ title: "Risques réajustés !", description: `${count} espèces mises à jour par taille.` });
      } else {
        toast({ title: "Aucun réajustement", description: "Pas de notes spécifiques par taille trouvées." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "Erreur de réajustement" });
    } finally {
      setIsReadjustingRisks(false);
    }
  };

  const handleRepairLengths = async () => {
    if (!firestore || !isAdmin || !fishSpecies) return;
    setIsClearing(true);
    try {
      const batch = writeBatch(firestore);
      let count = 0;
      
      for (const fish of fishSpecies) {
        // Robust matching: by ID or normalized Name
        const refFish = lagoonFishData.find(f => 
          f.id === fish.id || 
          f.name.toLowerCase().trim() === fish.name.toLowerCase().trim()
        );

        if (refFish) {
          const updates: any = {};
          if (!fish.lengthSmall) updates.lengthSmall = refFish.lengthSmall;
          if (!fish.lengthMedium) updates.lengthMedium = refFish.lengthMedium;
          if (!fish.lengthLarge) updates.lengthLarge = refFish.lengthLarge;
          
          if (Object.keys(updates).length > 0) {
            batch.update(doc(firestore, 'fish_species', fish.id), updates);
            count++;
          }
        }
      }
      
      if (count > 0) {
        await batch.commit();
        toast({ title: "Données réparées", description: `${count} fiches mises à jour avec les longueurs NC.` });
      } else {
        toast({ title: "Tout est à jour", description: "Aucune fiche ne nécessite de réparation." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "Erreur réparation" });
    } finally {
      setIsClearing(false);
    }
  };

  // --- HANDLERS SOUNDS ---
  const handleSaveSound = async () => {
    if (!firestore || !isAdmin || !currentSound.label || !currentSound.url) return;
    setIsSavingSound(true);
    try {
      const id = currentSound.id || Math.random().toString(36).substring(7);
      await setDoc(doc(firestore, 'sound_library', id), { ...currentSound, id, categories: currentSound.categories || ['General'] }, { merge: true });
      toast({ title: "Son enregistré" });
      setIsSoundDialogOpen(false);
    } finally {
      setIsSavingSound(false);
    }
  };

  const handleDeleteSound = async (id: string) => {
    if (!firestore || !isAdmin) return;
    try {
      await deleteDoc(doc(firestore, 'sound_library', id));
      toast({ title: "Son supprimé" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur suppression" });
    }
  };

  // --- HANDLERS ACCESS ---
  const handleToggleGlobalAccess = async () => {
    if (!firestore || !isAdmin) return;
    setIsSavingSharedToken(true);
    try {
      const isActive = !sharedToken || !sharedToken.expiresAt || isBefore(new Date(), sharedToken.expiresAt.toDate());
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      await setDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'), {
        id: 'GLOBAL',
        expiresAt: isActive ? Timestamp.fromDate(new Date(0)) : Timestamp.fromDate(expiryDate),
        updatedAt: serverTimestamp()
      });
      toast({ title: isActive ? "Accès Offert Désactivé" : "Accès Offert Activé (1 an)" });
    } finally {
      setIsSavingSharedToken(false);
    }
  };

  const handleGenerateTokens = async () => {
    if (!firestore || !isAdmin) return;
    setIsGeneratingTokens(true);
    try {
      const count = parseInt(tokenCount);
      const months = parseInt(tokenMonths);
      const batch = writeBatch(firestore);
      for (let i = 0; i < count; i++) {
        const code = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        batch.set(doc(firestore, 'access_tokens', code), {
          id: code, status: 'active', durationMonths: months, createdAt: serverTimestamp()
        });
      }
      await batch.commit();
      toast({ title: `${count} jeton(s) généré(s)` });
    } finally {
      setIsGeneratingTokens(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  const SortIcon = ({ field }: { field: keyof FaqEntry }) => {
    if (faqSort.field !== field) return <ArrowUpDown className="ml-1 size-3 opacity-20" />;
    return faqSort.direction === 'asc' ? <ArrowUp className="ml-1 size-3 text-primary" /> : <ArrowDown className="ml-1 size-3 text-primary" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter text-xl">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-10 mb-6 h-auto p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase">Stats</TabsTrigger>
          <TabsTrigger value="faq" className="text-[10px] font-black uppercase">FAQ</TabsTrigger>
          <TabsTrigger value="tickets" className="text-[10px] font-black uppercase">Tickets</TabsTrigger>
          <TabsTrigger value="cgv" className="text-[10px] font-black uppercase">CGV</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase">Users</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase">Design</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase">Fish</TabsTrigger>
          <TabsTrigger value="sounds" className="text-[10px] font-black uppercase">Sons</TabsTrigger>
          <TabsTrigger value="access" className="text-[10px] font-black uppercase">Accès</TabsTrigger>
          <TabsTrigger value="docs" className="text-[10px] font-black uppercase">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><Palette className="size-4" /> Personnalisation Splash Screen</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSplash} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Mode d'affichage</Label>
                    <Select name="splashMode" defaultValue={splashSettings?.splashMode || 'text'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="text">Texte stylisé</SelectItem><SelectItem value="image">Logo / Image</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Durée (secondes)</Label>
                    <Input name="splashDuration" type="number" step="0.5" defaultValue={splashSettings?.splashDuration || 2.5} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Texte principal</Label>
                    <Input name="splashText" defaultValue={splashSettings?.splashText || 'Lagon & Brousse NC'} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Couleur de fond (Hex)</Label>
                    <Input name="splashBgColor" defaultValue={splashSettings?.splashBgColor || '#3b82f6'} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">URL de l'image</Label>
                    <Input name="splashImageUrl" defaultValue={splashSettings?.splashImageUrl || ''} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Ajustement image</Label>
                    <Select name="splashImageFit" defaultValue={splashSettings?.splashImageFit || 'contain'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="contain">Contenir (Entier)</SelectItem><SelectItem value="cover">Couvrir (Remplir)</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={isSavingSplash} className="w-full h-12 font-black uppercase tracking-widest gap-2">
                  {isSavingSplash ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />} Sauvegarder le Design
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fish" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-end mb-4 gap-2">
            <Button 
              variant="outline"
              onClick={handleRepairLengths} 
              disabled={isClearing || !fishSpecies || fishSpecies.length === 0}
              className="font-black uppercase text-[10px] gap-2 border-orange-500/20 bg-orange-50/5 text-orange-700"
            >
              {isClearing ? <RefreshCw className="size-4 animate-spin" /> : <Ruler className="size-4" />}
              Réparer Tailles (Auto NC)
            </Button>
            <Button 
              variant="outline"
              onClick={handleReadjustRisks} 
              disabled={isReadjustingRisks || !fishSpecies || fishSpecies.length === 0}
              className="font-black uppercase text-[10px] gap-2 border-primary/20 bg-primary/5"
            >
              {isReadjustingRisks ? <RefreshCw className="size-4 animate-spin" /> : <Scale className="size-4" />}
              Réajuster via Moyennes NC
            </Button>
            <Button onClick={() => { setCurrentFish({}); setIsFishDialogOpen(true); }} className="font-black uppercase text-[10px] gap-2">
              <Fish className="size-4" /> Ajouter un Poisson
            </Button>
          </div>
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Espèces Répertoriées ({fishSpecies?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">Photo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Nom</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Risque (P/M/G)</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fishSpecies?.map(f => {
                    const finalImg = f.imageUrl || (f.imagePlaceholder ? `https://picsum.photos/seed/${f.imagePlaceholder}/100/100` : null);
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="size-10 rounded border bg-muted flex items-center justify-center overflow-hidden">
                            {finalImg ? (
                              <Image src={finalImg} alt={f.name} width={40} height={40} className="object-cover" />
                            ) : (
                              <Fish className="size-4 opacity-20" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-xs">{f.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-[7px] font-black px-1">{f.gratteRiskSmall || 0}%</Badge>
                            <Badge variant="outline" className="text-[7px] font-black px-1">{f.gratteRiskMedium || 0}%</Badge>
                            <Badge variant="outline" className="text-[7px] font-black px-1">{f.gratteRiskLarge || 0}%</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setCurrentFish(f); setIsFishDialogOpen(true); }}><Pencil className="size-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteFish(f.id)}><Trash2 className="size-3 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sounds" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setCurrentSound({}); setIsSoundDialogOpen(true); }} className="font-black uppercase text-[10px] gap-2"><Plus className="size-4" /> Nouveau Son</Button>
          </div>
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Bibliothèque Sonore ({sounds?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Libellé</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {sounds?.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold text-xs">{s.label}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => new Audio(s.url).play()}><Play className="size-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setCurrentSound(s); setIsSoundDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSound(s.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className={cn("border-2 transition-colors", sharedToken && isBefore(new Date(), sharedToken.expiresAt.toDate()) ? "border-green-500 bg-green-50/10" : "border-primary/20")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><ShieldCheck className="size-4" /> Accès Offert (Global)</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Si activé, tous les utilisateurs inscrits ont un accès Premium.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleToggleGlobalAccess} disabled={isSavingSharedToken} className="w-full h-12 font-black uppercase tracking-widest">
                  {isSavingSharedToken ? <RefreshCw className="size-4 animate-spin" /> : (sharedToken && isBefore(new Date(), sharedToken.expiresAt.toDate()) ? 'Désactiver l\'accès global' : 'Activer pour tout le monde')}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><Ticket className="size-4" /> Générateur de Jetons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Nombre</Label><Input type="number" value={tokenCount} onChange={e => setTokenCount(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Mois</Label><Input type="number" value={tokenMonths} onChange={e => setTokenMonths(e.target.value)} /></div>
                </div>
                <Button onClick={handleGenerateTokens} disabled={isGeneratingTokens} className="w-full h-12 font-black uppercase tracking-widest bg-accent">Générer les codes</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm">
                <FileText className="size-4" /> Documents Administratifs
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase">Accès rapide aux fichiers de gestion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border-2 border-dashed border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg shadow-sm">
                    <Landmark className="size-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">RIB Officiel</span>
                    <span className="text-xs font-bold">RIB_Lagon_Brousse_NC.pdf</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-10 font-black uppercase text-[10px] gap-2 border-2" 
                  onClick={() => window.open('/RIB_Lagon_Brousse_NC.pdf', '_blank')}
                >
                  <Download className="size-3" /> telecharger sur le smartphone
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Button className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => { setCurrentFaq({ categorie: 'General', ordre: 0, views: 0 }); setIsFaqDialogOpen(true); }}>
                <Plus className="size-4" /> Ajouter Manuellement
            </Button>
            <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2 border-primary/20 bg-primary/5" onClick={handleSeedFaq} disabled={isGenerating || (rawFaqs && rawFaqs.length > 0)}>
                {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : <DatabaseZap className="size-4 text-primary" />}
                Peupler FAQ (100 Auto)
            </Button>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" disabled={isClearing || !rawFaqs || rawFaqs.length === 0}>
                        <Trash2 className="size-4" /> vider la FAQ ({rawFaqs?.length || 0})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action supprimera TOUTES les questions de la base de connaissances. Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearFaq} className="bg-destructive text-white">Confirmer la suppression</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>

          <Card className="border-2">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm">
                <HelpCircle className="size-4" /> Base de connaissances ({sortedFaqs.length})
              </CardTitle>
              <div className="flex items-center gap-2 min-w-[200px]">
                <Filter className="size-3 text-muted-foreground" />
                <Select value={faqCategoryFilter} onValueChange={setFaqCategoryFilter}>
                  <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-muted/30 border-2">
                    <SelectValue placeholder="Catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px] font-black uppercase">Toutes les catégories</SelectItem>
                    {FAQ_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-[10px] font-black uppercase">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="text-[10px] font-black uppercase cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort('question')}
                    >
                      <div className="flex items-center">Question <SortIcon field="question" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-[10px] font-black uppercase cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort('views')}
                    >
                      <div className="flex items-center">Vues <SortIcon field="views" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-[10px] font-black uppercase cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort('categorie')}
                    >
                      <div className="flex items-center">Catégorie <SortIcon field="categorie" /></div>
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFaqs.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold text-xs max-w-[200px] truncate">{f.question}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[8px] font-black">{f.views || 0}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] uppercase font-black">{f.categorie}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setCurrentFaq(f); setIsFaqDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><MessageSquare className="size-4" /> Tickets Support</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Utilisateur</TableHead><TableHead className="text-[10px] font-black uppercase">Sujet</TableHead><TableHead className="text-[10px] font-black uppercase">Statut</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tickets?.map(t => (
                    <TableRow key={t.id} className={cn(t.statut === 'ouvert' && "bg-primary/5")}>
                      <TableCell className="text-[10px] font-bold">{t.userEmail}</TableCell>
                      <TableCell className="text-[10px] font-black uppercase">{t.sujet}</TableCell>
                      <TableCell><Badge variant={t.statut === 'ouvert' ? 'default' : 'secondary'} className="text-[8px] uppercase font-black">{t.statut}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase" onClick={() => { setCurrentTicket(t); setAdminResponse(t.adminResponse || ''); }}>Répondre</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cgv" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Conditions Générales de Vente</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={loadCgvTemplate} className="w-full text-[10px] font-black uppercase border-dashed border-2">Charger le modèle conforme NC</Button>
              <Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[400px] text-xs font-medium" />
              <Button onClick={handleSaveCgv} disabled={isSavingCgv} className="w-full h-12 font-black uppercase">Enregistrer & Publier</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Utilisateurs ({users?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">User</TableHead><TableHead className="text-[10px] font-black uppercase">Statut</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users?.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-bold text-xs"><div className="flex flex-col"><span>{u.displayName}</span><span className="text-[9px] opacity-50">{u.email}</span></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black">{u.subscriptionStatus}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon"><Pencil className="size-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Tickets Ouverts</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{tickets?.filter(t => t.statut === 'ouvert').length || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">FAQ Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{rawFaqs?.length || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Total Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-primary">{users?.length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs FAQ, Fish, Sounds, etc. */}
      <Dialog open={isFaqDialogOpen} onOpenChange={setIsFaqDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Éditer FAQ</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Question</Label><Input value={currentFaq.question || ''} onChange={e => setCurrentFaq({...currentFaq, question: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Réponse</Label><Textarea value={currentFaq.reponse || ''} onChange={e => setCurrentFaq({...currentFaq, reponse: e.target.value})} className="min-h-[120px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Catégorie</Label>
                <Select value={currentFaq.categorie} onValueChange={(v:any) => setCurrentFaq({...currentFaq, categorie: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FAQ_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Ordre</Label><Input type="number" value={currentFaq.ordre || 0} onChange={e => setCurrentFaq({...currentFaq, ordre: parseInt(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveFaq} disabled={isSavingFaq} className="w-full h-12 font-black uppercase shadow-lg">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFishDialogOpen} onOpenChange={setIsFishDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-black uppercase">Fiche Poisson</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Nom Commun</Label><Input value={currentFish.name || ''} onChange={e => setCurrentFish({...currentFish, name: e.target.value})} /></div>
              <Button onClick={handleAIGenerateFish} disabled={isAIGeneratingFish || !currentFish.name} className="h-10 px-3 bg-indigo-600 text-white gap-2"><Sparkles className="size-4" /> IA</Button>
            </div>
            
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Scientifique</Label><Input value={currentFish.scientificName || ''} onChange={currentFish.scientificName = e.target.value)} /></div>

            <div className="bg-muted/30 p-4 rounded-xl border-2 space-y-4">
              <Label className="text-[10px] font-black uppercase text-primary">Risques & Longueurs par Taille</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase opacity-60">Petit (%)</Label>
                  <Input type="number" value={currentFish.gratteRiskSmall || 0} onChange={e => setCurrentFish({...currentFish, gratteRiskSmall: parseInt(e.target.value)})} />
                  <div className="flex items-center gap-1">
                    <Ruler className="size-3 opacity-40" />
                    <Input placeholder="Ex: < 30cm" value={currentFish.lengthSmall || ''} onChange={e => setCurrentFish({...currentFish, lengthSmall: e.target.value})} className="h-7 text-[10px]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase opacity-60">Moyen (%)</Label>
                  <Input type="number" value={currentFish.gratteRiskMedium || 0} onChange={e => setCurrentFish({...currentFish, gratteRiskMedium: parseInt(e.target.value)})} />
                  <div className="flex items-center gap-1">
                    <Ruler className="size-3 opacity-40" />
                    <Input placeholder="Ex: 30-60cm" value={currentFish.lengthMedium || ''} onChange={e => setCurrentFish({...currentFish, lengthMedium: e.target.value})} className="h-7 text-[10px]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase opacity-60">Grand (%)</Label>
                  <Input type="number" value={currentFish.gratteRiskLarge || 0} onChange={e => setCurrentFish({...currentFish, gratteRiskLarge: parseInt(e.target.value)})} />
                  <div className="flex items-center gap-1">
                    <Ruler className="size-3 opacity-40" />
                    <Input placeholder="Ex: > 60cm" value={currentFish.lengthLarge || ''} onChange={e => setCurrentFish({...currentFish, lengthLarge: e.target.value})} className="h-7 text-[10px]" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase opacity-60">Photo du poisson</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 h-12 border-2 border-dashed gap-2 text-[10px] font-black uppercase"
                    onClick={() => fishFileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    Télécharger Photo
                  </Button>
                  <input 
                    type="file" 
                    ref={fishFileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFishPhotoUpload} 
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase opacity-40">Ou URL directe</Label>
                  <Input value={currentFish.imageUrl || ''} onChange={e => setCurrentFish({...currentFish, imageUrl: e.target.value})} placeholder="https://..." className="h-9 text-xs" />
                </div>

                {currentFish.imageUrl && (
                  <div className="relative size-24 rounded-lg overflow-hidden border-2 mt-1">
                    <img src={currentFish.imageUrl} alt="Fish Preview" className="object-cover w-full h-full" />
                    <button 
                      type="button"
                      className="absolute top-0 right-0 p-1 bg-destructive text-white rounded-bl-lg"
                      onClick={() => setCurrentFish(prev => ({ ...prev, imageUrl: '' }))}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <Label className="text-xs font-bold uppercase opacity-60">ID Placeholder (Picsum)</Label>
              <Input value={currentFish.imagePlaceholder || ''} onChange={e => setCurrentFish({...currentFish, imagePlaceholder: e.target.value})} placeholder="fish-nom" />
            </div>

            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Conseils Pêche</Label><Textarea value={currentFish.fishingAdvice || ''} onChange={e => setCurrentFish({...currentFish, fishingAdvice: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Conseils Cuisine</Label><Textarea value={currentFish.culinaryAdvice || ''} onChange={e => setCurrentFish({...currentFish, culinaryAdvice: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveFish} disabled={isSavingFish} className="w-full h-12 font-black uppercase shadow-lg">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSoundDialogOpen} onOpenChange={setIsSoundDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Nouveau Signal Sonore</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Libellé</Label><Input value={currentSound.label || ''} onChange={e => setCurrentSound({...currentSound, label: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">URL du fichier MP3</Label><Input value={currentSound.url || ''} onChange={e => setCurrentSound({...currentSound, url: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveSound} disabled={isSavingSound} className="w-full h-12 font-black uppercase shadow-lg">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
