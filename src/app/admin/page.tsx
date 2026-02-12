'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { UserAccount, Business, FishSpeciesInfo, AccessToken, Conversation } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { MessageSquare, TrendingUp, ShieldCheck, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('stats');

  // DÉTECTION ADMIN MAÎTRE (UID ET EMAIL) - PRIORITÉ ABSOLUE
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com'];
    const masterAdminUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'K9cVYLVUk1NV99YV3anebkugpPp1', 'ipupi3Pg4RfrSEpFyT69BtlCdpi2'];
    
    return (user.email && masterAdminEmails.includes(user.email.toLowerCase())) || 
           masterAdminUids.includes(user.uid);
  }, [user]);

  // REQUÊTES FIRESTORE (Seulement si isAdmin est confirmé)
  const usersRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'users'), orderBy('email', 'asc'));
  }, [firestore, isAdmin]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserAccount>(usersRef);

  const businessRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'businesses'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: businesses } = useCollection<Business>(businessRef);

  const convsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: conversations, isLoading: isConvsLoading } = useCollection<Conversation>(convsRef);

  useEffect(() => {
    if (!isUserLoading && !isAdmin) {
      router.push('/compte');
    }
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading) return <div className="p-8"><Skeleton className="h-48 w-full rounded-2xl" /></div>;
  if (!isAdmin) return null;

  const activeSubs = users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-xl bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
            <ShieldCheck className="size-48" />
        </div>
        <CardHeader className="py-8 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-3xl flex items-center gap-3">
            Console Administrateur
          </CardTitle>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Accès Maître : {user?.email}</p>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto bg-muted/50 border-2 rounded-2xl p-1.5 shadow-sm">
          <TabsTrigger value="stats" className="text-[10px] font-black uppercase py-3 rounded-xl data-[state=active]:shadow-md">Statistiques</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase py-3 rounded-xl data-[state=active]:shadow-md">Utilisateurs</TabsTrigger>
          <TabsTrigger value="commerces" className="text-[10px] font-black uppercase py-3 rounded-xl data-[state=active]:shadow-md">Commerces</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Utilisateurs</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black">{isUsersLoading ? <RefreshCw className="size-6 animate-spin" /> : users?.length || 0}</div></CardContent>
            </Card>
            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Abonnés</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-primary">{activeSubs}</div></CardContent>
            </Card>
            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Commerces Pro</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-accent">{businesses?.length || 0}</div></CardContent>
            </Card>
          </div>

          <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" /> Support & Messages Clients
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isConvsLoading ? (
                <div className="p-8 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[10px] font-black uppercase h-10 px-4">Utilisateur</TableHead>
                      <TableHead className="text-[10px] font-black uppercase h-10">Dernier Message</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase h-10 px-4">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations?.map(conv => (
                      <TableRow key={conv.id} className={cn(!conv.isReadByAdmin && "bg-primary/5")}>
                        <TableCell className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-black text-xs text-slate-800">{conv.userDisplayName || 'Inconnu'}</span>
                            <span className="text-[9px] font-bold opacity-50 lowercase">{conv.userEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs italic truncate max-w-[150px] opacity-70">
                          "{conv.lastMessageContent}"
                        </TableCell>
                        <TableCell className="text-right px-4">
                          <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase border-2 shadow-sm hover:bg-primary hover:text-white transition-colors">
                            <Link href={`/admin/messages/${conv.id}`}>Répondre</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!conversations || conversations.length === 0) && (
                      <TableRow><TableCell colSpan={3} className="text-center py-16 text-xs italic opacity-40 font-bold uppercase tracking-widest">Aucun message pour le moment</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}