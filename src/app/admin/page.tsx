
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import type { UserAccount, Business, Conversation, AccessToken, SharedAccessToken, SplashScreenSettings, CgvSettings, RibSettings, SystemNotification, FishSpeciesInfo, SoundLibraryEntry } from '@/lib/types';
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
  Mail,
  Volume2,
  Play,
  Camera,
  ImageIcon
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

  if (isUserLoading) return <div className="p-4"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!isAdmin) return <div className="p-12 text-center font-black uppercase text-muted-foreground animate-pulse">Accès Master Requis...</div>;

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden relative rounded-2xl">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-2 translate-x-2">
            <ShieldCheck className="size-20" />
        </div>
        <CardHeader className="py-6 px-5 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-2xl">Dashboard Master</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest truncate">{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[64px] z-30 bg-background/95 backdrop-blur-md -mx-1 px-2 py-3 border-b-2 border-primary/10 mb-4 overflow-x-auto scrollbar-hide">
          <TabsList className="flex w-max bg-transparent p-0 gap-2 h-auto justify-start">
            {[
              { id: 'stats', label: 'Stats' },
              { id: 'users', label: 'Comptes' },
              { id: 'businesses', label: 'Pros' },
              { id: 'fish', label: 'Poissons' },
              { id: 'sons', label: 'Sons' },
              { id: 'notifications', label: 'Alertes' },
              { id: 'settings', label: 'Réglages' },
              { id: 'acces', label: 'Accès' },
              { id: 'support', label: 'Support' }
            ].map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="shrink-0 text-[10px] font-black uppercase py-3 px-5 rounded-xl border-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary transition-all shadow-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="space-y-6">
          <TabsContent value="stats">
            <div className="grid gap-3 grid-cols-2">
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

          <TabsContent value="sons">
            <SoundLibraryManager />
          </TabsContent>

          <TabsContent value="notifications">
            <SystemNotificationsManager />
          </TabsContent>

          <TabsContent value="settings">
            <AppSettingsManager />
          </TabsContent>

          <TabsContent value="acces">
            <div className="flex flex-col gap-6">
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
    <Card className="border-2 shadow-sm overflow-hidden bg-white rounded-2xl">
      <CardHeader className="p-4 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-black uppercase opacity-40 tracking-wider">{title}</CardTitle>
          <Icon className={cn("size-4 opacity-30", color)} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}

function SoundLibraryManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [label, setLabel] = useState('');
    const [url, setUrl] = useState('');
    const [categories, setCategories] = useState<string[]>(['General']);
    const [isSaving, setIsSaving] = useState(false);

    const soundsRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
    const { data: sounds } = useCollection<SoundLibraryEntry>(soundsRef);

    const handleSave = async () => {
        if (!firestore || !label || !url) return;
        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'sound_library'), {
                label,
                url,
                categories,
                createdAt: serverTimestamp()
            });
            setLabel('');
            setUrl('');
            toast({ title: "Son ajouté !" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'sound_library', id));
        toast({ title: "Son supprimé" });
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-muted/5 border-b">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Volume2 className="size-5" /> Bibliothèque Sonore</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase mt-1">Gérez les sons pour le tracker et la chasse.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
                <div className="grid gap-4 p-5 bg-muted/10 rounded-2xl border-2 border-dashed">
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Nom du son</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Alerte, Bip..." className="h-12 border-2 font-bold" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">URL MP3</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="h-12 border-2 text-xs font-mono" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Catégories</Label>
                            <div className="flex flex-wrap gap-2">
                                {['Vessel', 'Hunting', 'General'].map(cat => (
                                    <Badge key={cat} variant={categories.includes(cat) ? "default" : "outline"} className="cursor-pointer font-black uppercase text-[9px] py-2 px-3 h-auto border-2" onClick={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || !label || !url} className="w-full h-14 font-black uppercase tracking-widest shadow-md"><Plus className="size-4 mr-2" /> Ajouter le son</Button>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sons enregistrés ({sounds?.length || 0})</p>
                    <div className="flex flex-col gap-2">
                        {sounds?.map(s => (
                            <div key={s.id} className="p-3 flex items-center justify-between border-2 rounded-xl bg-white shadow-sm">
                                <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-black uppercase text-xs truncate text-slate-800">{s.label}</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {s.categories?.map(c => <Badge key={c} variant="outline" className="text-[7px] h-3.5 px-1 uppercase font-black border-primary/20 text-primary">{c}</Badge>)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-10 w-10 border rounded-xl" onClick={() => { const a = new Audio(s.url); a.play(); }}><Play className="size-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive/40 hover:text-destructive border rounded-xl" onClick={() => handleDelete(s.id)}><Trash2 className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
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
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 border-b bg-muted/5">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Store className="size-5 text-primary" /> Partenaires PRO</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase mt-1">Liez un commerce via UID.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => { setEditingBusiness(null); setName(''); setOwnerId(''); setCategories([]); setIsDialogOpen(true); }} className="w-full font-black uppercase h-14 tracking-widest shadow-md"><Plus className="size-5 mr-2" /> Créer / Lier une boutique</Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                {businesses?.map(b => (
                    <div key={b.id} className="flex flex-col p-4 border-2 rounded-2xl bg-white shadow-sm gap-4">
                        <div className="flex flex-col min-w-0">
                            <span className="font-black uppercase text-sm leading-tight text-slate-800">{b.name}</span>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/30 text-primary">{b.commune}</Badge>
                                <span className="text-[9px] font-mono font-bold opacity-40 truncate">UID: {b.ownerId.substring(0, 12)}...</span>
                            </div>
                        </div>
                        <div className="flex gap-2 border-t pt-3">
                            <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] border-2" onClick={() => { setEditingBusiness(b); setName(b.name); setCommune(b.commune); setOwnerId(b.ownerId); setCategories(b.categories || []); setIsDialogOpen(true); }}><Pencil className="size-4 mr-2" /> Modifier</Button>
                            <Button variant="ghost" className="h-12 px-4 text-destructive border-2 border-destructive/10" onClick={() => deleteDoc(doc(firestore!, 'businesses', b.id))}><Trash2 className="size-4" /></Button>
                        </div>
                    </div>
                ))}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-50 border-b">
                        <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2">
                            <LinkIcon className="size-5 text-primary" /> {editingBusiness ? "Modifier Boutique" : "Lier un compte PRO"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] scrollbar-hide">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Nom du magasin</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-14 border-2 font-black text-lg" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">UID Utilisateur Pro</Label><Input value={ownerId} onChange={e => setOwnerId(e.target.value)} placeholder="Coller l'UID..." className="h-14 border-2 font-mono text-sm" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Commune</Label>
                            <Select value={commune} onValueChange={setCommune}>
                                <SelectTrigger className="h-14 border-2 font-bold text-base"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-64">{Object.keys(locations).sort().map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Rayons autorisés</Label>
                            <div className="flex flex-wrap gap-2">
                                {availableCats.map(cat => (
                                    <Badge key={cat} variant={categories.includes(cat) ? "default" : "outline"} className="cursor-pointer font-black uppercase text-[10px] py-3 px-4 h-auto border-2 transition-all" onClick={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-muted/10 border-t"><Button onClick={handleSave} disabled={isSaving} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base">{isSaving ? "Traitement..." : "Valider Liaison"}</Button></DialogFooter>
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [category, setCategory] = useState<'Lagon' | 'Large' | 'Recif'>('Lagon');
    const [gratteRiskSmall, setGratteRiskSmall] = useState('0');
    const [gratteRiskMedium, setGratteRiskMedium] = useState('0');
    const [gratteRiskLarge, setGratteRiskLarge] = useState('0');
    const [fishingAdvice, setFishingAdvice] = useState('');
    const [culinaryAdvice, setCulinaryAdvice] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const fishRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'fish_species'), orderBy('name', 'asc')) : null, [firestore]);
    const { data: species, isLoading } = useCollection<FishSpeciesInfo>(fishRef);

    const filtered = species?.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) || [];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setImageUrl(event.target?.result as string);
            toast({ title: "Photo chargée" });
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (!firestore || !name) return;
        setIsSaving(true);
        const data = { 
            name, 
            scientificName, 
            category, 
            gratteRiskSmall: parseInt(gratteRiskSmall), 
            gratteRiskMedium: parseInt(gratteRiskMedium), 
            gratteRiskLarge: parseInt(gratteRiskLarge), 
            fishingAdvice, 
            culinaryAdvice, 
            imageUrl,
            updatedAt: serverTimestamp() 
        };
        const docRef = editingFish ? doc(firestore, 'fish_species', editingFish.id) : doc(collection(firestore, 'fish_species'));
        setDoc(docRef, data, { merge: true }).then(() => { 
            toast({ title: "Fiche sauvée" }); 
            setIsDialogOpen(false); 
            setIsSaving(false); 
        }).catch(() => setIsSaving(false));
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-muted/5 border-b space-y-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Fish className="size-5" /> Guide Poissons</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase mt-1">Catalogue des espèces NC.</CardDescription>
                        </div>
                    </div>
                    <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" /><Input placeholder="Chercher un poisson..." value={search} onChange={e => setSearch(e.target.value)} className="pl-12 h-14 border-2 font-bold text-base" /></div>
                    <Button onClick={() => { 
                        setEditingFish(null); 
                        setName(''); 
                        setScientificName(''); 
                        setImageUrl('');
                        setCategory('Lagon');
                        setGratteRiskSmall('0');
                        setGratteRiskMedium('0');
                        setGratteRiskLarge('0');
                        setFishingAdvice('');
                        setCulinaryAdvice('');
                        setIsDialogOpen(true); 
                    }} className="w-full h-14 font-black uppercase tracking-widest shadow-md"><Plus className="size-5 mr-2" /> Nouvelle espèce</Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                {isLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : filtered.map(f => {
                    const finalImageUrl = f.imageUrl || (f.imagePlaceholder ? `https://picsum.photos/seed/${f.imagePlaceholder}/400/400` : '');
                    return (
                        <div key={f.id} className="flex flex-col p-4 border-2 rounded-2xl bg-white shadow-sm gap-4">
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-xl bg-muted/20 flex items-center justify-center shrink-0 overflow-hidden border shadow-sm">
                                    {finalImageUrl ? (
                                        <img src={finalImageUrl} alt={f.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Fish className="size-6 text-primary/40" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-black uppercase text-sm leading-tight text-slate-800 truncate">{f.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase h-5 px-2 border-primary/20">{f.category}</Badge>
                                        <span className="text-[9px] italic font-bold opacity-40 truncate">{f.scientificName}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 border-t pt-3">
                                <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] border-2" onClick={() => { 
                                    setEditingFish(f); 
                                    setName(f.name); 
                                    setScientificName(f.scientificName); 
                                    setCategory(f.category); 
                                    setGratteRiskSmall(f.gratteRiskSmall?.toString() || '0'); 
                                    setGratteRiskMedium(f.gratteRiskMedium?.toString() || '0'); 
                                    setGratteRiskLarge(f.gratteRiskLarge?.toString() || '0'); 
                                    setFishingAdvice(f.fishingAdvice || ''); 
                                    setCulinaryAdvice(f.culinaryAdvice || ''); 
                                    setImageUrl(f.imageUrl || '');
                                    setIsDialogOpen(true); 
                                }}><Pencil className="size-4 mr-2" /> Modifier</Button>
                                <Button variant="ghost" className="h-12 px-4 text-destructive border-2 border-destructive/10" onClick={() => deleteDoc(doc(firestore!, 'fish_species', f.id))}><Trash2 className="size-4" /></Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] rounded-3xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle className="font-black uppercase tracking-tighter text-xl">{editingFish ? "Modifier" : "Nouvelle Fiche"}</DialogTitle></DialogHeader>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Nom Local</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-14 border-2 font-black text-lg" /></div>
                            
                            <div className="flex flex-col gap-3 p-4 bg-muted/10 rounded-2xl border-2 border-dashed">
                                <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Photo de l'espèce</Label>
                                <div className="flex items-center gap-4">
                                    <div className="size-24 rounded-xl bg-white border-2 flex items-center justify-center overflow-hidden shrink-0">
                                        {imageUrl ? (
                                            <img src={imageUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="size-8 opacity-20" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Button variant="outline" className="w-full h-12 border-2 font-black uppercase text-[10px] gap-2" onClick={() => fileInputRef.current?.click()}>
                                            <Camera className="size-4" /> Charger photo
                                        </Button>
                                        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                        {imageUrl && (
                                            <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase text-destructive" onClick={() => setImageUrl('')}>
                                                <X className="size-3 mr-1" /> Supprimer
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Button onClick={async () => { setIsGenerating(true); try { const info = await generateFishInfo({ name, scientificName }); setScientificName(info.scientificName); setCategory(info.category); setGratteRiskSmall(info.gratteRiskSmall.toString()); setGratteRiskMedium(info.gratteRiskMedium.toString()); setGratteRiskLarge(info.gratteRiskLarge.toString()); setFishingAdvice(info.fishingAdvice); setCulinaryAdvice(info.culinaryAdvice); toast({ title: "Généré !" }); } finally { setIsGenerating(false); } }} disabled={isGenerating || !name} variant="secondary" className="w-full h-14 font-black uppercase text-xs gap-3 border-2 shadow-sm"><BrainCircuit className="size-5" /> Assistant IA (Générer fiche)</Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-5 bg-muted/20 rounded-2xl border-2 border-dashed">
                            <p className="col-span-3 text-[10px] font-black uppercase text-center opacity-50 tracking-widest mb-1">Risques de Gratte (%) : P / M / G</p>
                            <Input type="number" value={gratteRiskSmall} onChange={e => setGratteRiskSmall(e.target.value)} className="h-12 text-center font-black text-lg" />
                            <Input type="number" value={gratteRiskMedium} onChange={e => setGratteRiskMedium(e.target.value)} className="h-12 text-center font-black text-lg" />
                            <Input type="number" value={gratteRiskLarge} onChange={e => setGratteRiskLarge(e.target.value)} className="h-12 text-center font-black text-lg" />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Conseils Pêche</Label><Textarea value={fishingAdvice} onChange={e => setFishingAdvice(e.target.value)} className="min-h-[100px] border-2 font-medium" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Conseils Cuisine</Label><Textarea value={culinaryAdvice} onChange={e => setCulinaryAdvice(e.target.value)} className="min-h-[100px] border-2 font-medium" /></div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted/10"><Button onClick={handleSave} disabled={isSaving} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base">Sauvegarder l'espèce</Button></DialogFooter>
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
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-5" /> Permissions Master</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-3">
                <div className="p-1"><Input placeholder="Chercher email..." value={search} onChange={e => setSearch(e.target.value)} className="h-14 border-2 font-bold text-base" /></div>
                {filtered.map(u => (
                    <div key={u.id} className="p-4 border-2 rounded-2xl bg-white flex flex-col gap-4 shadow-sm">
                        <div className="min-w-0">
                            <p className="font-black text-sm uppercase truncate text-slate-800">{u.displayName}</p>
                            <p className="text-[10px] font-bold text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-[9px] font-black uppercase opacity-40 ml-1">Changer le rôle</Label>
                            <Select defaultValue={u.role || 'client'} onValueChange={(val) => updateDoc(doc(firestore!, 'users', u.id), { role: val, subscriptionStatus: val === 'admin' ? 'admin' : (val === 'professional' ? 'professional' : 'trial') }).then(() => toast({ title: "Mis à jour" }))}>
                                <SelectTrigger className="w-full h-12 text-xs font-black uppercase border-2"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="client" className="font-black uppercase text-xs">Client</SelectItem><SelectItem value="professional" className="font-black uppercase text-xs">Pro</SelectItem><SelectItem value="admin" className="font-black uppercase text-xs text-red-600">Admin</SelectItem></SelectContent>
                            </Select>
                        </div>
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
        <Card className="border-2 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><UsersIcon className="size-4" /> Liste des Comptes</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-3">
                <div className="p-1"><Input placeholder="Chercher nom ou email..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 border-2 text-sm" /></div>
                {filtered.map(u => (
                    <div key={u.id} className="p-4 border rounded-2xl flex items-center justify-between bg-card shadow-sm">
                        <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-black uppercase text-xs truncate text-slate-800">{u.displayName}</span>
                            <span className="text-[10px] font-bold opacity-40 truncate">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Badge variant="secondary" className="text-[8px] font-black uppercase py-1 px-2">{u.subscriptionStatus}</Badge>
                            <button onClick={() => { navigator.clipboard.writeText(u.id); }} className="p-3 bg-muted/20 hover:bg-muted rounded-xl transition-colors"><Copy className="size-4 opacity-40" /></button>
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
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-5" /> Accès Cadeau Global</CardTitle></CardHeader>
            <CardContent className="space-y-5 p-5">
                <div className={cn("p-5 rounded-2xl border-2 flex flex-col gap-3", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/10 border-dashed")}>
                    <p className={cn("text-xs font-black uppercase tracking-widest text-center", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'OFFRE INACTIVE'}</p>
                    {isGlobalActive && <Button variant="destructive" className="w-full h-12 font-black uppercase text-xs shadow-md" onClick={() => updateDoc(doc(firestore!, 'shared_access_tokens', 'GLOBAL'), { expiresAt: Timestamp.fromDate(new Date(0)) })}>Désactiver l'accès libre</Button>}
                </div>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Durée de l'offre</Label>
                        <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-14 border-2 font-black text-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1" className="font-black uppercase">1 jour</SelectItem><SelectItem value="7" className="font-black uppercase">1 semaine</SelectItem><SelectItem value="30" className="font-black uppercase">1 mois</SelectItem></SelectContent></Select>
                    </div>
                    <Button onClick={handleActivate} disabled={isSaving} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest">Activer l'Accès Libre</Button>
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
        if (!firestore) return; setIsGenerating(true);
        const id = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        setDoc(doc(firestore, 'access_tokens', id), { id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp() }).then(() => { toast({ title: "Jeton généré !" }); setIsGenerating(false); }).catch(() => setIsGenerating(false));
    };

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 bg-accent/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-accent"><Ticket className="size-5" /> Jetons Premium</CardTitle></CardHeader>
            <CardContent className="space-y-6 p-5">
                <div className="flex flex-col gap-4 p-5 bg-accent/5 rounded-2xl border-2 border-accent/10">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Validité du jeton</Label>
                        <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-14 border-2 font-black text-lg bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1" className="font-black uppercase">1 mois</SelectItem><SelectItem value="3" className="font-black uppercase">3 mois</SelectItem><SelectItem value="12" className="font-black uppercase">12 mois</SelectItem></SelectContent></Select>
                    </div>
                    <Button onClick={generateToken} disabled={isGenerating} className="w-full h-16 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest shadow-xl text-base gap-3"><Zap className="size-5" /> Générer un Jeton</Button>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Jetons actifs ({tokens?.length || 0})</p>
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                        {tokens?.slice(0, 20).map(t => (
                            <div key={t.id} className="p-4 flex items-center justify-between border-2 rounded-2xl bg-white shadow-sm">
                                <div className="flex flex-col">
                                    <code className="font-black text-primary text-xs select-all tracking-wider">{t.id}</code>
                                    <span className="text-[9px] font-bold uppercase opacity-40 mt-1">{t.durationMonths} mois d'accès</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'access_tokens', t.id))} className="size-10 text-destructive/40 hover:text-destructive hover:bg-red-50 rounded-xl"><Trash2 className="size-5" /></Button>
                            </div>
                        ))}
                    </div>
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
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Bell className="size-5" /> Alertes Système</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-6">
                <div className="grid gap-5 p-5 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Titre de l'alerte</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="h-14 border-2 font-black text-base uppercase" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Niveau / Couleur</Label><Select value={type} onValueChange={(v: any) => setType(v)}><SelectTrigger className="h-14 border-2 font-black text-sm uppercase bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info" className="font-black uppercase text-xs text-blue-600">Information (Bleu)</SelectItem><SelectItem value="warning" className="font-black uppercase text-xs text-orange-600">Vigilance (Jaune)</SelectItem><SelectItem value="error" className="font-black uppercase text-xs text-red-600">Urgent (Rouge)</SelectItem><SelectItem value="success" className="font-black uppercase text-xs text-green-600">Succès (Vert)</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Message</Label><Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Détails du message..." className="border-2 min-h-[100px] font-medium text-sm" /></div>
                    </div>
                    <Button onClick={() => addDoc(collection(firestore!, 'system_notifications'), { title, content, type, isActive: true, createdAt: serverTimestamp() }).then(() => { setTitle(''); setContent(''); toast({ title: "Diffusé !" }); })} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><Plus className="size-6" /> Diffuser l'alerte</Button>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Historique des diffusions</p>
                    <div className="flex flex-col gap-2">
                        {notifications?.map(n => (
                            <div key={n.id} className="p-4 flex items-center justify-between border-2 rounded-2xl bg-white shadow-sm">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className={cn("size-3 rounded-full shrink-0 shadow-sm", n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-orange-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500')} />
                                    <span className="font-black uppercase text-xs truncate text-slate-800">{n.title}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="text-destructive/40 hover:text-destructive size-10 rounded-xl" onClick={() => deleteDoc(doc(firestore!, 'system_notifications', n.id))}><Trash2 className="size-5" /></Button>
                            </div>
                        ))}
                    </div>
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
        <div className="flex flex-col gap-6">
            <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5 text-primary" /> Splash Screen</CardTitle></CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Texte d'accueil</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} className="h-14 border-2 font-black text-lg" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Couleur de fond</Label>
                        <div className="flex gap-2"><Input type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} className="h-14 w-20 border-2 p-1 rounded-xl" /><Input value={splashBgColor} readOnly className="font-mono font-bold text-center h-14 border-2 flex-1" /></div>
                    </div>
                    <Button onClick={() => updateDoc(doc(firestore!, 'app_settings', 'splash'), { splashText, splashBgColor }).then(() => toast({ title: "Splash mis à jour" }))} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><Save className="size-6" /> Sauver Design</Button>
                </CardContent>
            </Card>
            <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Landmark className="size-5 text-primary" /> Coordonnées RIB</CardTitle></CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Détails bancaires (DONS)</Label><Textarea value={ribDetails} onChange={e => setRibDetails(e.target.value)} className="min-h-[120px] border-2 font-mono text-sm leading-tight" /></div>
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'rib'), { details: ribDetails, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "RIB mis à jour" }))} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><Save className="size-6" /> Sauver RIB</Button>
                </CardContent>
            </Card>
            <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><ScrollText className="size-5 text-primary" /> Conditions (CGV)</CardTitle></CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Contenu des conditions</Label><Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[250px] border-2 text-xs leading-relaxed font-medium" /></div>
                    <div className="p-4 bg-muted/30 rounded-xl border-2 border-dashed flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-60">Version actuelle :</span><Badge variant="default" className="font-black text-xs h-7 px-3">{cgv?.version || 0}</Badge></div>
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'cgv'), { content: cgvContent, version: (cgv?.version || 0) + 1, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "CGV Version " + ((cgv?.version || 0) + 1) }))} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><RefreshCw className="size-6" /> Mettre à jour (Nouvelle Version)</Button>
                </CardContent>
            </Card>
        </div>
    );
}

function SupportManager({ conversations }: { conversations: Conversation[] | null }) {
    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-green-50 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-green-800"><MessageSquare className="size-5" /> Support Direct</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-3">
                {conversations && conversations.length > 0 ? conversations.map(c => (
                    <Link key={c.id} href={`/admin/messages/${c.id}`} className={cn("flex flex-col p-5 border-2 rounded-3xl bg-white shadow-sm transition-all active:scale-[0.98]", !c.isReadByAdmin && "border-primary bg-primary/5 ring-2 ring-primary/10")}>
                        <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-sm uppercase truncate text-slate-800">{c.userDisplayName}</p>
                                <p className="text-[10px] font-bold opacity-40 leading-none mt-1">{c.userEmail}</p>
                            </div>
                            {!c.isReadByAdmin && <Badge className="bg-primary animate-pulse text-[9px] h-5 px-2 font-black uppercase tracking-wider">Nouveau</Badge>}
                        </div>
                        <div className="bg-muted/10 p-3 rounded-2xl border-2 border-dashed border-muted-foreground/10">
                            <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed font-medium">"{c.lastMessageContent}"</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed flex justify-between items-center">
                            <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{c.lastMessageAt ? format(c.lastMessageAt.toDate(), 'dd/MM HH:mm') : '...'}</span>
                            <div className="flex items-center gap-2 font-black uppercase text-[10px] text-primary">Répondre <ChevronRight className="size-4" /></div>
                        </div>
                    </Link>
                )) : <div className="p-20 text-center text-muted-foreground font-black uppercase opacity-30 italic text-sm tracking-[0.2em]">Aucun message actif.</div>}
            </CardContent>
        </Card>
    );
}
