'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
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
  Plus,
  Save,
  Smartphone,
  Fish,
  Pencil,
  BrainCircuit,
  X,
  Store,
  Link as LinkIcon,
  Check,
  RefreshCw,
  BarChart3,
  ScrollText,
  Landmark
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { locations } from '@/lib/locations';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('stats');

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'koKj5ObSGXYeO1PLKU5bgo8Yaky1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2', 'K9cVYLVUk1NV99YV3anebkugpPp1', 'ipupi3Pg4RfrSEpFyT69BtlCdpi2', 'Irglq69MasYdNwBmUu8yKvw6h4G2'];
    const masterEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com', 'kledostyle@outlook.com'];
    const userEmail = user.email?.toLowerCase() || '';
    return masterAdminUids.includes(user.uid) || (userEmail && masterEmails.includes(userEmail));
  }, [user]);

  const usersRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'users') : null, [firestore, isAdmin]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserAccount>(usersRef);

  const businessRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'businesses'), orderBy('name', 'asc')) : null, [firestore, isAdmin]);
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
    <div className="max-w-6xl mx-auto space-y-6 pb-32 px-1 sm:px-4">
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
        <div className="sticky top-[72px] z-30 bg-background/95 backdrop-blur-sm -mx-1 px-1 py-2 sm:static sm:bg-transparent sm:p-0">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide bg-muted/50 border-2 rounded-2xl p-1 shadow-sm gap-1 h-auto justify-start">
            <TabsTrigger value="stats" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Stats</TabsTrigger>
            <TabsTrigger value="users" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Comptes</TabsTrigger>
            <TabsTrigger value="businesses" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Commerces</TabsTrigger>
            <TabsTrigger value="fish" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Guide Poissons</TabsTrigger>
            <TabsTrigger value="notifications" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Alertes</TabsTrigger>
            <TabsTrigger value="settings" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Réglages</TabsTrigger>
            <TabsTrigger value="acces" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Accès</TabsTrigger>
            <TabsTrigger value="support" className="min-w-[80px] text-[9px] font-black uppercase py-3 rounded-xl data-[state=active]:bg-background">Support</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-6 space-y-6">
          <TabsContent value="stats">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatsCard title="Utilisateurs" value={users?.length || 0} icon={UsersIcon} color="text-slate-500" />
              <StatsCard title="Abonnés" value={users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin' || u.subscriptionStatus === 'professional').length || 0} icon={ShieldCheck} color="text-primary" />
              <StatsCard title="Boutiques" value={businesses?.length || 0} icon={Store} color="text-accent" />
              <StatsCard title="Support" value={conversations?.filter(c => !c.isReadByAdmin).length || 0} icon={MessageSquare} color="text-green-600" />
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <PermissionsManager users={users} />
            <UsersManager users={users} />
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

          <TabsContent value="settings">
            <AppSettingsManager />
          </TabsContent>

          <TabsContent value="acces">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlobalAccessManager globalGift={globalGift} />
              <TokenManager tokens={tokens} />
            </div>
          </TabsContent>

          <TabsContent value="support">
            <SupportManager conversations={conversations} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
  return (
    <Card className="border-2 shadow-sm overflow-hidden group">
      <CardHeader className="p-4 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-black uppercase opacity-40">{title}</CardTitle>
          <Icon className={cn("size-4 opacity-20 group-hover:opacity-100 transition-opacity", color)} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
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
            toast({ title: "Boutique enregistrée et compte PRO lié !" });
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
                <div>
                    <CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Store className="size-6 text-primary" /> Partenaires PRO</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Liez un commerce à un utilisateur via son UID.</CardDescription>
                </div>
                <Button onClick={() => { setEditingBusiness(null); setName(''); setOwnerId(''); setCategories([]); setIsDialogOpen(true); }} className="w-full sm:w-auto h-10 font-black uppercase text-[10px] gap-2"><Plus className="size-4" /> Ajouter</Button>
            </CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                    <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Commerce</TableHead><TableHead>Commune</TableHead><TableHead className="hidden sm:table-cell">Propriétaire</TableHead><TableHead className="text-right px-4">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {businesses?.map(b => (
                            <TableRow key={b.id}>
                                <TableCell className="px-4 font-black uppercase text-xs">{b.name}</TableCell>
                                <TableCell className="text-[10px] font-bold uppercase">{b.commune}</TableCell>
                                <TableCell className="hidden sm:table-cell font-mono text-[9px] opacity-60">{b.ownerId.substring(0, 12)}...</TableCell>
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
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <LinkIcon className="size-5 text-primary" /> {editingBusiness ? "Modifier Boutique" : "Lier un compte PRO"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Nom de l'établissement</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 border-2 font-black" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">UID de l'utilisateur (Compte PRO)</Label><Input value={ownerId} onChange={e => setOwnerId(e.target.value)} placeholder="Coller l'UID ici..." className="h-12 border-2 font-mono text-xs" /></div>
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
                    <DialogFooter><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">{isSaving ? "Traitement..." : "Valider la liaison"}</Button></DialogFooter>
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

    const [name, setName] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [category, setCategory] = useState<'Lagon' | 'Large' | 'Recif'>('Lagon');
    const [gratteRiskSmall, setGratteRiskSmall] = useState('0');
    const [gratteRiskMedium, setGratteRiskMedium] = useState('0');
    const [gratteRiskLarge, setGratteRiskLarge] = useState('0');
    const [fishingAdvice, setFishingAdvice] = useState('');
    const [culinaryAdvice, setCulinaryAdvice] = useState('');

    const fishRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'fish_species'), orderBy('name', 'asc')) : null, [firestore]);
    const { data: species, isLoading } = useCollection<FishSpeciesInfo>(fishRef);

    const filtered = species?.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) || [];

    const handleSave = () => {
        if (!firestore || !name) return;
        setIsSaving(true);
        const data = {
            name, scientificName, category,
            gratteRiskSmall: parseInt(gratteRiskSmall), gratteRiskMedium: parseInt(gratteRiskMedium), gratteRiskLarge: parseInt(gratteRiskLarge),
            fishingAdvice, culinaryAdvice, updatedAt: serverTimestamp()
        };
        const docRef = editingFish ? doc(firestore, 'fish_species', editingFish.id) : doc(collection(firestore, 'fish_species'));
        setDoc(docRef, data, { merge: true }).then(() => { toast({ title: "Fiche sauvée" }); setIsDialogOpen(false); setIsSaving(false); }).catch(() => setIsSaving(false));
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                <div>
                    <CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Fish className="size-6 text-primary" /> Guide Poissons</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Gérez le catalogue des espèces.</CardDescription>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Input placeholder="Chercher..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 border-2 font-bold text-xs" />
                    <Button onClick={() => { setEditingFish(null); setName(''); setScientificName(''); setIsDialogOpen(true); }} className="h-10 font-black uppercase text-[10px] gap-2"><Plus className="size-4" /> Nouveau</Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                    <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Nom</TableHead><TableHead>Habitat</TableHead><TableHead className="text-right px-4">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filtered.map(f => (
                            <TableRow key={f.id}>
                                <TableCell className="px-4 font-black uppercase text-xs">{f.name}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{f.category}</Badge></TableCell>
                                <TableCell className="text-right px-4">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="size-8 border-2" onClick={() => { setEditingFish(f); setName(f.name); setScientificName(f.scientificName); setCategory(f.category); setGratteRiskSmall(f.gratteRiskSmall?.toString() || '0'); setGratteRiskMedium(f.gratteRiskMedium?.toString() || '0'); setGratteRiskLarge(f.gratteRiskLarge?.toString() || '0'); setFishingAdvice(f.fishingAdvice || ''); setCulinaryAdvice(f.culinaryAdvice || ''); setIsDialogOpen(true); }}><Pencil className="size-3" /></Button>
                                        <Button variant="ghost" size="icon" className="size-8 text-destructive border-2" onClick={() => deleteDoc(doc(firestore!, 'fish_species', f.id))}><Trash2 className="size-3" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="font-black uppercase">{editingFish ? "Modifier Poisson" : "Nouveau Poisson"}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom commun</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 border-2" /></div>
                            <Button onClick={async () => { setIsGenerating(true); try { const info = await generateFishInfo({ name, scientificName }); setScientificName(info.scientificName); setCategory(info.category); setGratteRiskSmall(info.gratteRiskSmall.toString()); setGratteRiskMedium(info.gratteRiskMedium.toString()); setGratteRiskLarge(info.gratteRiskLarge.toString()); setFishingAdvice(info.fishingAdvice); setCulinaryAdvice(info.culinaryAdvice); toast({ title: "Généré !" }); } finally { setIsGenerating(false); } }} disabled={isGenerating || !name} variant="secondary" className="w-full h-12 font-black uppercase text-[10px] gap-2 border-2"><BrainCircuit className="size-4" /> Assistant IA</Button>
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Habitat</Label><Select value={category} onValueChange={(v: any) => setCategory(v)}><SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lagon">Lagon</SelectItem><SelectItem value="Recif">Récif</SelectItem><SelectItem value="Large">Large</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed grid grid-cols-3 gap-2">
                                <p className="col-span-3 text-[9px] font-black uppercase text-center opacity-40">Gratte (%) : P / M / G</p>
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

function PermissionsManager({ users }: { users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const filtered = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase())).slice(0, 5) || [];

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4"><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-6" /> Permissions Master</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
                <div className="p-3 bg-muted/20 border-b"><Input placeholder="Rechercher email..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 border-2" /></div>
                <div className="divide-y">
                    {filtered.map(u => (
                        <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-black text-xs uppercase truncate">{u.displayName}</p>
                                <p className="text-[9px] font-bold text-muted-foreground">{u.email}</p>
                            </div>
                            <Select defaultValue={u.role || 'client'} onValueChange={(val) => updateDoc(doc(firestore!, 'users', u.id), { role: val, subscriptionStatus: val === 'admin' ? 'admin' : (val === 'professional' ? 'professional' : 'trial') }).then(() => toast({ title: "Droits mis à jour" }))}>
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
    const filtered = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase())).slice(0, 10) || [];

    return (
        <Card className="border-2 shadow-sm overflow-hidden">
            <CardHeader className="p-4"><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><UsersIcon className="size-4" /> Tous les Comptes</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                    <TableHeader><TableRow><TableHead className="px-4">Utilisateur</TableHead><TableHead>Statut</TableHead><TableHead className="hidden sm:table-cell">UID</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filtered.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs uppercase">{u.displayName}</span><span className="text-[9px] font-bold opacity-40">{u.email}</span></div></TableCell>
                                <TableCell><Badge variant="secondary" className="text-[8px] font-black uppercase">{u.subscriptionStatus}</Badge></TableCell>
                                <TableCell className="hidden sm:table-cell font-mono text-[8px] opacity-30 select-all">{u.id}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
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
        setDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'), { expiresAt: expiry, updatedAt: serverTimestamp() }, { merge: true }).then(() => { toast({ title: "Offre activée !" }); setIsSaving(false); }).catch(() => setIsSaving(false));
    };

    const isGlobalActive = globalGift && globalGift.expiresAt && globalGift.expiresAt.toDate() > new Date();

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-6" /> Accès Cadeau Global</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className={cn("p-4 rounded-xl border-2 flex items-center justify-between", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                    <p className={cn("text-xs font-black", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'OFFRE INACTIVE'}</p>
                    {isGlobalActive && <Button variant="destructive" size="sm" onClick={() => updateDoc(doc(firestore!, 'shared_access_tokens', 'GLOBAL'), { expiresAt: Timestamp.fromDate(new Date(0)) })} className="h-8 font-black uppercase text-[10px]">Couper</Button>}
                </div>
                <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-12 border-2 font-black"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 jour</SelectItem><SelectItem value="7">1 semaine</SelectItem><SelectItem value="30">1 mois</SelectItem></SelectContent></Select>
                <Button onClick={handleActivate} disabled={isSaving} className="w-full h-14 font-black uppercase shadow-lg">Activer l'Accès Libre</Button>
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
        if (!firestore) return; setIsGenerating(false);
        const id = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        setDoc(doc(firestore, 'access_tokens', id), { id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp() }).then(() => { toast({ title: "Jeton généré !" }); setIsGenerating(false); }).catch(() => setIsGenerating(false));
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Ticket className="size-6 text-accent" /> Jetons</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-12 border-2 flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 mois</SelectItem><SelectItem value="3">3 mois</SelectItem><SelectItem value="6">6 mois</SelectItem><SelectItem value="12">12 mois</SelectItem></SelectContent></Select>
                    <Button onClick={generateToken} disabled={isGenerating} className="h-12 px-6 font-black uppercase bg-accent shadow-lg"><Zap className="size-4" /></Button>
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
            <CardHeader className="p-4"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Bell className="size-5" /> Alertes Système</CardTitle></CardHeader>
            <CardContent className="space-y-6 p-4">
                <div className="grid gap-4 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 border-2" /></div>
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Urgence</Label><Select value={type} onValueChange={(v: any) => setType(v)}><SelectTrigger className="h-12 border-2 font-black uppercase text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Alerte</SelectItem><SelectItem value="error">Urgent (Rouge)</SelectItem><SelectItem value="success">Succès</SelectItem></SelectContent></Select></div>
                    </div>
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Message aux utilisateurs..." className="border-2" />
                    <Button onClick={() => addDoc(collection(firestore!, 'system_notifications'), { title, content, type, isActive: true, createdAt: serverTimestamp() }).then(() => { setTitle(''); setContent(''); toast({ title: "Alerte diffusée !" }); })} className="w-full h-14 font-black uppercase shadow-lg"><Plus className="size-5 mr-2" /> Diffuser</Button>
                </div>
                <div className="divide-y border-2 rounded-xl">
                    {notifications?.map(n => (
                        <div key={n.id} className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3"><div className={cn("size-2 rounded-full", n.type === 'error' ? 'bg-red-500' : 'bg-blue-500')} /><span className="font-black uppercase text-[10px] truncate">{n.title}</span></div>
                            <Button variant="ghost" size="icon" className="text-destructive size-8" onClick={() => deleteDoc(doc(firestore!, 'system_notifications', n.id))}><Trash2 className="size-3.5" /></Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function AppSettingsManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const splashRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'splash') : null, [firestore]);
    const { data: splash } = useDoc<SplashScreenSettings>(splashRef);
    const ribRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'rib') : null, [firestore]);
    const { data: rib } = useDoc<RibSettings>(ribRef);
    const cgvRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'cgv') : null, [firestore]);
    const { data: cgv } = useDoc<CgvSettings>(cgvRef);

    const [splashText, setSplashText] = useState('');
    const [splashBgColor, setSplashBgColor] = useState('#3b82f6');
    const [ribDetails, setRibDetails] = useState('');
    const [cgvContent, setCgvContent] = useState('');

    useEffect(() => { if (splash) { setSplashText(splash.splashText || ''); setSplashBgColor(splash.splashBgColor || '#3b82f6'); } }, [splash]);
    useEffect(() => { if (rib) setRibDetails(rib.details || ''); }, [rib]);
    useEffect(() => { if (cgv) setCgvContent(cgv.content || ''); }, [cgv]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5" /> Splash Screen</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Texte</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} className="h-12 border-2" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Couleur de fond</Label><div className="flex gap-2"><Input type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} className="h-12 w-20 border-2" /><Input value={splashBgColor} readOnly className="font-mono text-xs border-2 flex-1" /></div></div>
                    <Button onClick={() => updateDoc(doc(firestore!, 'app_settings', 'splash'), { splashText, splashBgColor }).then(() => toast({ title: "Splash mis à jour" }))} className="w-full h-12 font-black uppercase text-[10px] gap-2"><Save className="size-4" /> Sauver Design</Button>
                </CardContent>
            </Card>
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Landmark className="size-5" /> Coordonnées RIB</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Détails bancaires (Text)</Label><Textarea value={ribDetails} onChange={e => setRibDetails(e.target.value)} className="min-h-[100px] border-2 font-mono text-xs" /></div>
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'rib'), { details: ribDetails, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "RIB mis à jour" }))} className="w-full h-12 font-black uppercase text-[10px] gap-2"><Save className="size-4" /> Sauver RIB</Button>
                </CardContent>
            </Card>
            <Card className="md:col-span-2 border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><ScrollText className="size-5" /> Conditions (CGV)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Texte des conditions</Label><Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[200px] border-2 text-xs" /></div>
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'cgv'), { content: cgvContent, version: (cgv?.version || 0) + 1, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "CGV mises à jour (Version incrémentée)" }))} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">Sauver & Forcer Re-validation</Button>
                </CardContent>
            </Card>
        </div>
    );
}

