
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
  Landmark,
  ChevronRight,
  UserCircle,
  Copy,
  Mail
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

  if (isUserLoading) return <div className="p-4 sm:p-8"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!isAdmin) return <div className="p-12 text-center font-black uppercase text-muted-foreground animate-pulse">Accès Master Requis...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-32 px-1 sm:px-4">
      <Card className="border-2 shadow-xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
            <ShieldCheck className="size-24 sm:size-48" />
        </div>
        <CardHeader className="py-4 sm:py-8 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-xl sm:text-3xl">Dashboard Master</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[8px] sm:text-[10px] tracking-widest truncate">{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[64px] z-30 bg-background/95 backdrop-blur-md -mx-1 px-1 py-2 border-b-2 border-primary/10 mb-4">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide bg-transparent p-0 gap-1.5 h-auto justify-start">
            {[
              { id: 'stats', label: 'Stats' },
              { id: 'users', label: 'Comptes' },
              { id: 'businesses', label: 'Pros' },
              { id: 'fish', label: 'Poissons' },
              { id: 'notifications', label: 'Alertes' },
              { id: 'settings', label: 'Réglages' },
              { id: 'acces', label: 'Accès' },
              { id: 'support', label: 'Support' }
            ].map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="shrink-0 text-[10px] font-black uppercase py-2.5 px-4 rounded-xl border-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary transition-all"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="space-y-6">
          <TabsContent value="stats">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
      <CardHeader className="p-3 sm:p-4 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[9px] font-black uppercase opacity-40">{title}</CardTitle>
          <Icon className={cn("size-4 opacity-20", color)} />
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-xl sm:text-2xl font-black">{value}</div>
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
        try {
            const batch = writeBatch(firestore);
            batch.set(doc(firestore, 'businesses', businessId), { id: businessId, name, commune, ownerId, categories, updatedAt: serverTimestamp() }, { merge: true });
            batch.update(doc(firestore, 'users', ownerId), { businessId: businessId, role: 'professional', subscriptionStatus: 'professional' });
            await batch.commit();
            toast({ title: "Boutique liée !" });
            setIsDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: "Erreur" }); } finally { setIsSaving(false); }
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/10">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Store className="size-5 text-primary" /> Partenaires PRO</CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase">Liez un commerce via UID.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingBusiness(null); setName(''); setOwnerId(''); setCategories([]); setIsDialogOpen(true); }} size="sm" className="font-black uppercase text-[10px] h-10 px-4"><Plus className="size-4 mr-1" /> Ajouter</Button>
                </div>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
                {businesses?.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="font-black uppercase text-xs truncate">{b.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[8px] font-bold uppercase border-primary/30 text-primary">{b.commune}</Badge>
                                <span className="text-[8px] font-mono opacity-40 truncate">UID: {b.ownerId.substring(0, 8)}...</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="size-9 border-2" onClick={() => { setEditingBusiness(b); setName(b.name); setCommune(b.commune); setOwnerId(b.ownerId); setCategories(b.categories || []); setIsDialogOpen(true); }}><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="icon" className="size-9 text-destructive border-2" onClick={() => deleteDoc(doc(firestore!, 'businesses', b.id))}><Trash2 className="size-4" /></Button>
                        </div>
                    </div>
                ))}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl overflow-hidden p-0">
                    <DialogHeader className="p-6 bg-slate-50 border-b">
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <LinkIcon className="size-5 text-primary" /> {editingBusiness ? "Modifier Boutique" : "Lier un compte PRO"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Nom du magasin</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 border-2 font-black" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">UID Utilisateur Pro</Label><Input value={ownerId} onChange={e => setOwnerId(e.target.value)} placeholder="Coller l'UID..." className="h-12 border-2 font-mono text-xs" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Commune</Label>
                            <Select value={commune} onValueChange={setCommune}>
                                <SelectTrigger className="h-12 border-2 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-64">{Object.keys(locations).sort().map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Rayons</Label>
                            <div className="flex flex-wrap gap-2">
                                {availableCats.map(cat => (
                                    <Badge key={cat} variant={categories.includes(cat) ? "default" : "outline"} className="cursor-pointer font-black uppercase text-[9px] py-2 h-8" onClick={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-muted/10 border-t"><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">{isSaving ? "Traitement..." : "Valider Liaison"}</Button></DialogFooter>
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
        const data = { name, scientificName, category, gratteRiskSmall: parseInt(gratteRiskSmall), gratteRiskMedium: parseInt(gratteRiskMedium), gratteRiskLarge: parseInt(gratteRiskLarge), fishingAdvice, culinaryAdvice, updatedAt: serverTimestamp() };
        const docRef = editingFish ? doc(firestore, 'fish_species', editingFish.id) : doc(collection(firestore, 'fish_species'));
        setDoc(docRef, data, { merge: true }).then(() => { toast({ title: "Fiche sauvée" }); setIsDialogOpen(false); setIsSaving(false); }).catch(() => setIsSaving(false));
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4 bg-muted/10 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Fish className="size-5" /> Guide Poissons</CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase">Catalogue des espèces NC.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingFish(null); setName(''); setScientificName(''); setIsDialogOpen(true); }} size="sm" className="font-black uppercase text-[10px] h-10 px-4"><Plus className="size-4 mr-1" /> Nouveau</Button>
                </div>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Chercher un poisson..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 border-2 font-bold text-xs" /></div>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
                {isLoading ? <Skeleton className="h-20 w-full rounded-xl" /> : filtered.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="font-black uppercase text-xs truncate">{f.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1">{f.category}</Badge>
                                <span className="text-[9px] italic opacity-40 truncate">{f.scientificName}</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="size-9 border-2" onClick={() => { setEditingFish(f); setName(f.name); setScientificName(f.scientificName); setCategory(f.category); setGratteRiskSmall(f.gratteRiskSmall?.toString() || '0'); setGratteRiskMedium(f.gratteRiskMedium?.toString() || '0'); setGratteRiskLarge(f.gratteRiskLarge?.toString() || '0'); setFishingAdvice(f.fishingAdvice || ''); setCulinaryAdvice(f.culinaryAdvice || ''); setIsDialogOpen(true); }}><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="icon" className="size-9 text-destructive border-2" onClick={() => deleteDoc(doc(firestore!, 'fish_species', f.id))}><Trash2 className="size-4" /></Button>
                        </div>
                    </div>
                ))}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle className="font-black uppercase tracking-tighter">{editingFish ? "Modifier" : "Nouvelle Fiche"}</DialogTitle></DialogHeader>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Nom Local</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 border-2 font-black" /></div>
                            <Button onClick={async () => { setIsGenerating(true); try { const info = await generateFishInfo({ name, scientificName }); setScientificName(info.scientificName); setCategory(info.category); setGratteRiskSmall(info.gratteRiskSmall.toString()); setGratteRiskMedium(info.gratteRiskMedium.toString()); setGratteRiskLarge(info.gratteRiskLarge.toString()); setFishingAdvice(info.fishingAdvice); setCulinaryAdvice(info.culinaryAdvice); toast({ title: "Généré !" }); } finally { setIsGenerating(false); } }} disabled={isGenerating || !name} variant="secondary" className="w-full h-12 font-black uppercase text-[10px] gap-2 border-2"><BrainCircuit className="size-4" /> Assistant IA</Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                            <p className="col-span-3 text-[9px] font-black uppercase text-center opacity-40">Risques de Gratte (%) : P / M / G</p>
                            <Input type="number" value={gratteRiskSmall} onChange={e => setGratteRiskSmall(e.target.value)} className="h-10 text-center font-black" />
                            <Input type="number" value={gratteRiskMedium} onChange={e => setGratteRiskMedium(e.target.value)} className="h-10 text-center font-black" />
                            <Input type="number" value={gratteRiskLarge} onChange={e => setGratteRiskLarge(e.target.value)} className="h-10 text-center font-black" />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Conseils Pêche</Label><Textarea value={fishingAdvice} onChange={e => setFishingAdvice(e.target.value)} className="min-h-[80px] border-2" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Conseils Cuisine</Label><Textarea value={culinaryAdvice} onChange={e => setCulinaryAdvice(e.target.value)} className="min-h-[80px] border-2" /></div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted/10"><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">Sauvegarder la fiche</Button></DialogFooter>
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
            <CardHeader className="p-4 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-5" /> Permissions Master</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-2">
                <div className="p-2"><Input placeholder="Chercher email..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 border-2 font-bold" /></div>
                {filtered.map(u => (
                    <div key={u.id} className="p-3 border-2 rounded-xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                        <div className="min-w-0">
                            <p className="font-black text-xs uppercase truncate">{u.displayName}</p>
                            <p className="text-[9px] font-bold text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Select defaultValue={u.role || 'client'} onValueChange={(val) => updateDoc(doc(firestore!, 'users', u.id), { role: val, subscriptionStatus: val === 'admin' ? 'admin' : (val === 'professional' ? 'professional' : 'trial') }).then(() => toast({ title: "Mis à jour" }))}>
                            <SelectTrigger className="w-full sm:w-32 h-10 text-[10px] font-black uppercase border-2"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="professional">Pro</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                        </Select>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function UsersManager({ users }: { users: UserAccount[] | null }) {
    const [search, setSearch] = useState('');
    const filtered = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase())).slice(0, 10) || [];

    return (
        <Card className="border-2 shadow-sm overflow-hidden">
            <CardHeader className="p-4 bg-muted/10 border-b"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><UsersIcon className="size-4" /> Liste des Comptes</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-2">
                <div className="p-2"><Input placeholder="Chercher nom ou email..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 border-2 text-xs" /></div>
                {filtered.map(u => (
                    <div key={u.id} className="p-3 border rounded-xl flex items-center justify-between text-[10px] bg-card">
                        <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-black uppercase truncate">{u.displayName}</span>
                            <span className="opacity-40 truncate">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[7px] font-black uppercase">{u.subscriptionStatus}</Badge>
                            <button onClick={() => { navigator.clipboard.writeText(u.id); }} className="p-1 hover:bg-muted rounded"><Copy className="size-3 opacity-30" /></button>
                        </div>
                    </div>
                ))}
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
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-5" /> Accès Cadeau Global</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-4">
                <div className={cn("p-4 rounded-xl border-2 flex items-center justify-between", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                    <p className={cn("text-[10px] font-black", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'OFFRE INACTIVE'}</p>
                    {isGlobalActive && <Button variant="destructive" size="sm" onClick={() => updateDoc(doc(firestore!, 'shared_access_tokens', 'GLOBAL'), { expiresAt: Timestamp.fromDate(new Date(0)) })} className="h-8 font-black uppercase text-[10px]">Off</Button>}
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
        if (!firestore) return; setIsGenerating(true);
        const id = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        setDoc(doc(firestore, 'access_tokens', id), { id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp() }).then(() => { toast({ title: "Jeton généré !" }); setIsGenerating(false); }).catch(() => setIsGenerating(false));
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-accent"><Ticket className="size-5" /> Jetons Premium</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-4">
                <div className="flex gap-2">
                    <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-12 border-2 flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 mois</SelectItem><SelectItem value="3">3 mois</SelectItem><SelectItem value="12">12 mois</SelectItem></SelectContent></Select>
                    <Button onClick={generateToken} disabled={isGenerating} className="h-12 px-6 font-black uppercase bg-accent shadow-lg"><Zap className="size-4" /></Button>
                </div>
                <div className="max-h-64 overflow-y-auto border-2 rounded-xl divide-y bg-muted/10">
                    {tokens?.slice(0, 20).map(t => (
                        <div key={t.id} className="p-3 flex items-center justify-between text-[10px] font-bold">
                            <code className="font-black text-primary select-all">{t.id}</code>
                            <div className="flex items-center gap-3"><span>{t.durationMonths}m</span><Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'access_tokens', t.id))} className="size-7 text-destructive"><Trash2 className="size-3.5" /></Button></div>
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
            <CardHeader className="p-4 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Bell className="size-5" /> Alertes Système</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-6">
                <div className="grid gap-4 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="h-12 border-2 font-black" /></div>
                        <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Couleur / Niveau</Label><Select value={type} onValueChange={(v: any) => setType(v)}><SelectTrigger className="h-12 border-2 font-black text-xs uppercase"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info (Bleu)</SelectItem><SelectItem value="warning">Alerte (Jaune)</SelectItem><SelectItem value="error">Urgent (Rouge)</SelectItem><SelectItem value="success">Succès (Vert)</SelectItem></SelectContent></Select></div>
                    </div>
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Message..." className="border-2 min-h-[80px]" />
                    <Button onClick={() => addDoc(collection(firestore!, 'system_notifications'), { title, content, type, isActive: true, createdAt: serverTimestamp() }).then(() => { setTitle(''); setContent(''); toast({ title: "Diffusé !" }); })} className="w-full h-14 font-black uppercase shadow-lg"><Plus className="size-5 mr-2" /> Diffuser</Button>
                </div>
                <div className="divide-y border-2 rounded-xl bg-white">
                    {notifications?.map(n => (
                        <div key={n.id} className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1"><div className={cn("size-2.5 rounded-full shrink-0", n.type === 'error' ? 'bg-red-500' : 'bg-blue-500')} /><span className="font-black uppercase text-[10px] truncate">{n.title}</span></div>
                            <Button variant="ghost" size="icon" className="text-destructive size-9" onClick={() => deleteDoc(doc(firestore!, 'system_notifications', n.id))}><Trash2 className="size-4" /></Button>
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
        <div className="grid grid-cols-1 gap-6">
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5" /> Splash Screen</CardTitle></CardHeader>
                <CardContent className="space-y-4 p-4">
                    <Input value={splashText} onChange={e => setSplashText(e.target.value)} className="h-12 border-2 font-black" />
                    <div className="flex gap-2"><Input type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} className="h-12 w-20 border-2" /><Input value={splashBgColor} readOnly className="font-mono text-xs border-2 flex-1" /></div>
                    <Button onClick={() => updateDoc(doc(firestore!, 'app_settings', 'splash'), { splashText, splashBgColor }).then(() => toast({ title: "Splash mis à jour" }))} className="w-full h-12 font-black uppercase text-[10px] gap-2"><Save className="size-4" /> Sauver Design</Button>
                </CardContent>
            </Card>
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Landmark className="size-5" /> Coordonnées RIB</CardTitle></CardHeader>
                <CardContent className="space-y-4 p-4">
                    <Textarea value={ribDetails} onChange={e => setRibDetails(e.target.value)} className="min-h-[100px] border-2 font-mono text-xs" />
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'rib'), { details: ribDetails, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "RIB mis à jour" }))} className="w-full h-12 font-black uppercase text-[10px] gap-2"><Save className="size-4" /> Sauver RIB</Button>
                </CardContent>
            </Card>
            <Card className="border-2 shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><ScrollText className="size-5" /> Conditions (CGV)</CardTitle></CardHeader>
                <CardContent className="space-y-4 p-4">
                    <Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[200px] border-2 text-xs" />
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'cgv'), { content: cgvContent, version: (cgv?.version || 0) + 1, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "CGV Version " + ((cgv?.version || 0) + 1) }))} className="w-full h-14 font-black uppercase tracking-widest shadow-lg">Mettre à jour CGV</Button>
                </CardContent>
            </Card>
        </div>
    );
}

function SupportManager({ conversations }: { conversations: Conversation[] | null }) {
    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="p-4 bg-green-50/50 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-green-700"><MessageSquare className="size-5" /> Support Direct</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-2">
                {conversations && conversations.length > 0 ? conversations.map(c => (
                    <Link key={c.id} href={`/admin/messages/${c.id}`} className={cn("flex flex-col p-4 border-2 rounded-2xl bg-white shadow-sm transition-all active:scale-[0.98]", !c.isReadByAdmin && "border-primary bg-primary/5")}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-xs uppercase truncate">{c.userDisplayName}</p>
                                <p className="text-[9px] font-bold opacity-40">{c.userEmail}</p>
                            </div>
                            {!c.isReadByAdmin && <Badge className="bg-primary animate-pulse text-[8px] h-4 font-black uppercase">Nouveau</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground italic line-clamp-2 leading-relaxed">"{c.lastMessageContent}"</p>
                        <div className="mt-3 pt-3 border-t border-dashed flex justify-between items-center">
                            <span className="text-[8px] font-bold opacity-30 uppercase">{c.lastMessageAt ? format(c.lastMessageAt.toDate(), 'dd/MM HH:mm') : '...'}</span>
                            <span className="text-[9px] font-black uppercase text-primary flex items-center gap-1">Répondre <ChevronRight className="size-3" /></span>
                        </div>
                    </Link>
                )) : <div className="p-12 text-center text-muted-foreground font-black uppercase opacity-30 italic">Aucun message.</div>}
            </CardContent>
        </Card>
    );
}
