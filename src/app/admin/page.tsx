'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { UserAccount, Business, FishSpeciesInfo, AccessToken, Conversation } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { MessageSquare, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('stats');

  // DÉTECTION ADMIN MAÎTRE (UID ET EMAIL)
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterAdminUids = [
      't8nPnZLcTiaLJSKMuLzib3C5nPn1', 
      'ipupi3Pg4RfrSEpFyT69BtlCdpi2', 
      'Irglq69MasYdNwBmUu8yKvw6h4G2', 
      'K9cVYLVUk1NV99YV3anebkugpPp1'
    ];
    const masterEmails = ['f.mallet81@outlook.com', 'fabrice.mallet@gmail.com', 'f.mallet81@gmail.com'];
    
    return masterAdminUids.includes(user.uid) || 
           (user.email && masterEmails.includes(user.email.toLowerCase()));
  }, [user]);

  // REQUÊTES FIRESTORE (Seulement si isAdmin est confirmé)
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

  const convsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    // On trie par date pour avoir les conversations les plus récentes en haut
    return query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: conversations } = useCollection<Conversation>(convsRef);

  useEffect(() => {
    if (!isUserLoading && !isAdmin) {
      router.push('/compte');
    }
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;
  if (!isAdmin) return null;

  const activeSubs = users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin').length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader className="py-6">
          <CardTitle className="font-black uppercase tracking-tighter text-2xl text-slate-800">
            Console Administrateur
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto bg-muted/50 border rounded-xl p-1">
          <TabsTrigger value="stats" className="text-[10px] font-black uppercase py-3">Statistiques</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase py-3">Utilisateurs</TabsTrigger>
          <TabsTrigger value="commerces" className="text-[10px] font-black uppercase py-3">Commerces</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Inscrits</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black">{users?.length || 0}</div></CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Abonnés</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-primary">{activeSubs}</div></CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Commerces</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black">{businesses?.length || 0}</div></CardContent>
            </Card>
          </div>

          <Card className="border-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" /> Support & Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px] font-black uppercase">Utilisateur</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Message</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
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
                      <TableCell className="text-xs italic truncate max-w-[150px] opacity-70">
                        {conv.lastMessageContent}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase">
                          <Link href={`/admin/messages/${conv.id}`}>Répondre</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!conversations || conversations.length === 0) && (
                    <TableRow><TableCell colSpan={3} className="text-center py-10 text-xs italic opacity-40">Aucun message</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}