function SupportManager({ conversations }: { conversations: Conversation[] | null }) {
    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4"><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><MessageSquare className="size-6" /> Support Direct</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
                {conversations && conversations.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead className="px-4">Utilisateur</TableHead><TableHead>Dernier message</TableHead><TableHead className="text-right px-4">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {conversations.map(c => (
                                <TableRow key={c.id} className={cn(!c.isReadByAdmin && "bg-primary/5")}>
                                    <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs uppercase">{c.userDisplayName}</span><span className="text-[9px] font-bold opacity-40">{c.userEmail}</span></div></TableCell>
                                    <TableCell className="max-w-[200px]"><p className="text-[10px] text-muted-foreground truncate italic">"{c.lastMessageContent}"</p></TableCell>
                                    <TableCell className="text-right px-4">
                                        <Button asChild size="sm" variant={c.isReadByAdmin ? "outline" : "default"} className="h-10 px-4 font-black uppercase text-[10px]">
                                            <Link href={`/admin/messages/${c.id}`}>Répondre {!c.isReadByAdmin && <Badge className="ml-2 h-4 px-1 bg-white text-primary">!</Badge>}</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="p-12 text-center text-muted-foreground font-bold uppercase opacity-30 italic">Aucune conversation active.</div>
                )}
            </CardContent>
        </Card>
    );
}
