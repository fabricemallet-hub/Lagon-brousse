'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, doc, documentId } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Users, Crown, AlertTriangle, Waves, Loader } from 'lucide-react';
import { updateTideArchive } from '@/lib/tide-api';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const SUBSCRIPTION_PRICE = 500; // Default price in FCFP

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [newPrice, setNewPrice] = useState(SUBSCRIPTION_PRICE.toString());
  const [archiveEndDate, setArchiveEndDate] = useState<string | null>(null);
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);

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

  // Fetch tide archive status
  const checkArchive = useCallback(async () => {
    if (!firestore) return;
    setIsArchiveLoading(true);
    try {
      const querySnapshot = await getDocs(collection(firestore, 'stations/Nouméa/tides'));
      if (!querySnapshot.empty) {
        // Sort documents by ID (date string 'YYYY-MM-DD') descending on the client
        const sortedDocs = querySnapshot.docs.sort((a, b) => b.id.localeCompare(a.id));
        const lastDoc = sortedDocs[0];
        const [year, month, day] = lastDoc.id.split('-').map(Number);
        // Use Date.UTC to correctly handle the date string regardless of client timezone
        const lastDate = new Date(Date.UTC(year, month - 1, day));
        setArchiveEndDate(format(lastDate, 'dd MMMM yyyy', { locale: fr }));
      } else {
        setArchiveEndDate(null);
      }
    } catch (error) {
      console.error("Failed to check tide archive:", error);
      setArchiveEndDate('Erreur');
    } finally {
      setIsArchiveLoading(false);
    }
  }, [firestore]);
  
  useEffect(() => {
    checkArchive();
  }, [checkArchive]);

  // Route protection
  useEffect(() => {
    if (!isUserLoading && user?.email !== 'f.mallet@gmail.com') {
      router.push('/compte'); // Redirect non-admins
    }
  }, [user, isUserLoading, router]);

  const handlePriceUpdate = () => {
    // Price update logic...
  };

  const handleArchiveUpdate = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Firestore non disponible.' });
      return;
    }
    setIsUpdatingArchive(true);
    toast({ title: 'Mise à jour lancée', description: "Récupération des données de marées pour 7 jours. Cela peut prendre quelques minutes." });
    try {
      await updateTideArchive(firestore);
      toast({ title: 'Succès', description: "L'archive des marées a été mise à jour." });
      await checkArchive(); // Re-run the check
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erreur de mise à jour', description: error.message || 'Une erreur inconnue est survenue.' });
    } finally {
      setIsUpdatingArchive(false);
    }
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
          <CardTitle className="flex items-center gap-2"><Waves /> Gestion des Marées</CardTitle>
          <CardDescription>
            {isArchiveLoading ? <Skeleton className="h-5 w-64 mt-1" /> : 
              archiveEndDate ? `Données de marées disponibles jusqu'au ${archiveEndDate}.` : <span className="text-destructive font-semibold flex items-center gap-2"><AlertTriangle className="size-4" /> Aucune donnée de marée archivée.</span>
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleArchiveUpdate} disabled={isUpdatingArchive}>
            {isUpdatingArchive && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            {isUpdatingArchive ? 'Mise à jour en cours...' : 'Forcer la mise à jour hebdomadaire'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Lance une récupération des données de marées pour les 7 prochains jours. À n'utiliser qu'une fois par semaine si nécessaire.
          </p>
        </CardContent>
      </Card>

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
