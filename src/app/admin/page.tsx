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
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Users, Crown } from 'lucide-react';

const SUBSCRIPTION_PRICE = 500; // Default price in FCFP

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [newPrice, setNewPrice] = useState(SUBSCRIPTION_PRICE.toString());

  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserAccount>(usersCollectionRef);

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

  // Route protection: Rely on the auth user's email, which is faster and more reliable than the Firestore document.
  useEffect(() => {
    if (!isUserLoading && user?.email !== 'f.mallet@gmail.com') {
      router.push('/compte'); // Redirect non-admins
    }
  }, [user, isUserLoading, router]);

  const handlePriceUpdate = () => {
    const priceValue = parseInt(newPrice, 10);
    if (isNaN(priceValue) || priceValue < 0) {
        toast({
            variant: 'destructive',
            title: 'Prix invalide',
            description: 'Veuillez entrer un nombre positif.',
        });
        return;
    }
    // In a real app, you would save this to a configuration document in Firestore.
    // For now, we just show a confirmation.
    toast({
        title: 'Prix mis à jour (simulation)',
        description: `Le nouveau prix de l'abonnement est de ${priceValue} FCFP.`,
    });
  };

  const isLoading = isUserLoading || areUsersLoading;
  const isAdminUser = user?.email === 'f.mallet@gmail.com';

  // Show a loading skeleton while data is fetching or if the user is not an admin.
  // The useEffect above will handle the redirection for non-admins.
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
        <CardHeader>
          <CardTitle>Tableau de Bord Administrateur</CardTitle>
          <CardDescription>Gérez les utilisateurs et consultez les statistiques de l'application.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs Inscrits</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers ?? <Skeleton className="h-8 w-12" />}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abonnés Actifs</CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats?.activeSubscribers ?? <Skeleton className="h-8 w-12" />}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenu Mensuel (Est.)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {stats ? `${stats.monthlyRevenue.toLocaleString('fr-FR')} FCFP` : <Skeleton className="h-8 w-24" />}
                </div>
            </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Gestion de l'Abonnement</CardTitle>
          <CardDescription>
            Modifier le prix de l'abonnement mensuel pour les nouveaux utilisateurs. Le prix actuel est de {SUBSCRIPTION_PRICE} FCFP.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-end gap-4">
           <div className="w-full sm:w-auto flex-grow space-y-2">
                <Label htmlFor="price">Nouveau prix (FCFP)</Label>
                <Input
                    id="price"
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="e.g., 500"
                />
            </div>
          <Button onClick={handlePriceUpdate}>Mettre à jour le prix</Button>
        </CardContent>
      </Card>
    </div>
  );
}
