
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, Users, Crown, KeyRound, Copy, Trash2, AlertCircle, Mail, 
  Share2, Palette, Image as ImageIcon, Type, Eye, Save, Upload, Timer, 
  Fish, Plus, Pencil, DatabaseZap, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import Image from 'next/image';
import { lagoonFishData } from '@/lib/fish-data';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, isBefore, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

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
  const [isFishDialogOpen, setIsFishDialogOpen] = useState(false);
  const [fishDialogMode, setFishDialogMode] = useState<'add' | 'edit'>('add');
  const [currentFish, setCurrentFish] = useState<Partial<FishSpeciesInfo>>({});
  const [isSavingFish, setIsSavingFish] = useState(false);
  const [isInitializingFish, setIsInitializingFish] = useState(false);

  const isAdmin = useMemo(() => 
    user?.email === 'f.mallet81@outlook.com' || user?.email === 'f.mallet81@gmail.com', 
  [user]);

  const splashRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore, isAdmin]);
  const { data: savedSplashSettings, isLoading: isSplashLoading } = useDoc<SplashScreenSettings>(splashRef);

  // Fetch dynamic fish species from Firestore
  const fishSpeciesRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'fish_species'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: dbFishSpecies, isLoading: areFishLoading } = useCollection<FishSpeciesInfo>(fishSpeciesRef);

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

  const handleSaveFish = async () => {
    if (!firestore || !isAdmin || !currentFish.name || !currentFish.category) {
        toast({ variant: 'destructive', title: "Données manquantes", description: "Le nom et la catégorie sont obligatoires." });
        return;
    }
    setIsSavingFish(true);
    try {
        if (fishDialogMode === 'add') {
            await addDoc(collection(firestore, 'fish_species'), {
                ...currentFish,
                createdAt: serverTimestamp()
            });
            toast({ title: "Espèce ajoutée", description: `${currentFish.name} est maintenant dans le guide.` });
        } else {
            const fishRef = doc(firestore, 'fish_species', currentFish.id!);
            await updateDoc(fishRef, {
                ...currentFish,
                updatedAt: serverTimestamp()
            });
            toast({ title: "Espèce mise à jour" });
        }
        setIsFishDialogOpen(false);
        setCurrentFish({});
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de sauvegarder l'espèce." });
    } finally {
        setIsSavingFish(false);
    }
  };

  const handleDeleteFish = async (fishId: string) => {
    if (!firestore || !isAdmin) return;
    if (!confirm("Voulez-vous vraiment supprimer cette espèce du guide ?")) return;
    
    try {
        await deleteDoc(doc(firestore, 'fish_species', fishId));
        toast({ title: "Espèce supprimée" });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer l'espèce." });
    }
  };

  const handleInitializeFish = async () => {
    if (!firestore || !isAdmin || !lagoonFishData) return;
    setIsInitializingFish(true);
    try {
        const batch = writeBatch(firestore);
        lagoonFishData.forEach(fish => {
            const newDocRef = doc(collection(firestore, 'fish_species'));
            batch.set(newDocRef, {
                ...fish,
                createdAt: serverTimestamp()
            });
        });
        await batch.commit();
        toast({ title: "Base de données initialisée", description: `${lagoonFishData.length} espèces importées.` });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur d'import", description: "Impossible d'importer la liste par défaut." });
    } finally {
        setIsInitializingFish(false);
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
    setTimeout(() => setIsPreviewing(false), (splashDuration * 1000) + 1000);
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
      await setDoc(doc(firestore, 'access_tokens', code), {
        durationMonths: parseInt(tokenDuration, 10),
        createdAt: serverTimestamp(),
        status: 'active',
      });
      setGeneratedToken(code);
      toast({ title: "Jeton généré !" });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'access_tokens', tokenId));
      toast({ title: "Jeton supprimé" });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!firestore || !conversationId) return;
    try {
        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        const batch = writeBatch(firestore);
        messagesSnap.forEach(doc => batch.delete(doc.ref));
        batch.delete(doc(firestore, 'conversations', conversationId));
        await batch.commit();
        toast({ title: "Conversation supprimée" });
    } catch (error) {
        console.error(error);
    } finally {
        setConversationToDelete(null);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copié !" });
  };

  if (isUserLoading || !isAdmin) return <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-24 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isPreviewing && <SplashScreen settings={{ splashMode, splashText, splashTextColor, splashFontSize, splashBgColor, splashImageUrl, splashImageFit, splashDuration }} isExiting={false} />}

      <Card>
        <CardHeader><CardTitle>Tableau de Bord Administrateur</CardTitle></CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="design">Design & Splash</TabsTrigger>
          <TabsTrigger value="fish">Guide Poissons</TabsTrigger>
          <TabsTrigger value="access">Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalUsers || 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Abonnés Actifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.activeSubscribers || 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenu Mensuel</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats ? `${stats.monthlyRevenue.toLocaleString('fr-FR')} FCFP` : 0}</div></CardContent></Card>
          </div>
          
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Mail /> Messagerie</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Dernier Message</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {conversations?.map(convo => (
                      <TableRow key={convo.id} className={cn(!convo.isReadByAdmin && "bg-blue-50 dark:bg-blue-900/20")}>
                        <TableCell><span className="font-bold">{convo.userDisplayName}</span><br/><span className="text-xs text-muted-foreground">{convo.userEmail}</span></TableCell>
                        <TableCell className="max-w-xs truncate">{convo.lastMessageContent}</TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-2"><Button asChild variant="outline" size="sm"><Link href={`/admin/messages/${convo.userId}`}>Répondre</Link></Button><Button variant="ghost" size="icon" onClick={() => setConversationToDelete(convo.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                      </TableRow>
                    )) || <TableRow><TableCell colSpan={3} className="text-center">Aucun message.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          <Card>
            <CardHeader><CardTitle><Palette /> Splash Screen</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <RadioGroup value={splashMode} onValueChange={(val: any) => setSplashMode(val)} className="flex gap-4">
                <div className="flex items-center space-x-2 border p-4 rounded-lg flex-1"><RadioGroupItem value="text" id="r-text" /><Label htmlFor="r-text">Texte</Label></div>
                <div className="flex items-center space-x-2 border p-4 rounded-lg flex-1"><RadioGroupItem value="image" id="r-image" /><Label htmlFor="r-image">Image</Label></div>
              </RadioGroup>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <Label>Fond</Label><Input type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} />
                    <Label>Durée ({splashDuration}s)</Label><Slider value={[splashDuration]} min={1} max={10} step={0.5} onValueChange={v => setSplashDuration(v[0])} />
                </div>
                {splashMode === 'text' ? (
                  <div className="space-y-4"><Label>Texte</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} /><Label>Couleur</Label><Input type="color" value={splashTextColor} onChange={e => setSplashTextColor(e.target.value)} /></div>
                ) : (
                  <div className="space-y-4"><Label>Image (URL)</Label><Input value={splashImageUrl} onChange={e => setSplashImageUrl(e.target.value)} /><Label>Upload</Label><Input type="file" onChange={e => handleImageUpload(e, setSplashImageUrl)} /></div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6"><Button variant="outline" onClick={startPreview}><Eye className="mr-2"/> Aperçu</Button><Button onClick={handleSaveSplashSettings} disabled={isSavingSplash}><Save className="mr-2"/> Sauvegarder</Button></CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="fish" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><Fish /> Guide Poissons</CardTitle>
                <CardDescription>Gérez les espèces affichées dans l'application.</CardDescription>
              </div>
              <div className="flex gap-2">
                {(!dbFishSpecies || dbFishSpecies.length === 0) && (
                    <Button variant="outline" onClick={handleInitializeFish} disabled={isInitializingFish}>
                        <DatabaseZap className="mr-2 size-4" /> 
                        {isInitializingFish ? 'Import...' : 'Importer Défaut'}
                    </Button>
                )}
                <Button onClick={() => { setFishDialogMode('add'); setCurrentFish({ gratteRisk: 0, category: 'Lagon' }); setIsFishDialogOpen(true); }}>
                    <Plus className="mr-2 size-4" /> Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {areFishLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />) : dbFishSpecies?.map(fish => (
                  <Card key={fish.id} className="overflow-hidden border shadow-sm">
                    <div className="flex items-center p-4 gap-4">
                      <div className="relative size-20 rounded-lg overflow-hidden border bg-white shrink-0">
                        {fish.imageUrl || fish.imagePlaceholder ? (
                          <Image src={fish.imageUrl || `https://picsum.photos/seed/${fish.imagePlaceholder}/200/200`} alt={fish.name} fill className="object-contain p-1" sizes="80px" />
                        ) : <Fish className="size-8 m-auto text-muted-foreground" />}
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-black uppercase text-sm">{fish.name}</h4>
                        <p className="text-[10px] text-muted-foreground italic">{fish.scientificName}</p>
                        <Badge variant="outline" className="mt-1 text-[8px]">{fish.category}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setFishDialogMode('edit'); setCurrentFish(fish); setIsFishDialogOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteFish(fish.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Jetons d'Accès</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-end gap-4">
                <div className="flex-grow space-y-2"><Label>Durée (mois)</Label><Select value={tokenDuration} onValueChange={setTokenDuration}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="6">6</SelectItem><SelectItem value="12">12</SelectItem></SelectContent></Select></div>
                <Button onClick={handleGenerateToken} disabled={isGenerating}><KeyRound className="mr-2"/> Générer</Button>
              </div>
              <div className="border rounded-lg overflow-hidden"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{accessTokens?.map(t => <TableRow key={t.id}><TableCell className="font-mono text-xs">{t.id}</TableCell><TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteToken(t.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for Fish Create/Edit */}
      <Dialog open={isFishDialogOpen} onOpenChange={setIsFishDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{fishDialogMode === 'add' ? 'Ajouter une espèce' : 'Modifier l\'espèce'}</DialogTitle>
                <DialogDescription>Remplissez les informations techniques du poisson.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nom Commun</Label><Input value={currentFish.name || ''} onChange={e => setCurrentFish({...currentFish, name: e.target.value})} placeholder="Bec de cane..." /></div>
                    <div className="space-y-2"><Label>Nom Scientifique</Label><Input value={currentFish.scientificName || ''} onChange={e => setCurrentFish({...currentFish, scientificName: e.target.value})} placeholder="Lethrinus..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Catégorie</Label><Select value={currentFish.category} onValueChange={(v:any) => setCurrentFish({...currentFish, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lagon">Lagon</SelectItem><SelectItem value="Large">Large</SelectItem><SelectItem value="Recif">Récif</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Risque Gratte (%)</Label><Input type="number" value={currentFish.gratteRisk || 0} onChange={e => setCurrentFish({...currentFish, gratteRisk: parseInt(e.target.value)})} /></div>
                </div>
                <div className="space-y-2"><Label>Conseil Culinaire</Label><Textarea value={currentFish.culinaryAdvice || ''} onChange={e => setCurrentFish({...currentFish, culinaryAdvice: e.target.value})} /></div>
                <div className="space-y-2"><Label>Conseil de Pêche</Label><Textarea value={currentFish.fishingAdvice || ''} onChange={e => setCurrentFish({...currentFish, fishingAdvice: e.target.value})} /></div>
                <div className="space-y-2">
                    <Label>Photo (URL)</Label>
                    <div className="flex gap-2">
                        <Input value={currentFish.imageUrl || ''} onChange={e => setCurrentFish({...currentFish, imageUrl: e.target.value})} placeholder="https://..." />
                        <div className="relative">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(e, (b) => setCurrentFish({...currentFish, imageUrl: b}))} />
                            <Button variant="outline" size="icon"><Upload className="size-4"/></Button>
                        </div>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsFishDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSaveFish} disabled={isSavingFish}>{isSavingFish ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {generatedToken && (
        <AlertDialog open={!!generatedToken} onOpenChange={() => setGeneratedToken(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Jeton généré !</AlertDialogTitle><AlertDialogDescription>Copiez-le :</AlertDialogDescription></AlertDialogHeader>
            <div className="p-4 bg-muted rounded-md font-mono text-center text-lg">{generatedToken}</div>
            <AlertDialogFooter><AlertDialogCancel>Fermer</AlertDialogCancel><AlertDialogAction onClick={() => copyToClipboard(generatedToken)}>Copier</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
