'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, Crown, KeyRound, Copy, Trash2, AlertCircle, Mail, Share2, Palette, Image as ImageIcon, Type, Eye, Save, Upload, Timer, Fish } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import Image from 'next/image';
import { lagoonFishData } from '@/lib/fish-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, isBefore, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';

const SUBSCRIPTION_PRICE = 500;

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
  
  // Splash Screen States
  const [splashMode, setSplashMode] = useState<'text' | 'image'>('text');
  const [splashText, setSplashText] = useState('Lagon & Brousse NC');
  const [splashTextColor, setSplashTextColor] = useState('#ffffff');
  const [splashFontSize, setSplashFontSize] = useState('32');
  const [splashBgColor, setSplashBgColor] = useState('#3b82f6');
  const [splashImageUrl, setSplashImageUrl] = useState('');
  const [splashImageFit, setSplashImageFit] = useState<'cover' | 'contain'>('contain');
  const [splashDuration, setSplashDuration] = useState(3);
  const [isSavingSplash, setIsSavingSplash] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Fish Admin States
  const [isSavingFish, setIsSavingFish] = useState<string | null>(null);

  const isAdmin = useMemo(() => 
    user?.email === 'f.mallet81@outlook.com' || user?.email === 'f.mallet81@gmail.com', 
  [user]);

  const splashRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore, isAdmin]);
  const { data: savedSplashSettings, isLoading: isSplashLoading } = useDoc<SplashScreenSettings>(splashRef);

  // Fetch custom fish images
  const fishCustomRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'fish_customizations');
  }, [firestore, isAdmin]);
  const { data: fishCustomizations } = useCollection<{ imageUrl: string }>(fishCustomRef);

  useEffect(() => {
    if (savedSplashSettings) {
      setSplashMode(savedSplashSettings.splashMode || 'text');
      setSplashText(savedSplashSettings.splashText || 'Lagon & Brousse NC');
      setSplashTextColor(savedSplashSettings.splashTextColor || '#ffffff');
      setSplashFontSize(savedSplashSettings.splashFontSize || '32');
      setSplashBgColor(savedSplashSettings.splashBgColor || '#3b82f6');
      setSplashImageUrl(savedSplashSettings.splashImageUrl || '');
      setSplashImageFit(savedSplashSettings.splashImageFit || 'contain');
      setSplashDuration(savedSplashSettings.splashDuration || 3);
    }
  }, [savedSplashSettings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) {
      toast({ 
        variant: 'destructive', 
        title: "Image trop lourde", 
        description: "Veuillez choisir une image de moins de 800 Ko pour garantir un chargement rapide." 
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      callback(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFishImageUpload = (e: React.ChangeEvent<HTMLInputElement>, fishId: string) => {
    handleImageUpload(e, (base64) => {
        handleSaveFishImage(fishId, base64);
    });
  };

  const handleSaveFishImage = async (fishId: string, imageUrl: string) => {
    if (!firestore || !isAdmin) return;
    setIsSavingFish(fishId);
    try {
        await setDoc(doc(firestore, 'fish_customizations', fishId), { imageUrl }, { merge: true });
        toast({ title: "Photo mise à jour", description: "La nouvelle image est en ligne." });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de mettre à jour l'image." });
    } finally {
        setIsSavingFish(null);
    }
  };

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
    if (!firestore || !user) return null;
    return doc(firestore, 'shared_access_tokens', 'GLOBAL');
  }, [firestore, user]);
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

  const handleSaveSplashSettings = async () => {
    if (!firestore || !isAdmin) return;
    setIsSavingSplash(true);
    try {
      const settings: SplashScreenSettings = {
        splashMode,
        splashText,
        splashTextColor,
        splashFontSize,
        splashBgColor,
        splashImageUrl,
        splashImageFit,
        splashDuration
      };
      await setDoc(doc(firestore, 'app_settings', 'splash'), settings, { merge: true });
      toast({ title: "Configuration sauvegardée", description: "Le nouvel écran de démarrage est actif." });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de sauvegarder la configuration." });
    } finally {
      setIsSavingSplash(false);
    }
  };

  const startPreview = () => {
    setIsPreviewing(true);
    // Add 1 second for the fade out transition
    setTimeout(() => {
      setIsPreviewing(false);
    }, (splashDuration * 1000) + 1000);
  };

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
    if (!firestore || !conversationId) return;
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
        const usersToDelete = querySnapshot.docs.filter(doc => {
          const email = doc.data().email;
          return email !== 'f.mallet81@outlook.com' && email !== 'f.mallet81@gmail.com';
        });

        if (usersToDelete.length === 0) {
            toast({ title: "Aucun utilisateur à supprimer", description: "Seuls les comptes administrateurs ont été trouvés." });
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
    return allUsers.filter(u => u.email !== 'f.mallet81@outlook.com' && u.email !== 'f.mallet81@gmail.com').length;
  }, [allUsers]);


  const isLoading = isUserLoading || areUsersLoading || areTokensLoading || isSharedTokenLoading || isSplashLoading;

  if (isUserLoading || !isAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const currentPreviewSettings: SplashScreenSettings = {
    splashMode, splashText, splashTextColor, splashFontSize, splashBgColor, splashImageUrl, splashImageFit, splashDuration
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isPreviewing && <SplashScreen settings={currentPreviewSettings} isExiting={false} />}

      <Card>
        <CardHeader><CardTitle>Tableau de Bord Administrateur</CardTitle></CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="design">Design & Splash</TabsTrigger>
          <TabsTrigger value="fish">Guide Poissons</TabsTrigger>
          <TabsTrigger value="access">Jetons & Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                <div className="border rounded-lg overflow-x-auto">
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
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette /> Écran de démarrage (Splash Screen)</CardTitle>
              <CardDescription>Personnalisez l'écran affiché au lancement de l'application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <Label>Type d'affichage</Label>
                <RadioGroup value={splashMode} onValueChange={(val: any) => setSplashMode(val)} className="flex gap-4">
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="text" id="r-text" />
                    <Label htmlFor="r-text" className="flex items-center gap-2 cursor-pointer w-full"><Type className="size-4"/> Texte stylisé</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="image" id="r-image" />
                    <Label htmlFor="r-image" className="flex items-center gap-2 cursor-pointer w-full"><ImageIcon className="size-4"/> Image / Logo</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Couleurs & Fond</Label>
                    <div className="space-y-2">
                      <Label htmlFor="bg-color">Couleur de fond</Label>
                      <div className="flex gap-2">
                        <Input id="bg-color" type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} className="w-12 h-10 p-1" />
                        <Input value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} placeholder="#000000" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Timer className="size-4" /> Durée d'affichage
                    </Label>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span>Durée : {splashDuration} secondes</span>
                      </div>
                      <Slider 
                        value={[splashDuration]} 
                        min={1} 
                        max={10} 
                        step={0.5} 
                        onValueChange={(val) => setSplashDuration(val[0])} 
                      />
                      <p className="text-[10px] text-muted-foreground italic">Une durée trop longue peut frustrer les utilisateurs fréquents.</p>
                    </div>
                  </div>
                </div>

                {splashMode === 'text' ? (
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuration Texte</Label>
                    <div className="space-y-2">
                      <Label htmlFor="splash-text">Texte à afficher</Label>
                      <Input id="splash-text" value={splashText} onChange={e => setSplashText(e.target.value)} placeholder="Nom de l'app..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="text-color">Couleur texte</Label>
                        <Input id="text-color" type="color" value={splashTextColor} onChange={e => setSplashTextColor(e.target.value)} className="w-full h-10 p-1" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="font-size">Taille (px)</Label>
                        <Input id="font-size" type="number" value={splashFontSize} onChange={e => setSplashFontSize(e.target.value)} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuration Image</Label>
                    
                    <div className="space-y-2">
                      <Label>Charger depuis mes documents</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(e, setSplashImageUrl)} 
                          className="cursor-pointer text-xs"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">L'image sera stockée directement (Max 800Ko).</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="img-url">Ou URL de l'image</Label>
                      <Input id="img-url" value={splashImageUrl} onChange={e => setSplashImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Ajustement de l'image</Label>
                      <Select value={splashImageFit} onValueChange={(val: any) => setSplashImageFit(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contain">Contenir (Entier, pas de rognage)</SelectItem>
                          <SelectItem value="cover">Couvrir (Remplir, peut rogner)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <Button variant="outline" onClick={startPreview}>
                <Eye className="mr-2 size-4" /> Visualiser le démarrage
              </Button>
              <Button onClick={handleSaveSplashSettings} disabled={isSavingSplash}>
                {isSavingSplash ? 'Enregistrement...' : <><Save className="mr-2 size-4"/> Sauvegarder la config</>}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="fish" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Fish /> Gestion du Guide Poissons</CardTitle>
              <CardDescription>Mettez à jour les photos des espèces pour faciliter l'identification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {lagoonFishData.map(fish => {
                  const custom = fishCustomizations?.find(c => c.id === fish.id);
                  const placeholder = PlaceHolderImages.find(img => img.id === fish.imagePlaceholder);
                  const currentImage = custom?.imageUrl || placeholder?.imageUrl || '';

                  return (
                    <Card key={fish.id} className="overflow-hidden border shadow-sm">
                      <div className="flex flex-col sm:flex-row items-center p-4 gap-6">
                        <div className="relative size-32 rounded-xl overflow-hidden border bg-white shrink-0 shadow-inner">
                          {currentImage ? (
                            <Image 
                              src={currentImage} 
                              alt={fish.name} 
                              fill 
                              className="object-contain p-2" 
                              sizes="128px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground"><Fish className="size-10" /></div>
                          )}
                        </div>
                        
                        <div className="flex-grow space-y-4 w-full">
                          <div>
                            <h4 className="font-black uppercase tracking-tight text-lg leading-none">{fish.name}</h4>
                            <p className="text-xs text-muted-foreground italic mt-1">{fish.scientificName}</p>
                          </div>

                          <div className="grid gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-muted-foreground">Mettre à jour la photo</Label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-grow relative">
                                  <Input 
                                    placeholder="Coller l'URL de l'image ou charger un fichier..." 
                                    defaultValue={custom?.imageUrl || ''}
                                    onBlur={(e) => handleSaveFishImage(fish.id, e.target.value)}
                                    className="text-xs h-9"
                                  />
                                </div>
                                <div className="relative shrink-0">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={(e) => handleFishImageUpload(e, fish.id)}
                                  />
                                  <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" disabled={isSavingFish === fish.id}>
                                    <Upload className="size-4 mr-2" />
                                    {isSavingFish === fish.id ? 'Import...' : 'Fichier'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
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
                <div className="border rounded-lg overflow-x-auto">
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
              <CardDescription>Générez un jeton global pour donner accès à tous les utilisateurs.</CardDescription>
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
                      <p className="text-sm text-muted-foreground">ID du jeton: <span className="font-mono text-xs">{sharedToken.id}</span></p>
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
        </TabsContent>
      </Tabs>
      
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
                Supprime de manière permanente tous les comptes utilisateurs sauf ceux des administrateurs.
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
              Cette action supprimera définitivement tous les utilisateurs ({deletableUsersCount}) sauf vos comptes administrateurs. Cette action est irréversible.
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
            <AlertDialogAction onClick={() => { if (conversationToDelete) handleDeleteConversation(conversationToDelete); }} className={cn(buttonVariants({ variant: "destructive" }))}>
              Oui, supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
