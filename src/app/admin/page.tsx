
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo, SoundLibraryEntry, FaqEntry, SupportTicket, CgvSettings, RibSettings, Business } from '@/lib/types';
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
  Landmark,
  CreditCard,
  Briefcase,
  Store
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // RIB States
  const [ribDetails, setRibDetails] = useState('');
  const [isSavingRib, setIsSavingRib] = useState(false);

  // Splash States
  const [isSavingSplash, setIsSavingSplash] = useState(false);

  // User Edit States
  const [isUserEditDialogOpen, setIsUserEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

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

  // Business States
  const [isBusinessDialogOpen, setIsBusinessDialogOpen] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState<Partial<Business>>({});
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.toLowerCase();
    const uid = user.uid;
    return email === 'f.mallet81@outlook.com' || 
           email === 'f.mallet81@gmail.com' || 
           email === 'fabrice.mallet@gmail.com' ||
           uid === 'K9cVYLVUk1NV99YV3anebkugpPp1' ||
           uid === 'Irglq69MasYdNwBmUu8yKvw6h4G2';
  }, [user]);

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

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'businesses'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: businesses } = useCollection<Business>(businessRef);

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

  const ribRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'rib');
  }, [firestore, isAdmin]);
  const { data: dbRib } = useDoc<RibSettings>(ribRef);

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

  const accessTokensRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: accessTokens } = useCollection<AccessToken>(accessTokensRef);

  useEffect(() => {
    if (dbCgv) setCgvContent(dbCgv.content || '');
  }, [dbCgv]);

  useEffect(() => {
    if (dbRib) setRibDetails(dbRib.details || '');
  }, [dbRib]);

  const handleEditUser = (u: UserAccount) => {
    setUserToEdit(u);
    setIsUserEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!firestore || !isAdmin || !userToEdit) return;
    setIsSavingUser(true);
    try {
      await setDoc(doc(firestore, 'users', userToEdit.id), userToEdit, { merge: true });
      toast({ title: "Utilisateur mis à jour" });
      setIsUserEditDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur mise à jour" });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!firestore || !isAdmin) return;
    try {
      await deleteDoc(doc(firestore, 'users', userId));
      toast({ title: "Compte utilisateur supprimé de Firestore." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur suppression" });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleSaveBusiness = async () => {
    if (!firestore || !isAdmin || !currentBusiness.name || !currentBusiness.ownerId) return;
    setIsSavingBusiness(true);
    try {
      const id = currentBusiness.id || currentBusiness.name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(firestore, 'businesses', id), {
        ...currentBusiness,
        id,
        createdAt: currentBusiness.createdAt || serverTimestamp()
      }, { merge: true });
      toast({ title: "Commerce enregistré !", description: `ID à lier : ${id}` });
      setIsBusinessDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur sauvegarde commerce" });
    } finally {
      setIsSavingBusiness(false);
    }
  };

  const handleDeleteBusiness = async (id: string) => {
    if (!firestore || !isAdmin) return;
    try {
      await deleteDoc(doc(firestore, 'businesses', id));
      toast({ title: "Commerce supprimé" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur suppression" });
    }
  };

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

  const handleSaveRib = async () => {
    if (!firestore || !isAdmin) return;
    setIsSavingRib(true);
    try {
      await setDoc(doc(firestore, 'app_settings', 'rib'), {
        details: ribDetails,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "RIB sauvegardé !", description: "Les utilisateurs verront ces détails lors du clic sur DONS." });
    } finally {
      setIsSavingRib(false);
    }
  };

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

  const handleAIGenerateFish = async () => {
    if (!currentFish.name && !currentFish.scientificName) return;
    setIsAIGeneratingFish(true);
    try {
      const info = await generateFishInfo({ 
        name: currentFish.name || "", 
        scientificName: currentFish.scientificName || "" 
      });
      setCurrentFish(prev => ({ 
        ...prev,
        ...info,
        scientificName: prev.scientificName || info.scientificName,
      }));
      toast({ title: "Fiche générée par IA" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur IA" });
    } finally {
      setIsAIGeneratingFish(false);
    }
  };

  const handleSaveFish = async () => {
    if (!firestore || !isAdmin || !currentFish.name) return;
    setIsSavingFish(true);
    try {
      const id = currentFish.id || currentFish.name.toLowerCase().replace(/\s+/g, '-');
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
      toast({ variant: 'destructive', title: "Erreur enregistrement" });
    } finally {
      setIsSavingFish(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter text-xl">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 mb-6 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase">Stats</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase">Users</TabsTrigger>
          <TabsTrigger value="commerces" className="text-[10px] font-black uppercase">Commerces</TabsTrigger>
          <TabsTrigger value="faq" className="text-[10px] font-black uppercase">FAQ</TabsTrigger>
          <TabsTrigger value="tickets" className="text-[10px] font-black uppercase">Tickets</TabsTrigger>
          <TabsTrigger value="cgv" className="text-[10px] font-black uppercase">CGV</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase">Design</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase">Fish</TabsTrigger>
          <TabsTrigger value="sounds" className="text-[10px] font-black uppercase">Sons</TabsTrigger>
          <TabsTrigger value="access" className="text-[10px] font-black uppercase">Accès</TabsTrigger>
          <TabsTrigger value="docs" className="text-[10px] font-black uppercase">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Utilisateurs ({users?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">User</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Statut</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-bold text-xs">
                        <div className="flex flex-col">
                          <span>{u.displayName}</span>
                          <span className="text-[9px] opacity-50">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[8px] font-black", u.subscriptionStatus === 'professional' && "border-primary text-primary")}>
                          {u.subscriptionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(u)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setUserToDelete(u.id)}>
                            <Trash2 className="size-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commerces" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setCurrentBusiness({}); setIsBusinessDialogOpen(true); }} className="font-black uppercase text-[10px] gap-2">
              <Plus className="size-4" /> Nouveau Commerce
            </Button>
          </div>
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Commerces ({businesses?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">Nom</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Commune</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">ID à lier</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses?.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-bold text-xs">{b.name}</TableCell>
                      <TableCell className="text-xs uppercase font-bold opacity-60">{b.commune}</TableCell>
                      <TableCell className="text-xs font-mono bg-muted/30 px-2 py-1 rounded select-all">{b.id}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setCurrentBusiness(b); setIsBusinessDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteBusiness(b.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
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
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Total Users</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-primary">{users?.length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <Dialog open={isUserEditDialogOpen} onOpenChange={setIsUserEditDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase">Éditer l'utilisateur</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">{userToEdit?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold opacity-60">Rôle</Label>
              <Select value={userToEdit?.role || 'client'} onValueChange={(v: any) => setUserToEdit(p => p ? {...p, role: v} : null)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="professional">Professionnel</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold opacity-60">Statut Abonnement</Label>
              <Select value={userToEdit?.subscriptionStatus || 'trial'} onValueChange={(v: any) => setUserToEdit(p => p ? {...p, subscriptionStatus: v} : null)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Essai</SelectItem>
                  <SelectItem value="active">Abonné Actif</SelectItem>
                  <SelectItem value="professional">Professionnel</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="inactive">Inactif / Limité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold opacity-60">ID Commerce (Pro)</Label>
              <Input value={userToEdit?.businessId || ''} onChange={e => setUserToEdit(p => p ? {...p, businessId: e.target.value} : null)} placeholder="Copiez l'ID du commerce ici" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveUser} disabled={isSavingUser} className="w-full h-12 font-black uppercase">Mettre à jour</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBusinessDialogOpen} onOpenChange={setIsBusinessDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase">Gérer le Commerce</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase">Création d'un profil magasin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold opacity-60">Nom du magasin</Label>
              <Input value={currentBusiness.name || ''} onChange={e => setCurrentBusiness({...currentBusiness, name: e.target.value})} placeholder="Ex: Pêche Passion" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold opacity-60">UID Propriétaire</Label>
              <Input value={currentBusiness.ownerId || ''} onChange={e => setCurrentBusiness({...currentBusiness, ownerId: e.target.value})} placeholder="UID Firebase du pro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Commune</Label>
                <Input value={currentBusiness.commune || ''} onChange={e => setCurrentBusiness({...currentBusiness, commune: e.target.value})} placeholder="Nouméa" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Catégorie</Label>
                <Select value={currentBusiness.category || ''} onValueChange={(v: any) => setCurrentBusiness({...currentBusiness, category: v})}>
                  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pêche">Pêche</SelectItem>
                    <SelectItem value="Chasse">Chasse</SelectItem>
                    <SelectItem value="Jardinage">Jardinage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveBusiness} disabled={isSavingBusiness} className="w-full h-12 font-black uppercase">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action supprimera uniquement le document profil de Firestore. L'authentification Firebase ne sera pas affectée.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && handleDeleteUser(userToDelete)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
