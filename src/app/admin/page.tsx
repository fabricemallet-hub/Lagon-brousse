'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, increment, getDocs, where, writeBatch, updateDoc } from 'firebase/firestore';
import type { UserAccount, Business, Conversation, AccessToken, SharedAccessToken, FishSpeciesInfo, SplashScreenSettings, CgvSettings, RibSettings, SystemNotification, Campaign, SoundLibraryEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { locations } from '@/lib/locations';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MessageSquare, 
  ShieldCheck, 
  Users, 
  Settings, 
  KeyRound, 
  Fish, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Save, 
  Zap, 
  Gift, 
  Ticket, 
  BrainCircuit, 
  Smartphone,
  Info,
  AlertTriangle,
  CheckCircle2,
  Megaphone,
  Sparkles,
  Search,
  Eye,
  CreditCard,
  FileText,
  Camera,
  Pencil,
  X,
  Volume2,
  Play,
  Calendar,
  Store
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, addMonths, addDays, isBefore, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

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
    const masterEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com', 'kledostyle@outlook.com'];
    return masterAdminUids.includes(user.uid) || (user.email && masterEmails.includes(user.email.toLowerCase()));
  }, [user]);

  const usersRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'users') : null, [firestore, isAdmin]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserAccount>(usersRef);

  const businessRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'businesses') : null, [firestore, isAdmin]);
  const { data: businesses } = useCollection<Business>(businessRef);

  const convsRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: conversations, error: convError } = useCollection<Conversation>(convsRef);

  const tokensRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: tokens } = useCollection<AccessToken>(tokensRef);

  const fishRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'fish_species'), orderBy('name', 'asc')) : null, [firestore, isAdmin]);
  const { data: fishSpecies } = useCollection<FishSpeciesInfo>(fishRef);

  const sysNotifsRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'system_notifications'), orderBy('createdAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: sysNotifs } = useCollection<SystemNotification>(sysNotifsRef);

  const campaignsRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'campaigns'), orderBy('createdAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: campaigns } = useCollection<Campaign>(campaignsRef);

  const soundsRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore, isAdmin]);
  const { data: sounds } = useCollection<SoundLibraryEntry>(soundsRef);

  const splashRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'app_settings', 'splash') : null, [firestore, isAdmin]);
  const { data: splashSettings } = useDoc<SplashScreenSettings>(splashRef);

  const cgvRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'app_settings', 'cgv') : null, [firestore, isAdmin]);
  const { data: cgvData } = useDoc<CgvSettings>(cgvRef);

  const ribRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'app_settings', 'rib') : null, [firestore, isAdmin]);
  const { data: ribData } = useDoc<RibSettings>(ribRef);

  const sharedTokenRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'shared_access_tokens', 'GLOBAL') : null, [firestore, isAdmin]);
  const { data: globalGift } = useDoc<SharedAccessToken>(sharedTokenRef);

  useEffect(() => {
    if (!isUserLoading && !isAdmin && user) router.push('/compte');
  }, [isAdmin, isUserLoading, router, user]);

  if (isUserLoading) return <div className="p-8"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!isAdmin) return <div className="p-12 text-center font-black uppercase text-muted-foreground animate-pulse">Vérification Accès Master...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
            <ShieldCheck className="size-48" />
        </div>
        <CardHeader className="py-8 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-3xl">Tableau de Bord Administrateur</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Contrôle Master • {user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-8 mb-6 h-auto bg-muted/50 border-2 rounded-2xl p-1.5 shadow-sm gap-1">
          <TabsTrigger value="stats" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="users" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Utilisateurs</TabsTrigger>
          <TabsTrigger value="businesses" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Commerces</TabsTrigger>
          <TabsTrigger value="design" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Design & Splash</TabsTrigger>
          <TabsTrigger value="notifications" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Notifications</TabsTrigger>
          <TabsTrigger value="fish" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Guide Poissons</TabsTrigger>
          <TabsTrigger value="acces" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Accès</TabsTrigger>
          <TabsTrigger value="support" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary">Abonnés</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-accent">Commerces</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{businesses?.length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-green-600">Messages Support</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{conversations?.filter(c => !c.isReadByAdmin).length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UsersManager users={users} isUsersLoading={isUsersLoading} />
        </TabsContent>

        <TabsContent value="businesses" className="space-y-6">
          <BusinessesManager businesses={businesses} users={users} />
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SplashManager initialSettings={splashSettings} />
            <CgvRibManager cgvData={cgvData} ribData={ribData} />
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SystemNotificationsManager notifications={sysNotifs} />
            <SoundLibraryManager sounds={sounds} />
          </div>
          <CampaignsManager campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="fish" className="space-y-6">
          <FishManager species={fishSpecies} />
        </TabsContent>

        <TabsContent value="acces" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlobalAccessManager globalGift={globalGift} />
            <TokenManager tokens={tokens} />
          </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <SupportConversationsManager conversations={conversations} error={convError} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BusinessesManager({ businesses, users }: { businesses: Business[] | null, users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [commune, setCommune] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['Pêche']);
    const [ownerId, setOwnerId] = useState('');
    const [ownerSearch, setOwnerSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(u => 
            u.email.toLowerCase().includes(ownerSearch.toLowerCase()) || 
            u.displayName.toLowerCase().includes(ownerSearch.toLowerCase()) ||
            u.id.toLowerCase() === ownerSearch.toLowerCase()
        ).slice(0, 10);
    }, [users, ownerSearch]);

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handleAdd = async () => {
        if (!firestore || !name || !commune || !ownerId || selectedCategories.length === 0) return;
        setIsSaving(true);
        try {
            const businessRef = doc(collection(firestore, 'businesses'));
            const businessData: Business = {
                id: businessRef.id,
                ownerId,
                name,
                commune,
                categories: selectedCategories,
                createdAt: serverTimestamp()
            };
            
            const batch = writeBatch(firestore);
            batch.set(businessRef, businessData);
            batch.update(doc(firestore, 'users', ownerId), { 
                businessId: businessRef.id,
                role: 'professional',
                subscriptionStatus: 'professional'
            });
            
            await batch.commit();
            setName(''); setCommune(''); setOwnerId(''); setSelectedCategories(['Pêche']); setOwnerSearch('');
            toast({ title: "Commerce créé et lié à l'utilisateur" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Store className="size-5 text-primary" /> Gestion des Commerces Pro</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom du commerce</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pacific Pêche..." /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Commune</Label>
                            <Select value={commune} onValueChange={setCommune}>
                                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                <SelectContent className="max-h-64">
                                    {Object.keys(locations).map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Catégories (Plusieurs possibles)</Label>
                            <div className="flex flex-wrap gap-4 p-3 bg-background rounded-lg border">
                                {['Pêche', 'Chasse', 'Jardinage'].map(cat => (
                                    <div key={cat} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`cat-${cat}`} 
                                            checked={selectedCategories.includes(cat)} 
                                            onCheckedChange={() => toggleCategory(cat)}
                                        />
                                        <label htmlFor={`cat-${cat}`} className="text-xs font-bold uppercase cursor-pointer">{cat}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Propriétaire (UID ou Email)</Label>
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                                    <Input 
                                        placeholder="Chercher par Email ou coller l'UID..." 
                                        value={ownerSearch} 
                                        onChange={e => setOwnerSearch(e.target.value)}
                                        className="pl-8 text-xs h-9"
                                    />
                                </div>
                                <Select value={ownerId} onValueChange={setOwnerId}>
                                    <SelectTrigger className="h-10 text-xs font-bold"><SelectValue placeholder="Sélectionner le résultat..." /></SelectTrigger>
                                    <SelectContent>
                                        {filteredUsers.length > 0 ? (
                                            filteredUsers.map(u => (
                                                <SelectItem key={u.id} value={u.id} className="text-xs font-medium">
                                                    {u.displayName} ({u.email}) - <span className="opacity-40 font-mono text-[8px]">{u.id}</span>
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <p className="p-2 text-[10px] text-center italic opacity-40">Aucun utilisateur correspondant</p>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleAdd} disabled={isSaving || !name || !commune || !ownerId || selectedCategories.length === 0} className="w-full font-black uppercase h-12 shadow-lg bg-primary">Lier et créer le commerce</Button>
                </div>
                <div className="max-h-96 overflow-y-auto border-2 rounded-2xl">
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[10px] font-black uppercase h-10 px-4">Commerce</TableHead><TableHead className="text-[10px] font-black uppercase h-10">Propriétaire</TableHead><TableHead className="text-right text-[10px] font-black uppercase h-10 px-4">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {businesses?.map(b => {
                                const owner = users?.find(u => u.id === b.ownerId);
                                return (
                                    <TableRow key={b.id}>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-black text-xs">{b.name}</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <Badge variant="secondary" className="text-[7px] h-3 px-1">{b.commune}</Badge>
                                                    {(b.categories || [b.category]).map(cat => (
                                                        <Badge key={cat} variant="outline" className="text-[7px] h-3 px-1 border-primary/30 text-primary">{cat}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold">
                                            {owner?.displayName || 'Inconnu'} 
                                            <div className="opacity-40 italic flex flex-col leading-tight">
                                                <span>{owner?.email || 'N/A'}</span>
                                                <span className="font-mono text-[8px]">{b.ownerId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-4"><Button variant="ghost" size="icon" className="text-destructive/40 hover:text-destructive" onClick={() => deleteDoc(doc(firestore!, 'businesses', b.id))}><Trash2 className="size-3" /></Button></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function SystemNotificationsManager({ notifications }: { notifications: SystemNotification[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<SystemNotification['type']>('info');
    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = async () => {
        if (!firestore || !title || !content) return;
        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'system_notifications'), {
                title, content, type, isActive: true, createdAt: serverTimestamp()
            });
            setTitle(''); setContent('');
            toast({ title: "Notification publiée" });
        } catch (e: any) {
            console.error("Add Notification Error:", e);
            toast({ variant: 'destructive', title: "Erreur de publication", description: e.message || "Vérifiez vos permissions." });
        } finally { setIsSaving(false); }
    };

    const toggleStatus = async (id: string, current: boolean) => {
        if (!firestore) return;
        await setDoc(doc(firestore, 'system_notifications', id), { isActive: !current }, { merge: true });
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Megaphone className="size-5 text-primary" /> Bandeaux d'information Accueil</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Titre du bandeau</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Alerte Météo, Maintenance..." /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Type</Label>
                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="info">Information (Bleu)</SelectItem><SelectItem value="warning">Vigilance (Orange)</SelectItem><SelectItem value="error">Alerte (Rouge)</SelectItem><SelectItem value="success">Succès (Vert)</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Message détaillé</Label><Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Contenu du message..." /></div>
                    <Button onClick={handleAdd} disabled={isSaving || !title} className="w-full font-black uppercase h-12 shadow-lg">Publier sur l'accueil</Button>
                </div>
                <div className="space-y-2">
                    {notifications?.map(n => (
                        <div key={n.id} className="flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={cn("size-3 rounded-full", n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500')} />
                                <div className="flex flex-col"><span className="font-black text-xs uppercase">{n.title}</span><span className="text-[9px] font-bold opacity-40">{n.isActive ? 'ACTIF' : 'ARCHIVÉ'}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => toggleStatus(n.id, n.isActive)} className="h-8 text-[9px] font-black uppercase">{n.isActive ? 'Masquer' : 'Afficher'}</Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'system_notifications', n.id))} className="size-8 text-destructive"><Trash2 className="size-3" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function SoundLibraryManager({ sounds }: { sounds: SoundLibraryEntry[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [label, setLabel] = useState('');
    const [url, setUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = async () => {
        if (!firestore || !label || !url) return;
        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'sound_library'), {
                label, url, categories: ['General'], createdAt: serverTimestamp()
            });
            setLabel(''); setUrl('');
            toast({ title: "Son ajouté" });
        } finally { setIsSaving(false); }
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Volume2 className="size-5 text-primary" /> Bibliothèque de Sons</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Libellé</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Alerte sonar..." /></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">URL (.mp3)</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." /></div>
                </div>
                <Button onClick={handleAdd} disabled={isSaving || !label || !url} className="w-full font-black uppercase h-12 shadow-lg">Enregistrer le son</Button>
                <div className="max-h-64 overflow-y-auto space-y-2 border-t pt-4">
                    {sounds?.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 border-2 rounded-xl bg-white shadow-sm">
                            <span className="font-black text-[10px] uppercase pl-2">{s.label}</span>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="size-8" onClick={() => new Audio(s.url).play()}><Play className="size-3" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'sound_library', s.id))} className="size-8 text-destructive"><Trash2 className="size-3" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function CampaignsManager({ campaigns }: { campaigns: Campaign[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const updateStatus = async (id: string, status: 'sent' | 'pending') => {
        if (!firestore) return;
        await updateDoc(doc(firestore, 'campaigns', id), { status });
        toast({ title: "Campagne mise à jour" });
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Megaphone className="size-5 text-accent" /> Campagnes Pro (Push)</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] font-black uppercase h-10 px-4">Commerce</TableHead>
                        <TableHead className="text-[10px] font-black uppercase h-10">Message</TableHead>
                        <TableHead className="text-[10px] font-black uppercase h-10">Reach / Coût</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase h-10 px-4">Action</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {campaigns?.map(c => (
                            <TableRow key={c.id}>
                                <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs">{c.businessName}</span><span className="text-[9px] font-bold opacity-40">{c.targetCommune} / {c.targetCategory}</span></div></TableCell>
                                <TableCell className="text-[10px] font-medium max-w-[150px] truncate">{c.title}</TableCell>
                                <TableCell><div className="flex flex-col"><span className="font-black text-xs">{c.reach} pers.</span><span className="text-[9px] font-bold text-accent">{c.cost} F</span></div></TableCell>
                                <TableCell className="text-right px-4">
                                    <Badge variant={c.status === 'sent' ? 'default' : 'secondary'} className="text-[8px] font-black uppercase cursor-pointer" onClick={() => updateStatus(c.id, c.status === 'sent' ? 'pending' : 'sent')}>
                                        {c.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function UsersManager({ users, isUsersLoading }: { users: UserAccount[] | null, isUsersLoading: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const filtered = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase())) || [];

    const handleUpdateUser = async () => {
        if (!firestore || !editingUser) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'users', editingUser.id), editingUser, { merge: true });
            toast({ title: "Utilisateur mis à jour" });
            setIsEditDialogOpen(false);
            setEditingUser(null);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur sauvegarde" });
        } finally {
            setIsSaving(false);
        }
    };

    const updateStatus = async (uid: string, status: string) => {
        if (!firestore) return;
        const expiryDate = status === 'active' ? addMonths(new Date(), 1).toISOString() : null;
        await setDoc(doc(firestore, 'users', uid), { 
            subscriptionStatus: status,
            subscriptionExpiryDate: expiryDate
        }, { merge: true });
        toast({ title: "Statut mis à jour" });
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/10 border-b flex-row justify-between items-center">
                <div><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Users className="size-5 text-primary" /> Gestion des Comptes</CardTitle></div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                    <Input placeholder="Chercher utilisateur..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-xs border-2" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] font-black uppercase h-10 px-4">Utilisateur</TableHead>
                        <TableHead className="text-[10px] font-black uppercase h-10">Rôle</TableHead>
                        <TableHead className="text-[10px] font-black uppercase h-10">Abonnement</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase h-10 px-4">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {filtered.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="px-4 py-3">
                                    <div className="flex flex-col"><span className="font-black text-xs">{u.displayName}</span><span className="text-[9px] font-bold opacity-40 lowercase">{u.email}</span></div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase h-5">
                                        {u.role || 'client'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={u.subscriptionStatus === 'active' ? 'default' : u.subscriptionStatus === 'trial' ? 'secondary' : 'destructive'} className="text-[8px] font-black uppercase h-5">
                                            {u.subscriptionStatus}
                                        </Badge>
                                        {u.subscriptionExpiryDate && <span className="text-[8px] font-bold opacity-40">Expire: {format(new Date(u.subscriptionExpiryDate), 'dd/MM/yy')}</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right px-4">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setIsEditDialogOpen(true); }} className="size-7 text-primary/60"><Pencil className="size-3" /></Button>
                                        <Button variant="outline" size="sm" onClick={() => updateStatus(u.id, 'active')} className="h-7 text-[8px] font-black uppercase">Activer</Button>
                                        <Button variant="outline" size="sm" onClick={() => updateStatus(u.id, 'limited')} className="h-7 text-[8px] font-black uppercase border-red-200 text-red-600">Couper</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2"><Pencil className="size-5" /> Modifier l'utilisateur</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase">{editingUser?.email}</DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Nom d'affichage</Label>
                                <Input value={editingUser.displayName} onChange={e => setEditingUser({ ...editingUser, displayName: e.target.value })} className="font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Rôle</Label>
                                    <Select value={editingUser.role} onValueChange={(v: any) => setEditingUser({ ...editingUser, role: v })}>
                                        <SelectTrigger className="font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="client">Client</SelectItem>
                                            <SelectItem value="professional">Professionnel</SelectItem>
                                            <SelectItem value="admin">Administrateur</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Statut Abonnement</Label>
                                    <Select value={editingUser.subscriptionStatus} onValueChange={(v: any) => setEditingUser({ ...editingUser, subscriptionStatus: v })}>
                                        <SelectTrigger className="font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="trial">Essai Gratuit</SelectItem>
                                            <SelectItem value="active">Abonné Actif</SelectItem>
                                            <SelectItem value="limited">Mode Limité</SelectItem>
                                            <SelectItem value="admin">Admin (Illimité)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Date d'expiration (ISO)</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        type="date" 
                                        value={editingUser.subscriptionExpiryDate ? editingUser.subscriptionExpiryDate.split('T')[0] : ''} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setEditingUser({ ...editingUser, subscriptionExpiryDate: val ? new Date(val).toISOString() : undefined });
                                        }} 
                                        className="font-bold" 
                                    />
                                    <Button variant="outline" size="icon" onClick={() => setEditingUser({ ...editingUser, subscriptionExpiryDate: undefined })} className="shrink-0"><X className="size-4" /></Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="font-black uppercase h-12">Annuler</Button>
                        <Button onClick={handleUpdateUser} disabled={isSaving} className="font-black uppercase h-12 gap-2 shadow-lg bg-primary">
                            <Save className="size-4" /> Enregistrer les modifications
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function SplashManager({ initialSettings }: { initialSettings: SplashScreenSettings | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [settings, setSettings] = useState<SplashScreenSettings>(initialSettings || { splashMode: 'text', splashText: 'Lagon & Brousse NC', splashTextColor: '#ffffff', splashFontSize: '32', splashBgColor: '#3b82f6', splashImageUrl: '', splashImageFit: 'contain', splashDuration: 2.5 });
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (initialSettings) setSettings(initialSettings); }, [initialSettings]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setSettings({ ...settings, splashImageUrl: base64 });
            toast({ title: "Image chargée localement", description: "N'oubliez pas de sauvegarder." });
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'app_settings', 'splash'), settings, { merge: true });
            toast({ title: "Splash mis à jour" });
        } finally { setIsSaving(false); }
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5 text-primary" /> Configuration Splash Screen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Mode</Label>
                        <Select value={settings.splashMode} onValueChange={(v: any) => setSettings({ ...settings, splashMode: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="text">Texte pur</SelectItem><SelectItem value="image">Image / Logo</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Durée (sec)</Label><Input type="number" step="0.5" value={settings.splashDuration} onChange={e => setSettings({ ...settings, splashDuration: parseFloat(e.target.value) })} /></div>
                </div>
                {settings.splashMode === 'text' ? (
                    <div className="space-y-3">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Texte affiché</Label><Input value={settings.splashText} onChange={e => setSettings({ ...settings, splashText: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Couleur Texte</Label><Input type="color" value={settings.splashTextColor} onChange={e => setSettings({ ...settings, splashTextColor: e.target.value })} className="h-10 p-1" /></div>
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Taille Police</Label><Input type="number" value={settings.splashFontSize} onChange={e => setSettings({ ...settings, splashFontSize: e.target.value })} /></div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Pouvoir telecharger l'image sur le smartphone</Label>
                            <div className="flex gap-2">
                                <Input 
                                    value={settings.splashImageUrl} 
                                    onChange={e => setSettings({ ...settings, splashImageUrl: e.target.value })} 
                                    placeholder="Lien de l'image..." 
                                    className="flex-grow"
                                />
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="shrink-0 h-10 w-10 border-2" 
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="size-4" />
                                </Button>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileChange} 
                                />
                            </div>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Ajustement</Label>
                            <Select value={settings.splashImageFit} onValueChange={(v: any) => setSettings({ ...settings, splashImageFit: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="contain">Contenir (Entier)</SelectItem><SelectItem value="cover">Couvrir (Plein écran)</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Couleur Fond</Label><Input type="color" value={settings.splashBgColor} onChange={e => setSettings({ ...settings, splashBgColor: e.target.value })} className="h-10 p-1" /></div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full font-black uppercase h-12 gap-2 shadow-lg"><Save className="size-4" /> Sauvegarder l'identité visuelle</Button>
            </CardContent>
        </Card>
    );
}

function CgvRibManager({ cgvData, ribData }: { cgvData: CgvSettings | null, ribData: RibSettings | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [cgvContent, setCgvContent] = useState('');
    const [ribContent, setRibContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => { if (cgvData) setCgvContent(cgvData.content); if (ribData) setRibContent(ribData.details); }, [cgvData, ribData]);

    const handleSave = async (type: 'cgv' | 'rib') => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            if (type === 'cgv') {
                const newVersion = (cgvData?.version || 0) + 1;
                await setDoc(doc(firestore, 'app_settings', 'cgv'), { content: cgvContent, version: newVersion, updatedAt: serverTimestamp() });
                toast({ title: "CGV mises à jour", description: `Nouvelle version : ${newVersion}` });
            } else {
                await setDoc(doc(firestore, 'app_settings', 'rib'), { details: ribContent, updatedAt: serverTimestamp() });
                toast({ title: "RIB mis à jour" });
            }
        } finally { setIsSaving(false); }
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><FileText className="size-5 text-primary" /> Textes Légaux & Dons</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center justify-between">Conditions Générales (CGV) <Badge variant="outline" className="h-4 text-[8px] font-black">V{cgvData?.version || 0}</Badge></Label>
                    <Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[150px] text-xs font-medium" />
                    <Button variant="outline" onClick={() => handleSave('cgv')} disabled={isSaving} className="w-full h-10 font-black uppercase text-[10px] border-2">Publier nouvelle version CGV</Button>
                </div>
                <div className="space-y-2 border-t pt-4">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-2"><CreditCard className="size-3" /> Coordonnées Bancaires (Virement)</Label>
                    <Textarea value={ribContent} onChange={e => setRibContent(e.target.value)} className="min-h-[80px] font-mono text-[10px]" />
                    <Button variant="outline" onClick={() => handleSave('rib')} disabled={isSaving} className="w-full h-10 font-black uppercase text-[10px] border-2">Mettre à jour le RIB</Button>
                </div>
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
        if (!firestore) return;
        setIsSaving(true);
        const durationNum = parseInt(duration);
        const expiry = Timestamp.fromDate(addDays(new Date(), durationNum));
        const docRef = doc(firestore, 'shared_access_tokens', 'GLOBAL');
        const data = { expiresAt: expiry, updatedAt: serverTimestamp() };
        
        setDoc(docRef, data, { merge: true })
            .then(() => {
                toast({ title: "Accès Global activé !" });
            })
            .catch((error) => {
                console.error("Global Access Error:", error);
                toast({ variant: "destructive", title: "Erreur Permission", description: "Impossible d'activer l'offre. Vérifiez vos droits Master." });
            })
            .finally(() => {
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
            })
            .catch((error) => {
                console.error("Global Stop Error:", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de couper l'offre." });
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    const isGlobalActive = globalGift && globalGift.expiresAt && isBefore(new Date(), globalGift.expiresAt.toDate());

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-6" /> Accès Global (Cadeau)</CardTitle>
            <CardDescription className="text-xs font-bold uppercase">Ouvrez l'accès premium à TOUS les utilisateurs inscrits pour une durée déterminée.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
                <div className={cn("p-4 rounded-2xl border-2 flex items-center justify-between", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                    <div className="flex flex-col"><span className="text-[10px] font-black uppercase opacity-60">Statut actuel</span>
                        <p className={cn("text-sm font-black", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'AUCUN ACCÈS ACTIF'}</p>
                    </div>
                    {isGlobalActive && (
                        <Button variant="destructive" size="sm" onClick={handleStop} disabled={isSaving} className="h-8 font-black uppercase text-[10px]">
                            {isSaving ? <RefreshCw className="size-3 animate-spin" /> : 'Couper'}
                        </Button>
                    )}
                </div>
                <div className="space-y-4">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Durée de l'offre (jours)</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger className="h-12 border-2 font-black"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="1">1 jour</SelectItem><SelectItem value="7">1 semaine</SelectItem><SelectItem value="30">1 mois</SelectItem><SelectItem value="90">3 mois</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleActivate} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest bg-primary shadow-lg text-sm">
                        {isSaving ? <RefreshCw className="size-5 animate-spin mr-2" /> : null}
                        Activer l'offre cadeau
                    </Button>
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
        const data = {
            id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp()
        };

        setDoc(docRef, data)
            .then(() => {
                toast({ title: "Jeton généré !" });
            })
            .catch((error) => {
                console.error("Token Generation Error:", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le jeton. Vérifiez vos permissions." });
            })
            .finally(() => {
                setIsGenerating(false);
            });
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Ticket className="size-6 text-accent" /> Jetons d'Accès Individuels</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1">Durée (mois)</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="1">1 mois</SelectItem><SelectItem value="3">3 mois</SelectItem><SelectItem value="6">6 mois</SelectItem><SelectItem value="12">12 mois</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end"><Button onClick={generateToken} disabled={isGenerating} className="w-full h-12 font-black uppercase tracking-widest gap-2 bg-accent hover:bg-accent/90 shadow-lg"><Zap className="size-4" /> Générer</Button></div>
                </div>
                <div className="max-h-64 overflow-y-auto border-2 rounded-2xl">
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[9px] font-black uppercase h-8 px-3">Code</TableHead><TableHead className="text-[9px] font-black uppercase h-8">Durée</TableHead><TableHead className="text-[9px] font-black uppercase h-8">État</TableHead><TableHead className="text-right text-[9px] font-black uppercase h-8 px-3">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {tokens?.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="px-3 py-2 font-mono text-[10px] font-black">{t.id}</TableCell>
                                    <TableCell className="text-[10px] font-bold">{t.durationMonths} m</TableCell>
                                    <TableCell><Badge variant={t.status === 'active' ? 'outline' : 'secondary'} className="text-[7px] font-black uppercase h-4 px-1">{t.status}</Badge></TableCell>
                                    <TableCell className="text-right px-3"><Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'access_tokens', t.id))} className="size-7 text-destructive"><Trash2 className="size-3" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function FishManager({ species }: { species: FishSpeciesInfo[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [scieName, setScieName] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefilling, setIsRefilling] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [editingFish, setEditingFish] = useState<FishSpeciesInfo | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const addFileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (isEdit && editingFish) {
                setEditingFish({ ...editingFish, imageUrl: base64 });
            } else {
                setCurrentImageUrl(base64);
            }
            toast({ title: "Photo chargée" });
        };
        reader.readAsDataURL(file);
    };

    const handleAdd = async (aiData?: any) => {
        if (!firestore || !name) return;
        setIsSaving(true);
        try {
            const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
            const data = aiData || { 
                name, 
                scientificName: scieName, 
                category: 'Lagon', 
                gratteRisk: 0, 
                gratteRiskSmall: 0, 
                gratteRiskMedium: 0, 
                gratteRiskLarge: 0, 
                fishingAdvice: '', 
                culinaryAdvice: '',
                imageUrl: currentImageUrl
            };
            await setDoc(doc(firestore, 'fish_species', id), { ...data, id }, { merge: true });
            setName(''); setScieName(''); setCurrentImageUrl('');
            toast({ title: "Espèce répertoriée" });
        } catch (e) { toast({ variant: 'destructive', title: "Erreur" }); }
        finally { setIsSaving(false); }
    };

    const handleUpdate = async () => {
        if (!firestore || !editingFish) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'fish_species', editingFish.id), editingFish, { merge: true });
            setIsEditDialogOpen(false);
            setEditingFish(null);
            toast({ title: "Fiche mise à jour" });
        } catch (e) { toast({ variant: 'destructive', title: "Erreur sauvegarde" }); }
        finally { setIsSaving(false); }
    };

    const handleAiFill = async () => {
        if (!name) return;
        setIsGenerating(true);
        try {
            const info = await generateFishInfo({ name, scientificName: scieName });
            handleAdd({
                name,
                scientificName: info.scientificName,
                category: info.category,
                gratteRisk: info.gratteRiskMedium,
                gratteRiskSmall: info.gratteRiskSmall,
                gratteRiskMedium: info.gratteRiskMedium,
                gratteRiskLarge: info.gratteRiskLarge,
                lengthSmall: info.lengthSmall,
                lengthMedium: info.lengthMedium,
                lengthLarge: info.lengthLarge,
                fishingAdvice: info.fishingAdvice,
                culinaryAdvice: info.culinaryAdvice,
                imageUrl: currentImageUrl
            });
        } finally { setIsGenerating(false); }
    };

    const handleAiRefill = async () => {
        if (!editingFish) return;
        setIsRefilling(true);
        try {
            const info = await generateFishInfo({ 
                name: editingFish.name, 
                scientificName: editingFish.scientificName 
            });
            setEditingFish({
                ...editingFish,
                scientificName: info.scientificName,
                category: info.category,
                gratteRiskSmall: info.gratteRiskSmall,
                gratteRiskMedium: info.gratteRiskMedium,
                gratteRiskLarge: info.gratteRiskLarge,
                lengthSmall: info.lengthSmall,
                lengthMedium: info.lengthMedium,
                lengthLarge: info.lengthLarge,
                fishingAdvice: info.fishingAdvice,
                culinaryAdvice: info.culinaryAdvice,
            });
            toast({ title: "Champs mis à jour par l'IA", description: "Vérifiez les données avant de sauvegarder." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur IA", description: "L'IA n'a pas pu générer les informations." });
        } finally {
            setIsRefilling(false);
        }
    };

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2"><Fish className="size-6 text-primary" /> Guide Poissons & Gratte</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom Commun NC</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Bec de cane..." /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom Scientifique</Label><Input value={scieName} onChange={e => setScieName(e.target.value)} placeholder="Optionnel..." /></div>
                    </div>
                    
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase">Photo du spécimen (Smartphone)</Label>
                        <div className="flex gap-2">
                            <Input value={currentImageUrl} onChange={e => setCurrentImageUrl(e.target.value)} placeholder="URL ou base64..." className="flex-grow" />
                            <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 border-2" onClick={() => addFileInputRef.current?.click()}><Camera className="size-4" /></Button>
                            <input type="file" accept="image/*" ref={addFileInputRef} className="hidden" onChange={e => handleFileChange(e, false)} />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => handleAdd()} disabled={isSaving || !name} className="flex-1 font-black uppercase h-12 border-2" variant="outline">Saisie Manuelle</Button>
                        <Button onClick={handleAiFill} disabled={isGenerating || isSaving || !name} className="flex-1 font-black uppercase h-12 gap-2 shadow-lg bg-primary">
                            {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />} IA (Gemini)
                        </Button>
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto border-2 rounded-2xl">
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[9px] font-black uppercase h-8 px-3">Espèce</TableHead><TableHead className="text-[9px] font-black uppercase h-8">Catégorie</TableHead><TableHead className="text-[9px] font-black uppercase h-8">Risque (M)</TableHead><TableHead className="text-right text-[9px] font-black uppercase h-8 px-3">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {species?.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            {s.imageUrl && <div className="size-6 rounded border bg-muted shrink-0 overflow-hidden"><img src={s.imageUrl} className="w-full h-full object-cover" /></div>}
                                            <div className="flex flex-col"><span className="font-black text-xs uppercase leading-none">{s.name}</span><span className="text-[8px] italic opacity-40">{s.scientificName}</span></div>
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className="text-[7px] font-black uppercase h-4">{s.category}</Badge></TableCell>
                                    <TableCell className="font-black text-xs">{s.gratteRiskMedium || s.gratteRisk}%</TableCell>
                                    <TableCell className="text-right px-3">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingFish(s); setIsEditDialogOpen(true); }} className="size-7 text-primary/60"><Pencil className="size-3" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'fish_species', s.id))} className="size-7 text-destructive/60"><Trash2 className="size-3" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2"><Pencil className="size-5" /> Modifier : {editingFish?.name}</DialogTitle>
                        <DialogDescription className="text-xs uppercase font-bold">Mise à jour de la fiche technique</DialogDescription>
                    </DialogHeader>
                    {editingFish && (
                        <div className="space-y-4 py-4">
                            <div className="flex justify-end">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="font-black uppercase h-9 gap-2 shadow-sm border-2 border-primary/20"
                                    onClick={handleAiRefill}
                                    disabled={isRefilling}
                                >
                                    {isRefilling ? <RefreshCw className="size-3 animate-spin" /> : <BrainCircuit className="size-3" />}
                                    Remplir via IA (Gemini)
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom Commun</Label><Input value={editingFish.name} onChange={e => setEditingFish({...editingFish, name: e.target.value})} /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Nom Scientifique</Label><Input value={editingFish.scientificName} onChange={e => setEditingFish({...editingFish, scientificName: e.target.value})} /></div>
                            </div>
                            
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase">Photo (Smartphone)</Label>
                                <div className="flex gap-2">
                                    <Input value={editingFish.imageUrl || ''} onChange={e => setEditingFish({...editingFish, imageUrl: e.target.value})} className="flex-grow" />
                                    <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 border-2" onClick={() => editFileInputRef.current?.click()}><Camera className="size-4" /></Button>
                                    <input type="file" accept="image/*" ref={editFileInputRef} className="hidden" onChange={handleFileChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Risque Petit (%)</Label><Input type="number" value={editingFish.gratteRiskSmall} onChange={e => setEditingFish({...editingFish, gratteRiskSmall: parseInt(e.target.value)})} /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Risque Moyen (%)</Label><Input type="number" value={editingFish.gratteRiskMedium} onChange={e => setEditingFish({...editingFish, gratteRiskMedium: parseInt(e.target.value)})} /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Risque Grand (%)</Label><Input type="number" value={editingFish.gratteRiskLarge} onChange={e => setEditingFish({...editingFish, gratteRiskLarge: parseInt(e.target.value)})} /></div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Taille P (cm)</Label><Input value={editingFish.lengthSmall || ''} onChange={e => setEditingFish({...editingFish, lengthSmall: e.target.value})} /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Taille M (cm)</Label><Input value={editingFish.lengthMedium || ''} onChange={e => setEditingFish({...editingFish, lengthMedium: e.target.value})} /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Taille G (cm)</Label><Input value={editingFish.lengthLarge || ''} onChange={e => setEditingFish({...editingFish, lengthLarge: e.target.value})} /></div>
                            </div>

                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Conseils Pêche</Label><Textarea value={editingFish.fishingAdvice} onChange={e => setEditingFish({...editingFish, fishingAdvice: e.target.value})} /></div>
                            <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Conseils Cuisine</Label><Textarea value={editingFish.culinaryAdvice} onChange={e => setEditingFish({...editingFish, culinaryAdvice: e.target.value})} /></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="font-black uppercase h-12">Annuler</Button>
                        <Button onClick={handleUpdate} disabled={isSaving} className="font-black uppercase h-12 gap-2 shadow-lg bg-primary">
                            <Save className="size-4" /> Enregistrer les modifications
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function SupportConversationsManager({ conversations, error }: { conversations: Conversation[] | null, error?: any }) {
    const firestore = useFirestore();

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><MessageSquare className="size-5 text-primary" /> Support & Messages Clients</CardTitle></CardHeader>
            <CardContent className="p-0">
                {error ? (
                    <div className="p-8 text-center text-xs font-black uppercase text-red-600 bg-red-50 flex flex-col items-center gap-2">
                        <AlertTriangle className="size-6" />
                        Erreur de permissions sur les conversations
                        <p className="text-[8px] opacity-60">Veuillez rafraîchir la page (Cmd+Shift+R)</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader><TableRow className="bg-muted/30">
                            <TableHead className="text-[10px] font-black uppercase h-10 px-4">Utilisateur</TableHead>
                            <TableHead className="text-[10px] font-black uppercase h-10">Dernier Message</TableHead>
                            <TableHead className="right text-[10px] font-black uppercase h-10 px-4">Action</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {conversations?.map(conv => (
                                <TableRow key={conv.id} className={cn(!conv.isReadByAdmin && "bg-primary/5")}>
                                    <TableCell className="px-4 py-3"><div className="flex flex-col"><span className="font-black text-xs">{conv.userDisplayName}</span><span className="text-[9px] font-bold opacity-40 lowercase">{conv.userEmail}</span></div></TableCell>
                                    <TableCell className="text-xs italic opacity-70 truncate max-w-[200px]">"{conv.lastMessageContent}"</TableCell>
                                    <TableCell className="text-right px-4"><Button asChild variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase border-2"><Link href={`/admin/messages/${conv.id}`}>Répondre</Link></Button></TableCell>
                                </TableRow>
                            ))}
                            {(!conversations || conversations.length === 0) && (
                                <TableRow><TableCell colSpan={3} className="text-center py-12 text-xs italic opacity-40 uppercase font-black tracking-widest">Aucun message</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}