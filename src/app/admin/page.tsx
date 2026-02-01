'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, Crown } from 'lucide-react';

const SUBSCRIPTION_PRICE = 500; // Default price in FCFP

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [newPrice, setNewPrice] = useState(SUBSCRIPTION_PRICE.toString());

  // Fetch all users for stats
  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserAccount>(usersCollectionRef);

  // Fetch stats for all users
  const [stats, setStats] = useState<{
    totalUsers: number;
    activeSubscribers: number;
    monthlyRevenue: number;
  } | null>(null);

  useEffect(() => {
    if (areUsersLoading || !allUsers) return;
    const totalUsers = allUsers.length;
    const activeSubscribers = allUsers.filter(u => u.subscriptionStatus === 'active').length;
    const monthlyRevenue = activeSubscribers * SUBSCRIPTION_PRICE;
    setStats({ totalUsers, activeSubscribers, monthlyRevenue });
  }, [allUsers, areUsersLoading]);

  // Route protection
  useEffect(() => {
    if (!isUserLoading && user?.email !== 'f.mallet@gmail.com') {
      router.push('/compte'); // Redirect non-admins
    }
  }, [user, isUserLoading, router]);

  const handlePriceUpdate = () => {
    // Price update logic...
  };

  const isLoading = isUserLoading || areUsersLoading;
  const isAdminUser = user?.email === 'f.mallet@gmail.com';

  if (isLoading || !isAdminUser) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle>Tableau de Bord Administrateur</CardTitle></CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Stats Cards */}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Utilisateurs</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.totalUsers ?? <Skeleton className="h-8 w-12" />}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Abonnés Actifs</CardTitle><Crown className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.activeSubscribers ?? <Skeleton className="h-8 w-12" />}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Revenu Mensuel</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats ? `${stats.monthlyRevenue.toLocaleString('fr-FR')} FCFP` : <Skeleton className="h-8 w-24" />}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestion de l'Abonnement</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
           <div className="flex-grow space-y-2">
                <Label htmlFor="price">Nouveau prix (FCFP)</Label>
                <Input id="price" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
          <Button onClick={handlePriceUpdate}>Mettre à jour le prix</Button>
        </CardContent>
      </Card>
    </div>
  );
}
