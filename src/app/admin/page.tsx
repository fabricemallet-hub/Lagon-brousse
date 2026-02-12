'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, orderBy, query, setDoc, getDocs, where, addDoc, increment } from 'firebase/firestore';
import type { UserAccount, Business, FishSpeciesInfo, AccessToken, SplashScreenSettings, SupportTicket, Conversation } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  Trash2, Plus, Pencil, RefreshCw, MessageSquare, LayoutDashboard, Settings, 
  Fish, KeyRound, Store, Users, TrendingUp, Palette, Trash, Send, Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('stats');

  // User Edit States
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Business States
  const [isBusinessDialogOpen, setIsBusinessDialogOpen] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState<Partial<Business>>({});
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);

  // Token States
  const [tokenDuration, setTokenDuration] = useState('1');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Splash/Design States
  const [isSavingDesign, setIsSavingDesign] = useState(false);

  // Détection robuste et instantanée Admin Maître
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminUids = [
      't8nPnZLcTiaLJSKMuLzib3C5nPn1',
      'K9cVYLVUk1NV99YV3anebkugpPp1', 
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2', 
      'Irglq69MasYdNwBmUu8yKvw6h4G2'
    ];
    const masterEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com'];
    
    if (masterAdminUids.includes(user.uid)) return true;
    if (user.email && masterEmails.includes(user.email.toLowerCase())) return true;
    
    return false;
  }, [user]);

  // Requêtes Firestore avec mémoïsation sécurisée
  const usersRef = useMemoFirebase(() => isAdmin ? query(collection(firestore!, 'users'), orderBy('email', 'asc')) : null, [firestore, isAdmin]);
  const { data: users } = useCollection<UserAccount>(usersRef);

  const businessRef = useMemoFirebase(() => isAdmin ? query(collection(firestore!, 'businesses'), orderBy('name', 'asc')) : null, [firestore, isAdmin]);
  const { data: businesses } = useCollection<Business>(businessRef);

  const tokensRef = useMemoFirebase(() => isAdmin ? query(collection(firestore!, 'access_tokens'), orderBy('createdAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: tokens } = useCollection<AccessToken>(tokensRef);

  const fishRef = useMemoFirebase(() => isAdmin ? query(collection(firestore!, 'fish_species'), orderBy('name', 'asc')) : null, [firestore, isAdmin]);
  const { data: fishSpecies } = useCollection<FishSpeciesInfo>(fishRef);

  const convsRef = useMemoFirebase(() => isAdmin ? collection(firestore!, 'conversations') : null, [firestore, isAdmin]);
  const { data: conversations } = useCollection<Conversation>(convsRef);

  const splashRef = useMemoFirebase(() => isAdmin ? doc(firestore!, 'app_settings', 'splash') : null, [firestore, isAdmin]);
  const { data: splashSettings } = useDoc<SplashScreenSettings>(splashRef);

  // Logic Handlers
  const handleEditUser = (u: UserAccount) => {
    setUserToEdit(u);
  };

  const handleSaveUser = async () => {
    if (!firestore || !userToEdit) return;
    setIsSavingUser(true);
    try {
      await setDoc(doc(firestore, 'users', userToEdit.id), userToEdit, { merge: true });
      toast({ title: "Utilisateur mis à jour" });
      setUserToEdit(null);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!firestore) return;
    setIsGeneratingToken(true);
    const tokenId = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    try {
      await setDoc(doc(firestore, 'access_tokens', tokenId), {
        id: tokenId,
        status: 'active',
        durationMonths: parseInt(tokenDuration),
        createdAt: serverTimestamp()
      });
      toast({ title: "Jeton généré", description: tokenId });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleSaveDesign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    setIsSavingDesign(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    try {
      await setDoc(doc(firestore, 'app_settings', 'splash'), {
        ...data,
        splashDuration: parseFloat(data.splashDuration as string) || 2.5
      }, { merge: true });
      toast({ title: "Design mis à jour" });
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleSaveBusiness = async () => {
    if (!firestore || !currentBusiness.name) return;
    setIsSavingBusiness(true);
    try {
      const id = currentBusiness.id || currentBusiness.name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(firestore, 'businesses', id), {
        ...currentBusiness,
        id,
        createdAt: currentBusiness.createdAt || serverTimestamp()
      }, { merge: true });
      toast({ title: "Commerce enregistré" });
      setIsBusinessDialogOpen(false);
    } finally {
      setIsSavingBusiness(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  const activeSubs = users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader className="py-6">
          <CardTitle className="font-black uppercase tracking-tighter text-2xl text-slate-800 text-center sm:text-left">
            Tableau de Bord Administrateur
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-6 h-auto bg-muted/50 border rounded-xl p-1">
          <TabsTrigger value="stats" className="text-[10px] font-black uppercase py-3">Stats</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase py-3">Utilisateurs</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase py-3">Design</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase py-3">Fish</TabsTrigger>
          <TabsTrigger value="acces" className="text-[10px] font-black uppercase py-3">Accès</TabsTrigger>
          <TabsTrigger value="commerces" className="text-[10px] font-black uppercase py-3">Commerces</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Utilisateurs</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black">{users?.length || 0}</div></CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Abonnés Actifs</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-primary">{activeSubs}</div></CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Revenu Mensuel</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-green-600">{activeSubs * 500} FCFP</div></CardContent>
            </Card>
          </div>

          <Card className="border-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" /> Messagerie
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px] font-black uppercase">Utilisateur</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Dernier Message</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations?.map(conv => (
                    <TableRow key={conv.id} className={cn(!conv.isReadByAdmin && "bg-primary/5")}>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-xs">{conv.userDisplayName || 'Inconnu'}</span>
                          <span className="text-[9px] opacity-50 lowercase">{conv.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs italic truncate max-w-[150px] sm:max-w-xs opacity-70">
                        {conv.lastMessageContent}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase">
                            <Link href={`/admin/messages/${conv.id}`}>Répondre</Link>
                          </Button>
                          {!conv.isReadByAdmin && <Badge className="bg-primary animate-pulse border-none size-2 p-0 rounded-full" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!conversations || conversations.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10 text-xs italic opacity-40">Aucune conversation active</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Liste des Utilisateurs</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">User</TableHead><TableHead className="text-[10px] font-black uppercase">Statut</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users?.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-bold text-xs"><div className="flex flex-col"><span>{u.displayName}</span><span className="text-[9px] opacity-50">{u.email}</span></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{u.subscriptionStatus}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(u)}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setUserToDelete(u.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Palette className="size-4" /> Splash Screen</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveDesign} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Mode</Label>
                    <Select name="splashMode" defaultValue={splashSettings?.splashMode || 'text'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="text">Texte</SelectItem><SelectItem value="image">Image / Logo</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Durée (s)</Label><Input name="splashDuration" type="number" step="0.1" defaultValue={splashSettings?.splashDuration || 2.5} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Texte</Label><Input name="splashText" defaultValue={splashSettings?.splashText || 'Lagon & Brousse NC'} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Couleur Fond</Label><Input name="splashBgColor" type="color" defaultValue={splashSettings?.splashBgColor || '#3b82f6'} /></div>
                  <div className="col-span-full space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">URL Image</Label><Input name="splashImageUrl" defaultValue={splashSettings?.splashImageUrl || ''} placeholder="https://..." /></div>
                </div>
                <Button type="submit" disabled={isSavingDesign} className="w-full font-black uppercase h-12 shadow-lg mt-4">Sauvegarder le Design</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fish" className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-black uppercase">Répertoire des Poissons</h3>
            <Button size="sm" className="font-black uppercase text-[10px]"><Plus className="size-3 mr-1" /> Ajouter</Button>
          </div>
          <div className="grid gap-2">
            {fishSpecies?.map(fish => (
              <Card key={fish.id} className="border-2"><CardContent className="p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-muted rounded-lg flex items-center justify-center font-black text-primary"><Fish className="size-5" /></div>
                  <div className="flex flex-col"><span className="font-black text-xs uppercase">{fish.name}</span><span className="text-[9px] italic opacity-50">{fish.scientificName}</span></div>
                </div>
                <Button variant="ghost" size="icon"><Pencil className="size-3" /></Button>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="acces" className="space-y-6">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader><CardTitle className="text-sm font-black uppercase">Générateur de Jetons</CardTitle></CardHeader>
            <CardContent className="flex gap-3">
              <Select value={tokenDuration} onValueChange={setTokenDuration}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1 Mois</SelectItem><SelectItem value="3">3 Mois</SelectItem><SelectItem value="6">6 Mois</SelectItem><SelectItem value="12">12 Mois</SelectItem></SelectContent>
              </Select>
              <Button onClick={handleGenerateToken} disabled={isGeneratingToken} className="font-black uppercase whitespace-nowrap"><Plus className="size-4 mr-1" /> Créer</Button>
            </CardContent>
          </Card>
          <div className="grid gap-2">
            {tokens?.map(token => (
              <Card key={token.id} className={cn("border-2", token.status === 'redeemed' && "opacity-40 grayscale")}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <KeyRound className={cn("size-4", token.status === 'active' ? "text-primary" : "text-muted-foreground")} />
                    <code className="font-black text-xs tracking-widest">{token.id}</code>
                  </div>
                  <Badge variant={token.status === 'active' ? 'default' : 'outline'} className="text-[8px] font-black uppercase">{token.durationMonths}M • {token.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="commerces" className="space-y-6">
          <div className="flex justify-end"><Button onClick={() => { setCurrentBusiness({}); setIsBusinessDialogOpen(true); }} className="font-black uppercase text-[10px]"><Plus className="size-4 mr-1" /> Boutique</Button></div>
          <div className="grid gap-3">
            {businesses?.map(b => (
              <Card key={b.id} className="border-2">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl shadow-inner"><Store className="size-6" /></div>
                    <div className="flex flex-col"><span className="font-black uppercase text-sm">{b.name}</span><span className="text-[9px] font-bold opacity-50 uppercase">{b.commune} • {b.category}</span></div>
                  </div>
                  <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setCurrentBusiness(b); setIsBusinessDialogOpen(true); }}><Pencil className="size-3" /></Button></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS MODALS */}
      <Dialog open={!!userToEdit} onOpenChange={(o) => !o && setUserToEdit(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Édition Utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Rôle</Label>
              <Select value={userToEdit?.role || 'client'} onValueChange={(v: any) => setUserToEdit(p => p ? {...p, role: v} : null)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="professional">Professionnel</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Statut</Label>
              <Select value={userToEdit?.subscriptionStatus || 'trial'} onValueChange={(v: any) => setUserToEdit(p => p ? {...p, subscriptionStatus: v} : null)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="trial">Essai</SelectItem><SelectItem value="active">Abonné Actif</SelectItem><SelectItem value="professional">Pro</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="inactive">Inactif</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">ID Boutique</Label><Input value={userToEdit?.businessId || ''} onChange={e => setUserToEdit(p => p ? {...p, businessId: e.target.value} : null)} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveUser} disabled={isSavingUser} className="w-full font-black uppercase h-12">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBusinessDialogOpen} onOpenChange={setIsBusinessDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Configuration Boutique</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Nom</Label><Input value={currentBusiness.name || ''} onChange={e => setCurrentBusiness({...currentBusiness, name: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Propriétaire (UID)</Label><Input value={currentBusiness.ownerId || ''} onChange={e => setCurrentBusiness({...currentBusiness, ownerId: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Commune</Label><Input value={currentBusiness.commune || ''} onChange={e => setCurrentBusiness({...currentBusiness, commune: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Catégorie</Label>
                <Select value={currentBusiness.category || ''} onValueChange={(v: any) => setCurrentBusiness({...currentBusiness, category: v})}>
                  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent><SelectItem value="Pêche">Pêche</SelectItem><SelectItem value="Chasse">Chasse</SelectItem><SelectItem value="Jardinage">Jardinage</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveBusiness} disabled={isSavingBusiness} className="w-full font-black uppercase h-12 shadow-lg">Sauvegarder Boutique</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Supprimer définitivement ce document Firestore.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => { if(userToDelete) { deleteDoc(doc(firestore!, 'users', userToDelete)); setUserToDelete(null); } }} className="bg-destructive text-white">Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}