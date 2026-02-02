'use client';

import { useState, useEffect, Fragment } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query } from 'firebase/firestore';
import type { UserAccount, AccessToken } from '@/lib/types';
import { WithId } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, Crown, KeyRound, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SUBSCRIPTION_PRICE = 500; // Default price in FCFP

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [newPrice, setNewPrice] = useState(SUBSCRIPTION_PRICE.toString());
  const [tokenDuration, setTokenDuration] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Fetch all users for stats
  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserAccount>(usersCollectionRef);

  // Fetch access tokens
  const tokensCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  const { data: accessTokens, isLoading: areTokensLoading } = useCollection<AccessToken>(tokensCollectionRef);

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

  const handleGenerateToken = async () => {
    if (!firestore) return;
    setIsGenerating(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = 'LBN-';
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await addDoc(collection(firestore, 'access_tokens'), {
        durationMonths: parseInt(tokenDuration, 10),
        createdAt: serverTimestamp(),
        status: 'active',
      });
      
      setGeneratedToken(code);
      toast({ title: "Jeton généré avec succès !", description: `Le jeton ${code} a été créé.` });
    } catch (error) {
      console.error("Error generating token:", error);
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de générer le jeton." });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleDeleteToken = async (tokenId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'access_tokens', tokenId));
      toast({ title: "Jeton supprimé", description: "Le jeton a été retiré de la liste." });
    } catch (error) {
      console.error("Error deleting token:", error);
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer le jeton." });
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copié dans le presse-papiers !" });
  };


  const isLoading = isUserLoading || areUsersLoading || areTokensLoading;
  const isAdminUser = user?.email === 'f.mallet@gmail.com';

  if (!isAdminUser) {
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
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Utilisateurs</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats ? stats.totalUsers : <Skeleton className="h-8 w-12" />}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Abonnés Actifs</CardTitle><Crown className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats ? stats.activeSubscribers : <Skeleton className="h-8 w-12" />}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Revenu Mensuel</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats ? `${stats.monthlyRevenue.toLocaleString('fr-FR')} FCFP` : <Skeleton className="h-8 w-24" />}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestion des Jetons d'Accès</CardTitle>
          <CardDescription>Générez des jetons pour donner un accès temporaire à l'application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-grow space-y-2">
              <Label htmlFor="duration">Durée de validité</Label>
              <Select value={tokenDuration} onValueChange={setTokenDuration}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Choisir une durée" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Mois</SelectItem>
                  <SelectItem value="3">3 Mois</SelectItem>
                  <SelectItem value="6">6 Mois</SelectItem>
                  <SelectItem value="12">12 Mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateToken} disabled={isGenerating}>
              <KeyRound className="mr-2 h-4 w-4" />
              {isGenerating ? 'Génération...' : 'Générer un jeton'}
            </Button>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Jetons Existants</h4>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jeton (ID)</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Utilisé par</TableHead>
                    <TableHead>Crée le</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessTokens && accessTokens.length > 0 ? accessTokens.map(token => (
                    <TableRow key={token.id}>
                      <TableCell className="font-mono text-xs">{token.id}</TableCell>
                      <TableCell>{token.durationMonths} mois</TableCell>
                      <TableCell><Badge variant={token.status === 'active' ? 'default' : 'secondary'}>{token.status}</Badge></TableCell>
                      <TableCell className="text-xs">{token.redeemedBy || 'N/A'}</TableCell>
                      <TableCell>{token.createdAt ? format(token.createdAt.toDate(), 'P p', { locale: fr }) : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteToken(token.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="text-center">Aucun jeton trouvé.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {generatedToken && (
        <AlertDialog open={!!generatedToken} onOpenChange={() => setGeneratedToken(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Jeton généré avec succès !</AlertDialogTitle>
              <AlertDialogDescription>Copiez ce jeton et partagez-le. Il ne sera plus affiché.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="p-4 bg-muted rounded-md font-mono text-center text-lg my-4">{generatedToken}</div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setGeneratedToken(null)}>Fermer</Button>
              <AlertDialogAction onClick={() => copyToClipboard(generatedToken)}><Copy className="mr-2"/> Copier</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
