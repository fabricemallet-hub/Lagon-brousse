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

  // Détection Admin Maître instantanée par UID
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminUids = [
      't8nPnZLcTiaLJSKMuLzib3C5nPn1', 
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2', 
      'Irglq69MasYdNwBmUu8yKvw6h4G2', 
      'K9cVYLVUk1NV99YV3anebkugpPp1'
    ];
    return masterAdminUids.includes(user.uid);
  }, [user]);

  // Requêtes Firestore simplifiées pour correspondre aux nouvelles règles
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

  const tokensRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: tokens } = useCollection<AccessToken>(tokensRef);

  const fishRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'fish_species'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: fishSpecies } = useCollection<FishSpeciesInfo>(fishRef);

  const convsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    // Requête directe sans filtre complexe pour valider la règle list racine
    return query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: conversations } = useCollection<Conversation>(convsRef);

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
                <MessageSquare className="size-5 text-primary" /> Messagerie Admin
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
                        <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase">
                          <Link href={`/admin/messages/${conv.id}`}>Répondre</Link>
                        </Button>
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
      </Tabs>
    </div>
  );
}