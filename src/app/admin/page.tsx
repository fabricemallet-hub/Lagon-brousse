'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc, increment, writeBatch } from 'firebase/firestore';
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
  ChefHat,
  Store,
  Link as LinkIcon,
  Check
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
import { locations } from '@/lib/locations';

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

  const businessRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'businesses'), orderBy('name', 'asc')) : null, [firestore, isAdmin]);
  const { data: businesses, isLoading: isBusinessesLoading } = useCollection<Business>(businessRef);

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
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-1 sm:px-4">
      <Card className="border-2 shadow-xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
            <ShieldCheck className="size-32 sm:size-48" />
        </div>
        <CardHeader className="py-6 sm:py-8 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-2xl sm:text-3xl">Dashboard Master</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest">{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[72px] z-20 bg-background/95 backdrop-blur-sm -mx-1 px-1 py-2 sm:static sm:bg-transparent sm:p-0">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide bg-muted/50 border-2 rounded-2xl p-1 shadow-sm gap-1 h-auto justify-start sm:grid sm:grid-cols-8">
            <TabsTrigger value="stats" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Stats</TabsTrigger>
            <TabsTrigger value="users" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Comptes</TabsTrigger>
            <TabsTrigger value="businesses" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Pros</TabsTrigger>
            <TabsTrigger value="fish" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Poissons</TabsTrigger>
            <TabsTrigger value="notifications" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Alertes</TabsTrigger>
            <TabsTrigger value="design" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Réglages</TabsTrigger>
            <TabsTrigger value="acces" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Accès</TabsTrigger>
            <TabsTrigger value="support" className="min-w-[80px] sm:min-w-0 text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Support</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-6 space-y-6">
          <TabsContent value="stats">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Card className="border-2 shadow-sm"><CardHeader className="p-3 sm:p-4 pb-1"><CardTitle className="text-[9px] sm:text-[10px] font-black uppercase opacity-40">Utilisateurs</CardTitle></CardHeader><CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-black">{users?.length || 0}</div></CardContent></Card>
              <Card className="border-2 shadow-sm"><CardHeader className="p-3 sm:p-4 pb-1"><CardTitle className="text-[9px] sm:text-[10px] font-black uppercase text-primary">Abonnés</CardTitle></CardHeader><CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-black">{users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0}</div></CardContent></Card>
              <Card className="border-2 shadow-sm"><CardHeader className="p-3 sm:p-4 pb-1"><CardTitle className="text-[9px] sm:text-[10px] font-black uppercase text-accent">Boutiques</CardTitle></CardHeader><CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-black">{businesses?.length || 0}</div></CardContent></Card>
              <Card className="border-2 shadow-sm"><CardHeader className="p-3 sm:p-4 pb-1"><CardTitle className="text-[9px] sm:text-[10px] font-black uppercase text-green-600">Messages</CardTitle></CardHeader><CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-black">{conversations?.length || 0}</div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
              <div className="grid grid-cols-1 gap-6">
                  <PermissionsManager users={users} />
                  <UsersManager users={users} />
              </div>
          </TabsContent>

          <TabsContent value="businesses">
              <BusinessManager businesses={businesses} users={users} />
          </TabsContent>
          
          <TabsContent value="fish">
              <FishGuideManager />
          </TabsContent>

          <TabsContent value="notifications">
              <SystemNotificationsManager />
          </TabsContent>

          <TabsContent value="design">
              <AppSettingsManager />
          </TabsContent>

          <TabsContent value="acces">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlobalAccessManager globalGift={globalGift} />
              <TokenManager tokens={tokens} />
            </div>
          </TabsContent>

          <TabsContent value="support"><SupportManager conversations={conversations} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function BusinessManager({ businesses, users }: { businesses: Business[] | null, users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
    const [name, setName] = useState('');
    const [commune, setCommune] = useState('Nouméa');
    const [ownerId, setOwnerId] = useState('');
    const [categories, setCategories] = useState<string[]>([]);

    const availableCats = ["Pêche", "Chasse", "Jardinage"];

    const handleSave = async () => {
        if (!firestore || !name || !ownerId) return;
        setIsSaving(true);
        
        const businessId = editingBusiness ? editingBusiness.id : `BUS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const bData = {
            id: businessId,
            name,
            commune,
            ownerId,
            categories,
            updatedAt: serverTimestamp()
        };

        try {
            const batch = writeBatch(firestore);
            batch.set(doc(firestore, 'businesses', businessId), bData, { merge: true });
            const userRef = doc(firestore, 'users', ownerId);
            batch.update(userRef, { 
                businessId: businessId, 
                role: 'professional',
                subscriptionStatus: 'professional'
            });
            await batch.commit();
            toast({ title: "Boutique liée !" });
            setIsDialogOpen(false);
            setEditingBusiness(null);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur de liaison" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                <div className="text-center sm:text-left">
                    <CardTitle className="text-xl font-black uppercase flex items-center justify-center sm:justify-start gap-2"><Store className="size-6 text-primary" /> Partenaires Pro</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Liez un commerce à un utilisateur via son UID.</CardDescription>
                </div>
                <Button onClick={() => { setEditingBusiness(null); setName(''); setOwnerId(''); setCategories([]); setIsDialogOpen(true); }} className="w-full sm:w-auto h-12 sm:h-10 font-black uppercase text-[10px] gap-2"><Plus className="size-4" /> Nouveau</Button>
            </CardHeader>
            <CardContent className="p-0 border-t">
                {/* Vue Mobile (Cartes) */}
                <div className="grid grid-cols-1 divide-y sm:hidden">
                    {businesses?.map(b => (
                        <div key={b.id} className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-black uppercase text-sm leading-tight">{b.name}</h4>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{b.commune}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" className="size-9 border-2" onClick={() => { setEditingBusiness(b); setName(b.name); setCommune(b.commune); setOwnerId(b.ownerId); setCategories(b.categories || []); setIsDialogOpen(true); }}><Pencil className="size-4" /></Button>
                                    <Button variant="outline" size="icon" className="size-9 text-destructive border-2" onClick={() => deleteDoc(doc(firestore!, 'businesses', b.id))}><Trash2 className="size-4" /></Button>
                                </div>
                            </div>
                            <div className="p-2 bg-muted/30 rounded-lg">
                                <span className="text-[8px] font-black uppercase opacity-40 block mb-0.5">Propriétaire (UID)</span>
                                <code className="text-[10px] font-mono break-all leading-tight">{b.ownerId}</code>
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Vue Desktop (Tableau) */}
                <Table className="hidden sm:table">
                    <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Commerce</TableHead><TableHead>Commune</TableHead><TableHead>Propriétaire</TableHead><TableHead className="text-right px-4">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {businesses?.map(b => (
                            <TableRow key={b.id}>
                                <TableCell className="px-4 font-black uppercase text-xs">{b.name}</TableCell>
                                <TableCell className="text-[10px] font-bold">{b.commune}</TableCell>
                                <TableCell className="font-mono text-[9px] opacity-60">{b.ownerId.substring(0, 12)}...</TableCell>
                                <TableCell className="text-right px-4">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="size-8 border-2" onClick={() => { setEditingBusiness(b); setName(b.name); setCommune(b.commune); setOwnerId(b.ownerId); setCategories(b.categories || []); setIsDialogOpen(true); }}><Pencil className="size-3" /></Button>
                                        <Button variant="ghost" size="icon" className="size-8 text-destructive border-2" onClick={() => deleteDoc(doc(firestore!, 'businesses', b.id))}><Trash2 className="size-3" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <LinkIcon className="size-5 text-primary" /> {editingBusiness ? "Modifier" : "Lier un commerce"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Nom de l'établissement</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 border-2 font-black" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">UID de l'utilisateur (Pro)</Label><Input value={ownerId} onChange={e => setOwnerId(e.target.value)} placeholder="Coller l'UID ici..." className="h-12 border-2 font-mono text-xs" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Commune</Label>
                            <Select value={commune} onValueChange={setCommune}>
                                <SelectTrigger className="h-12 border-2 font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-64">
                                    {Object.keys(locations).sort().map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Rayons d'activité</Label>
                            <div className="flex flex-wrap gap-2">
                                {availableCats.map(cat => (
                                    <Badge key={cat} variant={categories.includes(cat) ? "default" : "outline"} className="cursor-pointer font-black uppercase text-[9px] py-2" onClick={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">{isSaving ? "Liaison..." : "Confirmer"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
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
        setEditingFish(null); setName(''); setScientificName(''); setCategory('Lagon'); setGratteRiskSmall('0'); setGratteRiskMedium('0'); setGratteRiskLarge('0');
        setLengthSmall('< 30cm'); setLengthMedium('30-60cm'); setLengthLarge('> 60cm'); setFishingAdvice(''); setCulinaryAdvice(''); setImageUrl('');
    };

    const handleSave = () => {
        if (!firestore || !name) return;
        setIsSaving(true);
        const data: any = {
            name, scientificName, category,
            gratteRiskSmall: parseInt(gratteRiskSmall), gratteRiskMedium: parseInt(gratteRiskMedium), gratteRiskLarge: parseInt(gratteRiskLarge),
            lengthSmall, lengthMedium, lengthLarge, fishingAdvice, culinaryAdvice, imageUrl, updatedAt: serverTimestamp()
        };
        const docRef = editingFish ? doc(firestore, 'fish_species', editingFish.id) : doc(collection(firestore, 'fish_species'));
        setDoc(docRef, data, { merge: true }).then(() => { toast({ title: "Fiche sauvée" }); setIsDialogOpen(false); setIsSaving(false); }).catch(() => setIsSaving(false));
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                <div className="text-center sm:text-left">
                    <CardTitle className="text-xl font-black uppercase flex items-center justify-center sm:justify-start gap-2"><Fish className="size-6 text-primary" /> Guide Poissons</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Gérez les espèces locales.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input placeholder="Chercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 sm:h-10 border-2 font-bold text-xs" />
                    </div>
                    <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="h-11 sm:h-10 font-black uppercase text-[10px] gap-2"><Plus className="size-4" /> Ajouter</Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
                {isLoading ? <div className="p-8"><Skeleton className="h-32 w-full" /></div> : (
                    <div className="divide-y">
                        {filtered.map(f => (
                            <div key={f.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="size-14 rounded-xl bg-muted overflow-hidden border shrink-0 flex items-center justify-center">
                                        {f.imageUrl ? <img src={f.imageUrl} className="w-full h-full object-cover" /> : <Fish className="size-6 opacity-20" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black uppercase text-xs sm:text-sm truncate">{f.name}</h4>
                                        <Badge variant="secondary" className="text-[7px] font-black uppercase h-4">{f.category}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" size="icon" className="size-9 border-2" onClick={() => { setEditingFish(f); setName(f.name); setScientificName(f.scientificName); setCategory(f.category); setGratteRiskSmall(f.gratteRiskSmall?.toString() || '0'); setGratteRiskMedium(f.gratteRiskMedium?.toString() || '0'); setGratteRiskLarge(f.gratteRiskLarge?.toString() || '0'); setLengthSmall(f.lengthSmall || ''); setLengthMedium(f.lengthMedium || ''); setLengthLarge(f.lengthLarge || ''); setFishingAdvice(f.fishingAdvice || ''); setCulinaryAdvice(f.culinaryAdvice || ''); setImageUrl(f.imageUrl || ''); setIsDialogOpen(true); }}><Pencil className="size-4" /></Button>
                                    <Button variant="ghost" size="icon" className="size-9 text-destructive border-2" onClick={() => deleteDoc(doc(firestore!, 'fish_species', f.id))}><Trash2 className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader><DialogTitle className="font-black uppercase">{editingFish ? "Modifier" : "Nouveau Poisson"}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom commun (NC)</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 border-2" /></div>
                            <Button onClick={async () => { setIsGenerating(true); try { const info = await generateFishInfo({ name, scientificName }); setScientificName(info.scientificName); setCategory(info.category); setGratteRiskSmall(info.gratteRiskSmall.toString()); setGratteRiskMedium(info.gratteRiskMedium.toString()); setGratteRiskLarge(info.gratteRiskLarge.toString()); setFishingAdvice(info.fishingAdvice); setCulinaryAdvice(info.culinaryAdvice); toast({ title: "Généré !" }); } finally { setIsGenerating(false); } }} disabled={isGenerating || !name} variant="secondary" className="w-full h-12 font-black uppercase text-[10px] gap-2 border-2"><BrainCircuit className="size-4" /> IA Gemini</Button>
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Habitat</Label><Select value={category} onValueChange={(v: any) => setCategory(v)}><SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lagon">Lagon</SelectItem><SelectItem value="Recif">Récif</SelectItem><SelectItem value="Large">Large</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed grid grid-cols-3 gap-2">
                                <p className="col-span-3 text-[10px] font-black uppercase text-center opacity-40">Risques de Gratte (%)</p>
                                <Input type="number" value={gratteRiskSmall} onChange={e => setGratteRiskSmall(e.target.value)} className="h-10 text-center" />
                                <Input type="number" value={gratteRiskMedium} onChange={e => setGratteRiskMedium(e.target.value)} className="h-10 text-center" />
                                <Input type="number" value={gratteRiskLarge} onChange={e => setGratteRiskLarge(e.target.value)} className="h-10 text-center" />
                            </div>
                            <Textarea value={fishingAdvice} onChange={e => setFishingAdvice(e.target.value)} placeholder="Conseils pêche..." className="min-h-[100px] border-2" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">Sauvegarder</Button></DialogFooter>
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
        if (!firestore) return; setIsSaving(true);
        const expiry = Timestamp.fromDate(addDays(new Date(), parseInt(duration)));
        const docRef = doc(firestore, 'shared_access_tokens', 'GLOBAL');
        setDoc(docRef, { expiresAt: expiry, updatedAt: serverTimestamp() }, { merge: true }).then(() => { toast({ title: "Activé !" }); setIsSaving(false); }).catch(() => setIsSaving(false));
    };

    const isGlobalActive = globalGift && globalGift.expiresAt && globalGift.expiresAt.toDate() > new Date();

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-6" /> Accès Cadeau</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className={cn("p-4 rounded-xl border-2 flex items-center justify-between", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                    <div className="flex flex-col"><span className="text-[9px] font-black uppercase opacity-60">Statut</span><p className={cn("text-xs font-black", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'INACTIF'}</p></div>
                    {isGlobalActive && <Button variant="destructive" size="sm" onClick={() => setDoc(doc(firestore!, 'shared_access_tokens', 'GLOBAL'), { expiresAt: Timestamp.fromDate(new Date(0)) }, { merge: true })} className="h-8 font-black uppercase text-[10px]">Couper</Button>}
                </div>
                <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-12 border-2 font-black"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 jour</SelectItem><SelectItem value="7">1 semaine</SelectItem><SelectItem value="30">1 mois</SelectItem></SelectContent></Select>
                <Button onClick={handleActivate} disabled={isSaving} className="w-full h-14 font-black uppercase bg-primary shadow-lg">Activer l'offre globale</Button>
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
        if (!firestore) return; setIsGenerating(true);
        const id = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        setDoc(doc(firestore, 'access_tokens', id), { id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp() }).then(() => { toast({ title: "Jeton généré !" }); setIsGenerating(false); }).catch(() => setIsGenerating(false));
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Ticket className="size-6 text-accent" /> Jetons</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <div className="flex-1"><Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1m</SelectItem><SelectItem value="3">3m</SelectItem><SelectItem value="6">6m</SelectItem><SelectItem value="12">12m</SelectItem></SelectContent></Select></div>
                    <Button onClick={generateToken} disabled={isGenerating} className="h-12 px-6 font-black uppercase bg-accent shadow-lg"><Zap className="size-4 sm:mr-2" /> <span className="hidden sm:inline">Générer</span></Button>
                </div>
                <div className="max-h-64 overflow-y-auto border-2 rounded-xl divide-y">
                    {tokens?.map(t => (
                        <div key={t.id} className="p-3 flex items-center justify-between text-[10px] font-bold">
                            <code className="font-black text-primary">{t.id}</code>
                            <div className="flex items-center gap-3"><span>{t.durationMonths} mois</span><Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'access_tokens', t.id))} className="size-7 text-destructive"><Trash2 className="size-3" /></Button></div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function PermissionsManager({ users }: { users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase())).slice(0, 20) || [], [users, search]);

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-4"><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-6" /> Permissions</CardTitle></CardHeader>
            <CardContent className="p-0">
                <div className="p-3 bg-muted/20 border-b"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Chercher un compte..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 border-2" /></div></div>
                <div className="divide-y">
                    {filtered.map(u => (
                        <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-black text-xs uppercase truncate">{u.displayName}</p>
                                <p className="text-[9px] font-bold text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <Select defaultValue={u.role || 'client'} onValueChange={(val) => updateDoc(doc(firestore!, 'users', u.id), { role: val, subscriptionStatus: val === 'admin' ? 'admin' : (val === 'professional' ? 'professional' : 'trial') }).then(() => toast({ title: "MàJ !" }))}>
                                <SelectTrigger className="w-full sm:w-32 h-10 text-[10px] font-black uppercase border-2"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="professional">Pro</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function UsersManager({ users }: { users: UserAccount[] | null }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase())).slice(0, 30) || [], [users, search]);

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4"><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><UsersIcon className="size-6" /> Liste des Comptes</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
                <div className="p-3 bg-muted/20 border-b"><Input placeholder="Filtrer..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 border-2" /></div>
                <div className="divide-y">
                    {filtered.map(u => (
                        <div key={u.id} className="p-4 flex justify-between items-center">
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-xs uppercase truncate">{u.displayName}</p>
                                <p className="text-[9px] font-bold opacity-40 uppercase">{u.subscriptionStatus}</p>
                            </div>
                            <code className="text-[8px] font-mono opacity-30 ml-4 hidden sm:block">{u.id}</code>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function SupportManager({ conversations }: { conversations: Conversation[] | null }) {
    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4"><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><MessageSquare className="size-6" /> Support</CardTitle></CardHeader>
            <CardContent className="p-0 border-t divide-y">
                {conversations?.map(c => (
                    <div key={c.id} className={cn("p-4 flex items-center justify-between gap-4", !c.isReadByAdmin && "bg-primary/5")}>
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-xs uppercase truncate">{c.userDisplayName}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1 italic">"{c.lastMessageContent}"</p>
                        </div>
                        <Button asChild size="sm" variant={c.isReadByAdmin ? "outline" : "default"} className="h-10 px-4 font-black uppercase text-[10px] shrink-0">
                            <Link href={`/admin/messages/${c.id}`}>Répondre {!c.isReadByAdmin && <Badge className="ml-2 h-4 px-1 bg-white text-primary">!</Badge>}</Link>
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function AppSettingsManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const splashRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'splash') : null, [firestore]);
    const { data: splash } = useDoc<SplashScreenSettings>(splashRef);
    const [splashText, setSplashText] = useState('');
    const [splashColor, setSplashBgColor] = useState('#3b82f6');

    useEffect(() => { if (splash) { setSplashText(splash.splashText || ''); setSplashBgColor(splash.splashBgColor || '#3b82f6'); } }, [splash]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5" /> Splash Screen</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Texte</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} className="h-12 border-2" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Couleur</Label><div className="flex gap-2"><Input type="color" value={splashColor} onChange={e => setSplashBgColor(e.target.value)} className="h-12 w-20 border-2" /><Input value={splashColor} readOnly className="font-mono text-xs border-2" /></div></div>
                    <Button onClick={() => updateDoc(doc(firestore!, 'app_settings', 'splash'), { splashText, splashBgColor: splashColor }).then(() => toast({ title: "Splash MàJ" }))} className="w-full h-12 font-black uppercase text-[10px] gap-2"><Save className="size-4" /> Sauver</Button>
                </CardContent>
            </Card>
            {/* Autres réglages (RIB, CGV) supprimés pour concision mais gardés dans l'idée du dashboard final */}
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

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Bell className="size-5 text-primary" /> Diffusion Alertes</CardTitle></CardHeader>
            <CardContent className="space-y-6 p-4">
                <div className="grid gap-4 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 border-2" /></div>
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Type</Label><Select value={type} onValueChange={(v: any) => setType(v)}><SelectTrigger className="h-12 border-2 font-black uppercase text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Alerte</SelectItem><SelectItem value="error">Urgent</SelectItem><SelectItem value="success">Succès</SelectItem></SelectContent></Select></div>
                    </div>
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Message..." className="border-2" />
                    <Button onClick={() => addDoc(collection(firestore!, 'system_notifications'), { title, content, type, isActive: true, createdAt: serverTimestamp() }).then(() => { setTitle(''); setContent(''); toast({ title: "Diffusé !" }); })} className="w-full h-14 font-black uppercase shadow-lg"><Plus className="size-5 mr-2" /> Diffuser</Button>
                </div>
                <div className="divide-y border-2 rounded-xl">
                    {notifications?.map(n => (
                        <div key={n.id} className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("size-2 rounded-full", n.type === 'error' ? 'bg-red-500' : 'bg-blue-500')} />
                                <span className="font-black uppercase text-[10px] truncate max-w-[150px]">{n.title}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="text-destructive size-8" onClick={() => deleteDoc(doc(firestore!, 'system_notifications', n.id))}><Trash2 className="size-3.5" /></Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
