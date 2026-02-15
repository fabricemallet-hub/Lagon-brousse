'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, updateDoc } from 'firebase/firestore';
import type { UserAccount, Business, Conversation, AccessToken, SharedAccessToken, FishSpeciesInfo, SplashScreenSettings, CgvSettings, RibSettings, SystemNotification, Campaign, SoundLibraryEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  KeyRound, 
  Fish, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Save, 
  Zap, 
  Ticket, 
  BrainCircuit, 
  Smartphone,
  Megaphone,
  Sparkles,
  Search,
  FileText,
  Camera,
  Pencil,
  X,
  Volume2,
  Play,
  Store,
  UserCog,
  Lock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, addMonths, addDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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
  if (!isAdmin) return <div className="p-12 text-center font-black uppercase text-muted-foreground animate-pulse">Accès Master Requis...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
            <ShieldCheck className="size-48" />
        </div>
        <CardHeader className="py-8 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-3xl">Administration Master</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-9 mb-6 h-auto bg-muted/50 border-2 rounded-2xl p-1.5 shadow-sm gap-1">
          <TabsTrigger value="stats" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Stats</TabsTrigger>
          <TabsTrigger value="users" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Comptes</TabsTrigger>
          <TabsTrigger value="permissions" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Rôles</TabsTrigger>
          <TabsTrigger value="businesses" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Commerces</TabsTrigger>
          <TabsTrigger value="design" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Design</TabsTrigger>
          <TabsTrigger value="notifications" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Notifs</TabsTrigger>
          <TabsTrigger value="fish" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Fish</TabsTrigger>
          <TabsTrigger value="acces" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Jetons</TabsTrigger>
          <TabsTrigger value="support" className="text-[9px] font-black uppercase py-2.5 rounded-xl">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-primary">Abonnés</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-accent">Commerces</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{businesses?.length || 0}</div></CardContent></Card>
            <Card className="border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-green-600">Support</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{conversations?.filter(c => !c.isReadByAdmin).length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="users"><UsersManager users={users} isUsersLoading={isUsersLoading} /></TabsContent>
        <TabsContent value="permissions"><PermissionsManager users={users} /></TabsContent>
        <TabsContent value="businesses"><BusinessesManager businesses={businesses} users={users} /></TabsContent>
        <TabsContent value="design">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SplashManager initialSettings={splashSettings} />
            <CgvRibManager cgvData={cgvData} ribData={ribData} />
          </div>
        </TabsContent>
        <TabsContent value="notifications">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SystemNotificationsManager notifications={sysNotifs} />
            <SoundLibraryManager sounds={sounds} />
          </div>
          <div className="mt-6"><CampaignsManager campaigns={campaigns} /></div>
        </TabsContent>
        <TabsContent value="fish"><FishManager species={fishSpecies} /></TabsContent>
        <TabsContent value="acces">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlobalAccessManager globalGift={globalGift} />
            <TokenManager tokens={tokens} />
          </div>
        </TabsContent>
        <TabsContent value="support"><SupportConversationsManager conversations={conversations} /></TabsContent>
      </Tabs>
    </div>
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
            .then(() => toast({ title: "Accès Global activé !" }))
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data,
                }));
            })
            .finally(() => setIsSaving(false));
    };

    const handleStop = () => {
        if (!firestore) return;
        setIsSaving(true);
        const docRef = doc(firestore, 'shared_access_tokens', 'GLOBAL');
        const data = { expiresAt: Timestamp.fromDate(new Date(0)), updatedAt: serverTimestamp() };
        
        setDoc(docRef, data, { merge: true })
            .then(() => toast({ title: "Accès Global coupé" }))
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data,
                }));
            })
            .finally(() => setIsSaving(false));
    };

    const isGlobalActive = globalGift && globalGift.expiresAt && isBefore(new Date(), globalGift.expiresAt.toDate());

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-6" /> Accès Cadeau Global</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className={cn("p-4 rounded-2xl border-2 flex items-center justify-between", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase opacity-60">Statut</span>
                        <p className={cn("text-sm font-black", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'INACTIF'}</p>
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
            .then(() => toast({ title: "Jeton généré !" }))
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'write',
                    requestResourceData: data,
                }));
            })
            .finally(() => setIsGenerating(false));
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
        const updateData = { role: newRole, subscriptionStatus: newRole === 'admin' ? 'admin' : (newRole === 'professional' ? 'professional' : 'trial') };
        updateDoc(doc(firestore, 'users', userId), updateData)
            .then(() => toast({ title: "Permissions mises à jour" }))
            .catch(() => toast({ variant: 'destructive', title: "Erreur" }))
            .finally(() => setIsUpdating(null));
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
                <div><CardTitle className="text-xl font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-6" /> Rôles</CardTitle></div>
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

function BusinessesManager({ businesses, users }: { businesses: Business[] | null, users: UserAccount[] | null }) { return null; }
function SystemNotificationsManager({ notifications }: { notifications: SystemNotification[] | null }) { return null; }
function SoundLibraryManager({ sounds }: { sounds: SoundLibraryEntry[] | null }) { return null; }
function CampaignsManager({ campaigns }: { campaigns: Campaign[] | null }) { return null; }
function UsersManager({ users, isUsersLoading }: { users: UserAccount[] | null, isUsersLoading: boolean }) { return null; }
function SplashManager({ initialSettings }: { initialSettings: SplashScreenSettings | null }) { return null; }
function CgvRibManager({ cgvData, ribData }: { cgvData: CgvSettings | null, ribData: RibSettings | null }) { return null; }
function FishManager({ species }: { species: FishSpeciesInfo[] | null }) { return null; }
function SupportConversationsManager({ conversations }: { conversations: Conversation[] | null }) { return null; }
