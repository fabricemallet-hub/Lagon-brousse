'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc, increment } from 'firebase/firestore';
import type { UserAccount, Business, Conversation, AccessToken, SharedAccessToken, SplashScreenSettings, CgvSettings, RibSettings, SystemNotification, FishSpeciesInfo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Zap, 
  Ticket, 
  Sparkles,
  Search,
  UserCog,
  MessageSquare,
  Users as UsersIcon,
  Settings,
  Bell,
  Eye,
  Plus,
  Save,
  Mail,
  Smartphone,
  FileText,
  Landmark,
  ExternalLink,
  ChevronRight,
  Fish,
  Pencil,
  BrainCircuit,
  ImageIcon,
  X,
  AlertTriangle,
  Target,
  ChefHat
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('stats');

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminUids = [
      't8nPnZLcTiaLJSKMuLzib3C5nPn1',
      'koKj5ObSGXYeO1PLKU5bgo8Yaky1',
      'D1q2GPM95rZi38cvCzvsjcWQDaV2',
      'K9cVYLVUk1NV99YV3anebkugpPp1',
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
      'Irglq69MasYdNwBmUu8yKvw6h4G2'
    ];
    const masterEmails = [
      'f.mallet81@outlook.com', 
      'fabrice.mallet@gmail.com', 
      'f.mallet81@gmail.com', 
      'kledostyle@outlook.com'
    ];
    const userEmail = user.email?.toLowerCase() || '';
    return masterAdminUids.includes(user.uid) || (userEmail && masterEmails.includes(userEmail));
  }, [user]);

  const usersRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'users') : null, [firestore, isAdmin]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserAccount>(usersRef);

  const businessRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'businesses') : null, [firestore, isAdmin]);
  const { data: businesses } = useCollection<Business>(businessRef);

  const convsRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: conversations } = useCollection<Conversation>(convsRef);

  const tokensRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: tokens } = useCollection<AccessToken>(tokensRef);

  const sharedTokenRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'shared_access_tokens', 'GLOBAL') : null, [firestore, isAdmin]);
  const { data: globalGift } = useDoc<SharedAccessToken>(sharedTokenRef);

  useEffect(() => {
    if (!isUserLoading && !isAdmin && user) router.push('/compte');
  }, [isAdmin, isUserLoading, router, user]);

  if (isUserLoading) return <div className="p-8"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!isAdmin) return <div className="p-12 text-center font-black uppercase text-muted-foreground animate-pulse">Accès Master Requis...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
            <ShieldCheck className="size-48" />
        </div>
        <CardHeader className="py-8 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-3xl">Tableau de Bord Administrateur</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-6 h-auto bg-muted/50 border-2 rounded-2xl p-1.5 shadow-sm gap-1">
          <TabsTrigger value="stats" className="text-[10px] font-black uppercase py-3 rounded-xl">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase py-3 rounded-xl">Utilisateurs</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase py-3 rounded-xl">Design & Splash</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase py-3 rounded-xl">Guide Poissons</TabsTrigger>
          <TabsTrigger value="acces" className="text-[10px] font-black uppercase py-3 rounded-xl">Accès</TabsTrigger>
          <TabsTrigger value="support" className="text-[10px] font-black uppercase py-3 rounded-xl">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary">Abonnés</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-accent">Commerces</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{businesses?.length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-green-600">Support</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{conversations?.length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
            <div className="grid grid-cols-1 gap-6">
                <PermissionsManager users={users} />
                <UsersManager users={users} />
            </div>
        </TabsContent>
        
        <TabsContent value="design">
            <AppSettingsManager />
        </TabsContent>

        <TabsContent value="fish">
            <FishGuideManager />
        </TabsContent>

        <TabsContent value="acces">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlobalAccessManager globalGift={globalGift} />
            <TokenManager tokens={tokens} />
          </div>
        </TabsContent>

        <TabsContent value="support"><SupportManager conversations={conversations} /></TabsContent>
      </Tabs>
    </div>
  );
}

function FishGuideManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingFish, setEditingFish] = useState<FishSpeciesInfo | null>(null);

    // Form States
    const [name, setName] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [category, setCategory] = useState<'Lagon' | 'Large' | 'Recif'>('Lagon');
    const [gratteRiskSmall, setGratteRiskSmall] = useState('0');
    const [gratteRiskMedium, setGratteRiskMedium] = useState('0');
    const [gratteRiskLarge, setGratteRiskLarge] = useState('0');
    const [lengthSmall, setLengthSmall] = useState('< 30cm');
    const [lengthMedium, setLengthMedium] = useState('30-60cm');
    const [lengthLarge, setLengthLarge] = useState('> 60cm');
    const [fishingAdvice, setFishingAdvice] = useState('');
    const [culinaryAdvice, setCulinaryAdvice] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const fishRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'fish_species'), orderBy('name', 'asc')) : null, [firestore]);
    const { data: species, isLoading } = useCollection<FishSpeciesInfo>(fishRef);

    const filtered = species?.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.scientificName.toLowerCase().includes(search.toLowerCase())) || [];

    const resetForm = () => {
        setEditingFish(null);
        setName('');
        setScientificName('');
        setCategory('Lagon');
        setGratteRiskSmall('0');
        setGratteRiskMedium('0');
        setGratteRiskLarge('0');
        setLengthSmall('< 30cm');
        setLengthMedium('30-60cm');
        setLengthLarge('> 60cm');
        setFishingAdvice('');
        setCulinaryAdvice('');
        setImageUrl('');
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleEdit = (fish: FishSpeciesInfo) => {
        setEditingFish(fish);
        setName(fish.name);
        setScientificName(fish.scientificName);
        setCategory(fish.category);
        setGratteRiskSmall(fish.gratteRiskSmall?.toString() || '0');
        setGratteRiskMedium(fish.gratteRiskMedium?.toString() || '0');
        setGratteRiskLarge(fish.gratteRiskLarge?.toString() || '0');
        setLengthSmall(fish.lengthSmall || '< 30cm');
        setLengthMedium(fish.lengthMedium || '30-60cm');
        setLengthLarge(fish.lengthLarge || '> 60cm');
        setFishingAdvice(fish.fishingAdvice || '');
        setCulinaryAdvice(fish.culinaryAdvice || '');
        setImageUrl(fish.imageUrl || '');
        setIsDialogOpen(true);
    };

    const handleGenerateIA = async () => {
        if (!name) { toast({ variant: 'destructive', title: "Nom requis", description: "Saisissez au moins le nom commun." }); return; }
        setIsGenerating(true);
        try {
            const info = await generateFishInfo({ name, scientificName });
            setScientificName(info.scientificName);
            setCategory(info.category);
            setGratteRiskSmall(info.gratteRiskSmall.toString());
            setGratteRiskMedium(info.gratteRiskMedium.toString());
            setGratteRiskLarge(info.gratteRiskLarge.toString());
            setLengthSmall(info.lengthSmall);
            setLengthMedium(info.lengthMedium);
            setLengthLarge(info.lengthLarge);
            setFishingAdvice(info.fishingAdvice);
            setCulinaryAdvice(info.culinaryAdvice);
            toast({ title: "Fiche générée par l'IA !" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur IA" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        if (!firestore || !name) return;
        setIsSaving(true);
        const data: any = {
            name, scientificName, category,
            gratteRiskSmall: parseInt(gratteRiskSmall),
            gratteRiskMedium: parseInt(gratteRiskMedium),
            gratteRiskLarge: parseInt(gratteRiskLarge),
            gratteRisk: parseInt(gratteRiskMedium), // legacy compatibility
            lengthSmall, lengthMedium, lengthLarge,
            fishingAdvice, culinaryAdvice, imageUrl,
            updatedAt: serverTimestamp()
        };

        const docRef = editingFish 
            ? doc(firestore, 'fish_species', editingFish.id)
            : doc(collection(firestore, 'fish_species'));

        setDoc(docRef, data, { merge: true })
            .then(() => {
                toast({ title: editingFish ? "Fiche mise à jour" : "Poisson ajouté" });
                setIsDialogOpen(false);
                setIsSaving(false);
            })
            .catch(error => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data
                }));
                setIsSaving(false);
            });
    };

    const handleDelete = (id: string) => {
        if (!firestore) return;
        deleteDoc(doc(firestore, 'fish_species', id));
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Fish className="size-6 text-primary" /> Guide Poissons</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Gérez les espèces affichées dans l'application.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input placeholder="Chercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 border-2 font-bold text-xs" />
                    </div>
                    <Button onClick={handleOpenAdd} className="h-10 font-black uppercase text-[10px] gap-2"><Plus className="size-4" /> Ajouter</Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
                {isLoading ? <div className="p-8"><Skeleton className="h-32 w-full" /></div> : (
                    <div className="divide-y">
                        {filtered.map(f => (
                            <div key={f.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="size-16 rounded-xl bg-muted overflow-hidden border shrink-0 flex items-center justify-center">
                                        {f.imageUrl ? <img src={f.imageUrl} className="w-full h-full object-cover" /> : <Fish className="size-8 opacity-20" />}
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase text-sm">{f.name}</h4>
                                        <p className="text-[10px] italic opacity-60">{f.scientificName}</p>
                                        <Badge variant="secondary" className="mt-1 text-[8px] font-black uppercase h-4">{f.category}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="size-9 border-2" onClick={() => handleEdit(f)}><Pencil className="size-4" /></Button>
                                    <Button variant="ghost" size="icon" className="size-9 text-destructive border-2" onClick={() => handleDelete(f.id)}><Trash2 className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                            {editingFish ? <Pencil className="size-5" /> : <Plus className="size-5" />} 
                            {editingFish ? "Modifier" : "Ajouter un poisson"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Nom commun (NC)</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-11 border-2 font-black" placeholder="Ex: Bec de cane" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Nom Scientifique</Label><Input value={scientificName} onChange={e => setScientificName(e.target.value)} className="h-11 border-2 font-bold italic" placeholder="Ex: Lethrinus nebulosus" /></div>
                            <Button onClick={handleGenerateIA} disabled={isGenerating} variant="secondary" className="w-full h-11 font-black uppercase text-[10px] gap-2 border-2"><BrainCircuit className={cn("size-4", isGenerating && "animate-pulse")} /> {isGenerating ? "Analyse..." : "Générer via IA (Gemini)"}</Button>
                            
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Habitat</Label>
                                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                    <SelectTrigger className="h-11 border-2 font-black text-[10px] uppercase"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Lagon">Lagon</SelectItem><SelectItem value="Recif">Récif</SelectItem><SelectItem value="Large">Large</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">URL Photo (Optionnel)</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="h-11 border-2 text-xs" /></div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-muted/20 rounded-xl border-2 border-dashed space-y-4">
                                <p className="text-[10px] font-black uppercase text-center opacity-40">Risques de Gratte (%)</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Petit</Label><Input type="number" value={gratteRiskSmall} onChange={e => setGratteRiskSmall(e.target.value)} className="h-9 border-2 font-bold" /></div>
                                    <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Moyen</Label><Input type="number" value={gratteRiskMedium} onChange={e => setGratteRiskMedium(e.target.value)} className="h-9 border-2 font-bold" /></div>
                                    <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Grand</Label><Input type="number" value={gratteRiskLarge} onChange={e => setGratteRiskLarge(e.target.value)} className="h-9 border-2 font-bold" /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <Input value={lengthSmall} onChange={e => setLengthSmall(e.target.value)} className="h-8 text-[8px] font-black" />
                                    <Input value={lengthMedium} onChange={e => setLengthMedium(e.target.value)} className="h-8 text-[8px] font-black" />
                                    <Input value={lengthLarge} onChange={e => setLengthLarge(e.target.value)} className="h-8 text-[8px] font-black" />
                                </div>
                            </div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase flex items-center gap-2"><Target className="size-3" /> Pêche</Label><Textarea value={fishingAdvice} onChange={e => setFishingAdvice(e.target.value)} className="text-xs min-h-[80px]" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase flex items-center gap-2"><ChefHat className="size-3" /> Cuisine</Label><Textarea value={culinaryAdvice} onChange={e => setCulinaryAdvice(e.target.value)} className="text-xs min-h-[80px]" /></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">{isSaving ? "Enregistrement..." : "Sauvegarder la fiche"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function GlobalAccessManager({ globalGift }: { globalGift: SharedAccessToken | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [duration, setDuration] = useState('7');
    const [isSaving, setIsSaving] = useState(false);

    const handleActivate = () => {
        if (!firestore) return;
        setIsSaving(true);
        const expiry = Timestamp.fromDate(addDays(new Date(), parseInt(duration)));
        const docRef = doc(firestore, 'shared_access_tokens', 'GLOBAL');
        const data = { expiresAt: expiry, updatedAt: serverTimestamp() };
        
        setDoc(docRef, data, { merge: true })
            .then(() => {
                toast({ title: "Accès Global activé !" });
                setIsSaving(false);
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data,
                }));
                setIsSaving(false);
            });
    };

    const handleStop = () => {
        if (!firestore) return;
        setIsSaving(true);
        const docRef = doc(firestore, 'shared_access_tokens', 'GLOBAL');
        const data = { expiresAt: Timestamp.fromDate(new Date(0)), updatedAt: serverTimestamp() };
        
        setDoc(docRef, data, { merge: true })
            .then(() => {
                toast({ title: "Accès Global coupé" });
                setIsSaving(false);
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data,
                }));
                setIsSaving(false);
            });
    };

    const isGlobalActive = globalGift && globalGift.expiresAt && isBeforeNow(globalGift.expiresAt);

    function isBeforeNow(ts: any) {
        const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
        return date.getTime() > Date.now();
    }

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-6" /> Accès Cadeau Global</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className={cn("p-4 rounded-2xl border-2 flex items-center justify-between", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase opacity-60">Statut</span>
                        <p className={cn("text-sm font-black", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>
                            {isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'INACTIF'}
                        </p>
                    </div>
                    {isGlobalActive && <Button variant="destructive" size="sm" onClick={handleStop} disabled={isSaving} className="h-8 font-black uppercase text-[10px]">Couper</Button>}
                </div>
                <div className="space-y-4">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Durée</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger className="h-12 border-2 font-black"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="1">1 jour</SelectItem><SelectItem value="7">1 semaine</SelectItem><SelectItem value="30">1 mois</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleActivate} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest bg-primary shadow-lg">Activer l'offre</Button>
                </div>
            </CardContent>
        </Card>
    );
}

function TokenManager({ tokens }: { tokens: AccessToken[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [duration, setDuration] = useState('1');
    const [isGenerating, setIsGenerating] = useState(false);

    const generateToken = () => {
        if (!firestore) return;
        setIsGenerating(true);
        const id = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const docRef = doc(firestore, 'access_tokens', id);
        const data = { id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp() };

        setDoc(docRef, data)
            .then(() => {
                toast({ title: "Jeton généré !" });
                setIsGenerating(false);
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data,
                }));
                setIsGenerating(false);
            });
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Ticket className="size-6 text-accent" /> Jetons d'Accès</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Durée (mois)</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="1">1 mois</SelectItem><SelectItem value="3">3 mois</SelectItem><SelectItem value="6">6 mois</SelectItem><SelectItem value="12">12 mois</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end"><Button onClick={generateToken} disabled={isGenerating} className="w-full h-12 font-black uppercase bg-accent shadow-lg"><Zap className="size-4 mr-2" /> Générer</Button></div>
                </div>
                <div className="max-h-64 overflow-y-auto border-2 rounded-2xl">
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[9px] font-black uppercase h-8 px-3">Code</TableHead><TableHead className="text-[9px] font-black uppercase h-8">Durée</TableHead><TableHead className="text-right text-[9px] font-black uppercase h-8 px-3">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {tokens?.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="px-3 py-2 font-mono text-[10px] font-black">{t.id}</TableCell>
                                    <TableCell className="text-[10px] font-bold">{t.durationMonths} m</TableCell>
                                    <TableCell className="text-right px-3">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => deleteDoc(doc(firestore!, 'access_tokens', t.id))} 
                                            className="size-7 text-destructive"
                                        >
                                            <Trash2 className="size-3" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function PermissionsManager({ users }: { users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(u => 
            u.email.toLowerCase().includes(search.toLowerCase()) || 
            u.displayName.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 50);
    }, [users, search]);

    const handleRoleChange = (userId: string, newRole: string) => {
        if (!firestore) return;
        setIsUpdating(userId);
        const updateData = { 
            role: newRole, 
            subscriptionStatus: newRole === 'admin' ? 'admin' : (newRole === 'professional' ? 'professional' : 'trial') 
        };
        
        updateDoc(doc(firestore, 'users', userId), updateData)
            .then(() => {
                toast({ title: "Permissions mises à jour" });
                setIsUpdating(null);
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `/users/${userId}`,
                    operation: 'update',
                    requestResourceData: updateData,
                }));
                setIsUpdating(null);
            });
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
                <div><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-6" /> Gestion des Rôles</CardTitle></div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input placeholder="Chercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 border-2 font-bold text-xs" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Utilisateur</TableHead><TableHead>Rôle</TableHead><TableHead className="text-right px-4">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filteredUsers.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs uppercase">{u.displayName}</span><span className="text-[9px] font-bold opacity-40">{u.email}</span></div></TableCell>
                                <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase h-5">{u.role || 'client'}</Badge></TableCell>
                                <TableCell className="text-right px-4">
                                    <Select defaultValue={u.role || 'client'} onValueChange={(val) => handleRoleChange(u.id, val)} disabled={isUpdating === u.id}>
                                        <SelectTrigger className="w-32 h-8 text-[9px] font-black uppercase border-2"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="client">Client</SelectItem>
                                            <SelectItem value="professional">Professionnel</SelectItem>
                                            <SelectItem value="admin">Administrateur</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function UsersManager({ users }: { users: UserAccount[] | null }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        if (!users) return [];
        return users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase()));
    }, [users, search]);

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><UsersIcon className="size-6" /> Liste des Comptes</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Tous les utilisateurs enregistrés</CardDescription>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 border-2 font-bold text-xs" />
                </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                    <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Nom / Email</TableHead><TableHead>Abonnement</TableHead><TableHead className="text-right px-4">UID</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filtered.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs uppercase">{u.displayName}</span><span className="text-[9px] font-bold opacity-40">{u.email}</span></div></TableCell>
                                <TableCell><Badge variant="secondary" className="text-[8px] font-black uppercase">{u.subscriptionStatus}</Badge></TableCell>
                                <TableCell className="text-right px-4 font-mono text-[9px] opacity-40">{u.id}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function SupportManager({ conversations }: { conversations: Conversation[] | null }) {
    return (
        <Card className="border-2 shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><MessageSquare className="size-6" /> Support Technique</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Messages directs des utilisateurs</CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-t">
                {conversations && conversations.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Utilisateur</TableHead><TableHead>Dernier message</TableHead><TableHead className="text-right px-4">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {conversations.map(c => (
                                <TableRow key={c.id} className={cn(!c.isReadByAdmin && "bg-primary/5")}>
                                    <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs uppercase">{c.userDisplayName}</span><span className="text-[9px] font-bold opacity-40">{c.userEmail}</span></div></TableCell>
                                    <TableCell className="max-w-[200px] truncate italic text-xs">"{c.lastMessageContent}"</TableCell>
                                    <TableCell className="text-right px-4">
                                        <Button asChild size="sm" variant={c.isReadByAdmin ? "outline" : "default"} className="font-black uppercase text-[10px] h-8">
                                            <Link href={`/admin/messages/${c.id}`}>Répondre {!c.isReadByAdmin && <Badge className="ml-2 h-4 px-1 bg-white text-primary">1</Badge>}</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="py-20 text-center opacity-30"><MessageSquare className="size-12 mx-auto mb-4" /><p className="font-black uppercase text-xs">Aucune conversation</p></div>
                )}
            </CardContent>
        </Card>
    );
}

function AppSettingsManager() {
    const firestore = useFirestore();
    const { toast } = useToast();

    // Splash Settings
    const splashRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'splash') : null, [firestore]);
    const { data: splash } = useDoc<SplashScreenSettings>(splashRef);
    const [splashText, setSplashText] = useState('');
    const [splashColor, setSplashBgColor] = useState('#3b82f6');

    useEffect(() => { if (splash) { setSplashText(splash.splashText || ''); setSplashBgColor(splash.splashBgColor || '#3b82f6'); } }, [splash]);

    const handleSaveSplash = () => {
        if (!firestore) return;
        const ref = doc(firestore, 'app_settings', 'splash');
        updateDoc(ref, { splashText, splashBgColor: splashColor }).then(() => toast({ title: "Splash mis à jour" }));
    };

    // CGV Settings
    const cgvRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'cgv') : null, [firestore]);
    const { data: cgv } = useDoc<CgvSettings>(cgvRef);
    const [cgvContent, setCgvContent] = useState('');

    useEffect(() => { if (cgv) setCgvContent(cgv.content || ''); }, [cgv]);

    const handleSaveCgv = () => {
        if (!firestore) return;
        const ref = doc(firestore, 'app_settings', 'cgv');
        updateDoc(ref, { content: cgvContent, version: increment(1), updatedAt: serverTimestamp() }).then(() => toast({ title: "CGV mises à jour" }));
    };

    // RIB Settings
    const ribRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'rib') : null, [firestore]);
    const { data: rib } = useDoc<RibSettings>(ribRef);
    const [ribDetails, setRibDetails] = useState('');

    useEffect(() => { if (rib) setRibDetails(rib.details || ''); }, [rib]);

    const handleSaveRib = () => {
        if (!firestore) return;
        const ref = doc(firestore, 'app_settings', 'rib');
        updateDoc(ref, { details: ribDetails, updatedAt: serverTimestamp() }).then(() => toast({ title: "RIB mis à jour" }));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5" /> Splash Screen</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Texte d'accueil</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} className="font-bold border-2" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Couleur de fond</Label><div className="flex gap-2"><Input type="color" value={splashColor} onChange={e => setSplashBgColor(e.target.value)} className="h-10 w-20 border-2" /><Input value={splashColor} onChange={e => setSplashBgColor(e.target.value)} className="font-mono text-xs border-2" /></div></div>
                    <Button onClick={handleSaveSplash} className="w-full font-black uppercase text-[10px] h-10 gap-2"><Save className="size-3" /> Enregistrer</Button>
                </CardContent>
            </Card>

            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Landmark className="size-5" /> Coordonnées RIB</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Détails bancaires (Dons)</Label><Textarea value={ribDetails} onChange={e => setRibDetails(e.target.value)} className="font-mono text-[10px] min-h-[100px] border-2" /></div>
                    <Button onClick={handleSaveRib} className="w-full font-black uppercase text-[10px] h-10 gap-2"><Save className="size-3" /> Enregistrer</Button>
                </CardContent>
            </Card>

            <Card className="md:col-span-2 border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><FileText className="size-5" /> Conditions Générales (CGV)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Contenu du document</Label><Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[200px] border-2 font-medium text-xs leading-relaxed" /></div>
                    <Button onClick={handleSaveCgv} className="w-full h-12 font-black uppercase text-xs tracking-widest gap-2"><Save className="size-4" /> Publier la nouvelle version</Button>
                </CardContent>
            </Card>

            <div className="md:col-span-2"><SystemNotificationsManager /></div>
        </div>
    );
}

function SystemNotificationsManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

    const notifsRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'system_notifications'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const { data: notifications } = useCollection<SystemNotification>(notifsRef);

    const handleCreate = () => {
        if (!firestore || !title || !content) return;
        addDoc(collection(firestore, 'system_notifications'), {
            title, content, type, isActive: true, createdAt: serverTimestamp()
        }).then(() => { setTitle(''); setContent(''); toast({ title: "Notification publiée" }); });
    };

    const handleDelete = (id: string) => {
        if (!firestore) return;
        deleteDoc(doc(firestore, 'system_notifications', id));
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Bell className="size-5 text-primary" /> Notifications Système</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="border-2 font-bold" /></div>
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Type</Label>
                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                <SelectTrigger className="border-2 font-bold uppercase text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="info">Info (Bleu)</SelectItem><SelectItem value="warning">Alerte (Orange)</SelectItem><SelectItem value="error">Urgent (Rouge)</SelectItem><SelectItem value="success">Succès (Vert)</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Message</Label><Textarea value={content} onChange={e => setContent(e.target.value)} className="border-2 font-medium" /></div>
                    <Button onClick={handleCreate} className="w-full font-black uppercase h-12 shadow-lg"><Plus className="size-4 mr-2" /> Diffuser le message</Button>
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase opacity-40 px-1">Historique des diffusions</p>
                    <div className="grid gap-3">
                        {notifications?.map(n => (
                            <div key={n.id} className="flex items-center justify-between p-3 bg-white border-2 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={cn("size-2 rounded-full", n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500')} />
                                    <div className="flex flex-col">
                                        <span className="font-black uppercase text-[10px]">{n.title}</span>
                                        <span className="text-[9px] font-bold opacity-40 uppercase">{format(n.createdAt?.toDate() || new Date(), 'dd/MM/yy HH:mm')}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="text-destructive opacity-30 hover:opacity-100" onClick={() => handleDelete(n.id)}><Trash2 className="size-4" /></Button>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
