'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, Crown, KeyRound, Copy, Trash2, AlertCircle, Mail, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { format, isBefore, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SUBSCRIPTION_PRICE = 500; // Default price in FCFP

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [tokenDuration, setTokenDuration] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const [sharedTokenDuration, setSharedTokenDuration] = useState('1');
  const [isGeneratingShared, setIsGeneratingShared] = useState(false);
  const [isDeleteSharedAlertOpen, setIsDeleteSharedAlertOpen] = useState(false);

  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  
  const isAdmin = useMemo(() => user?.email === 'f.mallet81@outlook.com', [user]);

  // Fetch all users for stats
  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserAccount>(usersCollectionRef);

  // Fetch unique access tokens
  const tokensCollectionRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: accessTokens, isLoading: areTokensLoading } = useCollection<AccessToken>(tokensCollectionRef);

  // Fetch shared access token
  const sharedTokenRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'shared_access_tokens', 'GLOBAL');
  }, [firestore, isAdmin]);
  const { data: sharedToken, isLoading: isSharedTokenLoading } = useDoc<SharedAccessToken>(sharedTokenRef);

  // Fetch conversations
  const conversationsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: conversations, isLoading: areConversationsLoading } = useCollection<Conversation>(conversationsCollectionRef);

  const [stats, setStats] = useState<{ totalUsers: number; activeSubscribers: number; monthlyRevenue: number; } | null>(null);

  useEffect(() => {
    if (areUsersLoading || !allUsers) return;
    const totalUsers = allUsers.length;
    const activeSubscribers = allUsers.filter(u => u.subscriptionStatus === 'active' && u.subscriptionExpiryDate && isBefore(new Date(), new Date(u.subscriptionExpiryDate))).length;
    const monthlyRevenue = activeSubscribers * SUBSCRIPTION_PRICE;
    setStats({ totalUsers, activeSubscribers, monthlyRevenue });
  }, [allUsers, areUsersLoading]);

  useEffect(() => {
    if (!isUserLoading && !isAdmin) {
      router.push('/compte');
    }
  }, [isAdmin, isUserLoading, router]);

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

      const tokenDocRef = doc(firestore, 'access_tokens', code);
      await setDoc(tokenDocRef, {
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

  const handleGenerateSharedToken = async () => {
    if (!firestore) return;
    setIsGeneratingShared(true);
    try {
        const expiresAt = addMonths(new Date(), parseInt(sharedTokenDuration, 10));
        const sharedTokenDocRef = doc(firestore, 'shared_access_tokens', 'GLOBAL');
        await setDoc(sharedTokenDocRef, {
            durationMonths: parseInt(sharedTokenDuration, 10),
            createdAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
        });
        toast({ title: "Jeton partagé créé/mis à jour !", description: `Tous les utilisateurs ont maintenant accès jusqu'au ${format(expiresAt, 'P p', { locale: fr })}.` });
    } catch (error) {
        console.error("Error generating shared token:", error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de générer le jeton partagé." });
    } finally {
        setIsGeneratingShared(false);
    }
  };

  const handleDeleteSharedToken = async () => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'));
        toast({ title: "Jeton partagé supprimé", description: "L'accès global a été révoqué." });
    } catch (error) {
        console.error("Error deleting shared token:", error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer le jeton partagé." });
    } finally {
        setIsDeleteSharedAlertOpen(false);
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

  const handleDeleteConversation = async (conversationId: string) => {
    if (!firestore) return;
    try {
        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        const batch = writeBatch(firestore);
        messagesSnap.forEach(doc => batch.delete(doc.ref));
        const conversationRef = doc(firestore, 'conversations', conversationId);
        batch.delete(conversationRef);
        await batch.commit();
        toast({ title: "Conversation supprimée" });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer la conversation." });
    } finally {
        setConversationToDelete(null);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copié dans le presse-papiers !" });
  };
  
  const handleResetUsers = async () => {
    if (!firestore || !user || !isAdmin) return;
    try {
        const usersQuery = query(collection(firestore, 'users'));
        const querySnapshot = await getDocs(usersQuery);
        const usersToDelete = querySnapshot.docs.filter(doc => doc.data().email !== 'f.mallet81@outlook.com');

        if (usersToDelete.length === 0) {
            toast({ title: "Aucun utilisateur à supprimer", description: "Seul le compte administrateur a été trouvé." });
            setIsResetAlertOpen(false);
            return;
        }

        const BATCH_SIZE = 499;
        for (let i = 0; i < usersToDelete.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = usersToDelete.slice(i, i + BATCH_SIZE);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        toast({ title: "Utilisateurs réinitialisés", description: `${usersToDelete.length} utilisateurs ont été supprimés.` });
    } catch (error) {
        console.error("Error resetting users:", error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de réinitialiser les utilisateurs." });
    } finally {
        setIsResetAlertOpen(false);
    }
  };
  
  const deletableUsersCount = useMemo(() => {
    if (!allUsers) return '...';
    return allUsers.filter(u => u.email !== 'f.mallet81@outlook.com').length;
  }, [allUsers]);


  const isLoading = isUserLoading || areUsersLoading || areTokensLoading || isSharedTokenLoading;

  if (isUserLoading || !isAdmin) {
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
          <CardTitle className="flex items-center gap-2"><Mail /> Messagerie</CardTitle>
          <CardDescription>Consultez les messages des utilisateurs et répondez-y.</CardDescription>
        </CardHeader>
        <CardContent>
          {areConversationsLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Dernier Message</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations && conversations.length > 0 ? conversations.map(convo => (
                    <TableRow key={convo.id} className={cn(!convo.isReadByAdmin && "bg-blue-50 dark:bg-blue-900/20")}>
                      <TableCell><span className={cn(!convo.isReadByAdmin && "font-bold")}>{convo.userDisplayName}</span><br/><span className="text-xs font-normal text-muted-foreground">{convo.userEmail}</span></TableCell>
                      <TableCell className={cn("max-w-xs truncate", !convo.isReadByAdmin ? "font-bold" : "font-normal")}>{convo.lastMessageContent}</TableCell>
                      <TableCell className={cn("text-xs", !convo.isReadByAdmin ? "font-bold" : "font-normal")}>{convo.lastMessageAt ? format(convo.lastMessageAt.toDate(), 'P p', { locale: fr }) : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                             <Link href={`/admin/messages/${convo.userId}`}>Répondre</Link>
                          </Button>
                           <Button variant="ghost" size="icon" onClick={() => setConversationToDelete(convo.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center">Aucun message.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gestion des Jetons d'Accès Individuels</CardTitle>
          <CardDescription>Générez des jetons uniques pour donner un accès temporaire à un utilisateur.</CardDescription>
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
            <h4 className="font-medium">Jetons Individuels Existants</h4>
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
                  {accessTokens && accessTokens.length > 0 ? accessTokens.map(token => {
                    const redeemedUser = allUsers?.find(u => u.id === token.redeemedBy);
                    return (
                        <TableRow key={token.id}>
                        <TableCell className="font-mono text-xs">{token.id}</TableCell>
                        <TableCell>{token.durationMonths} mois</TableCell>
                        <TableCell><Badge variant={token.status === 'active' ? 'default' : 'secondary'}>{token.status}</Badge></TableCell>
                        <TableCell className="text-xs">{redeemedUser?.email || (token.redeemedBy ? 'Non trouvé' : 'N/A')}</TableCell>
                        <TableCell>{token.createdAt ? format(token.createdAt.toDate(), 'P p', { locale: fr }) : '-'}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteToken(token.id)}>
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={6} className="text-center">Aucun jeton individuel trouvé.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gestion du Jeton d'Accès Partagé</CardTitle>
          <CardDescription>Générez un jeton global pour donner accès à tous les utilisateurs pendant une période définie. Un nouveau jeton remplace l'ancien.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-grow space-y-2">
              <Label htmlFor="shared-duration">Durée de validité</Label>
              <Select value={sharedTokenDuration} onValueChange={setSharedTokenDuration}>
                <SelectTrigger id="shared-duration">
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
            <Button onClick={handleGenerateSharedToken} disabled={isGeneratingShared}>
              <Share2 className="mr-2 h-4 w-4" />
              {isGeneratingShared ? 'Génération...' : "Générer / Remplacer"}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Jeton Partagé Actif</h4>
            {isSharedTokenLoading ? <Skeleton className="h-20 w-full" /> : sharedToken ? (
              <div className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="font-semibold">Accès global actif</p>
                  <p className="text-sm text-muted-foreground">Expire le: <span className="font-bold">{format(sharedToken.expiresAt.toDate(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span></p>
                  <p className="text-xs text-muted-foreground">Durée: {sharedToken.durationMonths} mois</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setIsDeleteSharedAlertOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun jeton partagé actif.</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-destructive">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><AlertCircle /> Zone de Danger</CardTitle>
            <CardDescription>Cette action est irréversible et doit être utilisée avec une extrême prudence.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="destructive" onClick={() => setIsResetAlertOpen(true)}>
                Réinitialiser les utilisateurs
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
                Supprime de manière permanente tous les comptes utilisateurs sauf celui de l'administrateur.
            </p>
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
              <AlertDialogCancel>Fermer</AlertDialogCancel>
              <AlertDialogAction onClick={() => copyToClipboard(generatedToken)}><Copy className="mr-2"/> Copier</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement tous les utilisateurs ({deletableUsersCount}) sauf votre compte administrateur. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetUsers} className={cn(buttonVariants({ variant: "destructive" }))}>
                  Oui, supprimer les utilisateurs
              </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteSharedAlertOpen} onOpenChange={setIsDeleteSharedAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le Jeton Partagé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action révoquera l'accès global pour tous les utilisateurs. Ils reviendront à leur statut d'abonnement individuel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSharedToken} className={cn(buttonVariants({ variant: "destructive" }))}>
              Oui, supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!conversationToDelete} onOpenChange={() => setConversationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La conversation et tous ses messages seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteConversation(conversationToDelete!)} className={cn(buttonVariants({ variant: "destructive" }))}>
              Oui, supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
