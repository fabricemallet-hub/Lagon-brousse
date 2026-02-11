
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, orderBy, query, setDoc } from 'firebase/firestore';
import type { UserAccount, Business } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  Trash2, Plus, Pencil, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');

  // User Edit States
  const [isUserEditDialogOpen, setIsUserEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Business States
  const [isBusinessDialogOpen, setIsBusinessDialogOpen] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState<Partial<Business>>({});
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);

  // Detection Admin robuste
  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: adminProfile } = useDoc<UserAccount>(userProfileRef);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminUids = [
      'K9cVYLVUk1NV99YV3anebkugpPp1',
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2',
      'Irglq69MasYdNwBmUu8yKvw6h4G2'
    ];
    const masterAdminEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com'];
    return masterAdminUids.includes(user.uid) || 
           (user.email && masterAdminEmails.includes(user.email.toLowerCase())) ||
           adminProfile?.subscriptionStatus === 'admin' || 
           adminProfile?.role === 'admin';
  }, [user, adminProfile]);

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
      toast({ title: "Profil supprimé de Firestore." });
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
      toast({ title: "Commerce enregistré !", description: `ID : ${id}` });
      setIsBusinessDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur sauvegarde" });
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

  useEffect(() => {
    if (!isUserLoading && !isAdmin && adminProfile) router.push('/compte');
  }, [isAdmin, isUserLoading, router, adminProfile]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter text-xl text-primary">Admin : {user?.email}</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-12 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase">Stats</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase">Users</TabsTrigger>
          <TabsTrigger value="commerces" className="text-[10px] font-black uppercase">Commerces</TabsTrigger>
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
                        <Badge variant="outline" className={cn("text-[8px] font-black uppercase", u.subscriptionStatus === 'professional' ? "border-primary text-primary" : u.subscriptionStatus === 'admin' ? "bg-primary text-white border-none" : "")}>
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
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses?.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-bold text-xs">{b.name}</TableCell>
                      <TableCell className="text-xs uppercase font-bold opacity-60">{b.commune}</TableCell>
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
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{users?.length || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Commerces</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-primary">{businesses?.length || 0}</div></CardContent></Card>
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
              <Input value={userToEdit?.businessId || ''} onChange={e => setUserToEdit(p => p ? {...p, businessId: e.target.value} : null)} placeholder="Lier à un commerce" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveUser} disabled={isSavingUser} className="w-full h-12 font-black uppercase">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBusinessDialogOpen} onOpenChange={setIsBusinessDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase">Gérer le Commerce</DialogTitle>
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
            <AlertDialogDescription>Cette action supprimera uniquement le document profil de Firestore.</AlertDialogDescription>
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
