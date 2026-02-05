
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo, SoundLibraryEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, Users, Crown, KeyRound, Trash2, Mail, 
  Palette, Save, Upload, 
  Fish, Plus, Minus, Pencil, DatabaseZap, Sparkles, UserX,
  Eye, Music, Volume2, Play, Download
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
import { format, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SUBSCRIPTION_PRICE = 500;

const defaultSounds: Omit<SoundLibraryEntry, 'id'>[] = [
  { label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', categories: ['General', 'Vessel'] },
  { label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3', categories: ['General', 'Vessel', 'Hunting'] },
  { label: 'Fanfare Trompette', url: 'https://assets.mixkit.co/active_storage/sfx/2700/2700-preview.mp3', categories: ['General', 'Hunting'] },
  { label: 'Cor de chasse', url: 'https://assets.mixkit.co/active_storage/sfx/2701/2701-preview.mp3', categories: ['Hunting'] },
  { label: 'Sifflet Arbitre', url: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3', categories: ['General'] },
  { label: 'Bip Digital', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', categories: ['General'] },
  { label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3', categories: ['General', 'Vessel'] },
];

const SOUND_CATEGORIES = [
  { id: 'General', label: 'Général' },
  { id: 'Vessel', label: 'Mer / Vessel' },
  { id: 'Hunting', label: 'Chasse' },
];

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [tokenDuration, setTokenDuration] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [fishToDelete, setFishToDelete] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [soundToDelete, setSoundToDelete] = useState<string | null>(null);
  
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isUserEditDialogOpen, setIsUserEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('inactive');
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState(false);

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

  const [isFishDialogOpen, setIsFishDialogOpen] = useState(false);
  const [fishDialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [currentFish, setCurrentFish] = useState<Partial<FishSpeciesInfo>>({});
  const [isSavingFish, setIsSavingFish] = useState(false);
  const [isInitializingFish, setIsInitializingFish] = useState(false);
  const [isAiGeneratingFish, setIsAiGeneratingFish] = useState(false);

  const [isSoundDialogOpen, setIsSoundDialogOpen] = useState(false);
  const [soundDialogMode, setSoundDialogMode] = useState<'add' | 'edit'>('add');
  const [currentSound, setCurrentSound] = useState<Partial<SoundLibraryEntry>>({});
  const [isSavingSound, setIsSavingSound] = useState(false);
  const [isInitializingSounds, setIsInitializingSounds] = useState(false);

  const [globalDuration, setGlobalDuration] = useState('7');

  const isAdmin = useMemo(() => 
    user?.email === 'f.mallet81@outlook.com' || user?.email === 'f.mallet81@gmail.com', 
  [user]);

  const splashRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore, isAdmin]);
  const { data: savedSplashSettings } = useDoc<SplashScreenSettings>(splashRef);

  const fishSpeciesRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'fish_species'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: dbFishSpecies, isLoading: areFishLoading } = useCollection<FishSpeciesInfo>(fishSpeciesRef);

  const soundsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore, isAdmin]);
  const { data: dbSounds, isLoading: areSoundsLoading } = useCollection<SoundLibraryEntry>(soundsRef);

  const sharedTokenRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'shared_access_tokens', 'GLOBAL');
  }, [firestore, isAdmin]);
  const { data: sharedToken } = useDoc<SharedAccessToken>(sharedTokenRef);

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
      toast({ variant: 'destructive', title: "Image trop lourde", description: "Veuillez choisir une image de moins de 800 Ko." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      callback(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      toast({ variant: 'destructive', title: "Fichier trop lourd", description: "Le MP3 doit faire moins de 500 Ko." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      callback(base64);
      toast({ title: "Son chargé" });
    };
    reader.readAsDataURL(file);
  };

  const handleAiFillFish = async () => {
    if (!currentFish.name) return;
    setIsAiGeneratingFish(true);
    try {
        const info = await generateFishInfo({ name: currentFish.name });
        setCurrentFish(prev => ({
            ...prev,
            scientificName: info.scientificName,
            gratteRisk: info.gratteRisk,
            culinaryAdvice: info.culinaryAdvice,
            fishingAdvice: info.fishingAdvice,
            category: info.category
        }));
        toast({ title: "Fiche générée par l'IA" });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur IA" });
    } finally {
        setIsAiGeneratingFish(false);
    }
  };

  const handleSaveFish = async () => {
    if (!firestore || !isAdmin || !currentFish.name || !currentFish.category) return;
    setIsSavingFish(true);
    try {
        if (fishDialogMode === 'add') {
            await addDoc(collection(firestore, 'fish_species'), { ...currentFish, createdAt: serverTimestamp() });
            toast({ title: "Espèce ajoutée" });
        } else {
            const fishRef = doc(firestore, 'fish_species', currentFish.id!);
            await updateDoc(fishRef, { ...currentFish, updatedAt: serverTimestamp() });
            toast({ title: "Espèce mise à jour" });
        }
        setIsFishDialogOpen(false);
        setCurrentFish({});
    } catch (error) {
        console.error(error);
    } finally {
        setIsSavingFish(false);
    }
  };

  const handleDeleteFishConfirmed = async () => {
    if (!firestore || !isAdmin || !fishToDelete) return;
    try {
        await deleteDoc(doc(firestore, 'fish_species', fishToDelete));
        toast({ title: "Espèce supprimée" });
    } catch (error) {
        console.error(error);
    } finally {
        setFishToDelete(null);
    }
  };

  const handleSaveSound = async () => {
    if (!firestore || !isAdmin || !currentSound.label || !currentSound.url) return;
    setIsSavingSound(true);
    try {
        if (soundDialogMode === 'add') {
            await addDoc(collection(firestore, 'sound_library'), { ...currentSound, createdAt: serverTimestamp() });
            toast({ title: "Son ajouté" });
        } else {
            const soundRef = doc(firestore, 'sound_library', currentSound.id!);
            await updateDoc(soundRef, { ...currentSound, updatedAt: serverTimestamp() });
            toast({ title: "Son mis à jour" });
        }
        setIsSoundDialogOpen(false);
        setCurrentSound({});
    } catch (error) {
        console.error(error);
    } finally {
        setIsSavingSound(false);
    }
  };

  const handleDeleteSoundConfirmed = async () => {
    if (!firestore || !isAdmin || !soundToDelete) return;
    try {
        await deleteDoc(doc(firestore, 'sound_library', soundToDelete));
        toast({ title: "Son supprimé" });
    } catch (error) {
        console.error(error);
    } finally {
        setSoundToDelete(null);
    }
  };

  const handleInitializeSounds = async () => {
    if (!firestore || !isAdmin) return;
    setIsInitializingSounds(true);
    try {
        const batch = writeBatch(firestore);
        defaultSounds.forEach(sound => {
            const soundId = sound.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '-');
            const docRef = doc(firestore, 'sound_library', soundId);
            batch.set(docRef, { ...sound, createdAt: serverTimestamp() });
        });
        await batch.commit();
        toast({ title: "Sons importés" });
    } catch (error) {
        console.error(error);
    } finally {
        setIsInitializingSounds(false);
    }
  };

  const playPreview = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(() => toast({ variant: 'destructive', title: 'Erreur lecture' }));
  };

  const downloadFile = async (url: string, label: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${label.toLowerCase().replace(/\s/g, '-')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  const handleEditUser = (u: UserAccount) => {
    setUserToEdit(u);
    setEditStatus(u.subscriptionStatus);
    setEditExpiryDate(u.subscriptionExpiryDate ? u.subscriptionExpiryDate.split('T')[0] : '');
    setIsUserEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!firestore || !userToEdit) return;
    setIsSavingUser(true);
    try {
        const userRef = doc(firestore, 'users', userToEdit.id);
        await updateDoc(userRef, {
            subscriptionStatus: editStatus as any,
            subscriptionExpiryDate: editExpiryDate ? new Date(editExpiryDate).toISOString() : undefined
        });
        toast({ title: "Profil mis à jour" });
        setIsUserEditOpen(false);
    } catch (error) {
        console.error(error);
    } finally {
        setIsSavingUser(false);
    }
  };

  const handleDeleteUserConfirmed = async () => {
    if (!firestore || !isAdmin || !userToDelete) return;
    if (userToDelete.id === user?.uid) return;
    try {
        await deleteDoc(doc(firestore, 'users', userToDelete.id));
        toast({ title: "Compte supprimé" });
    } catch (error) {
        console.error(error);
    } finally {
        setUserToDelete(null);
    }
  };

  const handleInitializeFish = async () => {
    if (!firestore || !isAdmin) return;
    setIsInitializingFish(true);
    try {
        const batch = writeBatch(firestore);
        lagoonFishData.forEach(fish => {
            const fishId = fish.id || fish.name.toLowerCase().replace(/\s/g, '-');
            batch.set(doc(firestore, 'fish_species', fishId), { ...fish, id: fishId, createdAt: serverTimestamp() });
        });
        await batch.commit();
        toast({ title: "Base de données initialisée" });
    } catch (error) {
        console.error(error);
    } finally {
        setIsInitializingFish(false);
    }
  };

  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserAccount>(usersCollectionRef);

  const tokensCollectionRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: accessTokens } = useCollection<AccessToken>(tokensCollectionRef);

  const conversationsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: conversations } = useCollection<Conversation>(conversationsCollectionRef);

  const stats = useMemo(() => {
    if (!allUsers) return null;
    const active = allUsers.filter(u => u.subscriptionStatus === 'active' && u.subscriptionExpiryDate && isBefore(new Date(), new Date(u.subscriptionExpiryDate))).length;
    return { total: allUsers.length, active, revenue: active * SUBSCRIPTION_PRICE };
  }, [allUsers]);

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  const handleSaveSplashSettings = async () => {
    if (!firestore || !isAdmin) return;
    setIsSavingSplash(true);
    try {
      await setDoc(doc(firestore, 'app_settings', 'splash'), { splashMode, splashText, splashTextColor, splashFontSize, splashBgColor, splashImageUrl, splashImageFit, splashDuration }, { merge: true });
      toast({ title: "Configuration sauvegardée" });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingSplash(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!firestore) return;
    setIsGenerating(true);
    try {
      const code = `LBN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await setDoc(doc(firestore, 'access_tokens', code), { durationMonths: parseInt(tokenDuration, 10), createdAt: serverTimestamp(), status: 'active' });
      setGeneratedToken(code);
      toast({ title: "Jeton généré" });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateSharedToken = async (daysCount: number) => {
    if (!firestore || !isAdmin) return;
    try {
      await setDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'), { durationMonths: 0, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(addDays(new Date(), daysCount)) });
      toast({ title: "Accès global activé" });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDisableSharedToken = async () => {
    if (!firestore || !isAdmin) return;
    try {
      await deleteDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'));
      toast({ title: "Accès global désactivé" });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!firestore) return;
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

  const handleToggleCategory = (catId: string) => {
    const current = currentSound.categories || [];
    const next = current.includes(catId) ? current.filter(c => c !== catId) : [...current, catId];
    setCurrentSound({ ...currentSound, categories: next });
  };

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {isPreviewing && <SplashScreen settings={{ splashMode, splashText, splashTextColor, splashFontSize, splashBgColor, splashImageUrl, splashImageFit, splashDuration }} isExiting={false} />}

      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-6 h-auto p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview">Stats</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="fish">Fish</TabsTrigger>
          <TabsTrigger value="sounds">Sons</TabsTrigger>
          <TabsTrigger value="access">Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{stats?.total || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Premium Actifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{stats?.active || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Revenu Est.</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{stats?.revenue.toLocaleString('fr-FR')} F</div></CardContent></Card>
          </div>
          
          <Card className="border-2">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><Mail className="size-4" /> Messagerie</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow className="bg-muted/30"><TableHead>Utilisateur</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {conversations?.map(convo => (
                    <TableRow key={convo.id} className={cn(!convo.isReadByAdmin && "bg-primary/5")}>
                      <TableCell><span className="font-bold text-xs">{convo.userDisplayName}</span></TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">{convo.lastMessageContent}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase"><Link href={`/admin/messages/${convo.userId}`}>Répondre</Link></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConversationToDelete(convo.id)}><Trash2 className="size-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><Users className="size-4" /> Liste des Utilisateurs</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow className="bg-muted/30"><TableHead>Nom / Email</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {allUsers?.map(u => (
                    <TableRow key={u.id}>
                      <TableCell><span className="font-bold text-xs">{u.displayName}</span><br/><span className="text-[9px] opacity-60">{u.email}</span></TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase">{u.subscriptionStatus}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditUser(u)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={u.id === user?.uid} onClick={() => setUserToDelete(u)}><UserX className="size-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="font-black uppercase text-sm">Splash Screen</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={splashMode} onValueChange={(val: any) => setSplashMode(val)} className="flex gap-4">
                <div className="flex items-center space-x-2 border p-3 rounded-lg flex-1"><RadioGroupItem value="text" id="r-text" /><Label htmlFor="r-text">Texte</Label></div>
                <div className="flex items-center space-x-2 border p-3 rounded-lg flex-1"><RadioGroupItem value="image" id="r-image" /><Label htmlFor="r-image">Image</Label></div>
              </RadioGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label className="text-xs">Fond</Label><Input type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} /></div>
                <div className="space-y-2">
                    <Label className="text-xs">Durée ({splashDuration}s)</Label>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="size-8 shrink-0 rounded-full border-2" onClick={() => setSplashDuration(prev => Math.max(1, prev - 0.5))}><Minus className="size-3" /></Button>
                        <Slider value={[splashDuration]} min={1} max={10} step={0.5} onValueChange={v => setSplashDuration(v[0])} className="flex-grow" />
                        <Button variant="outline" size="icon" className="size-8 shrink-0 rounded-full border-2" onClick={() => setSplashDuration(prev => Math.min(10, prev + 0.5))}><Plus className="size-3" /></Button>
                    </div>
                </div>
                {splashMode === 'text' ? (
                  <><div className="space-y-2"><Label className="text-xs">Texte</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} /></div><div className="space-y-2"><Label className="text-xs">Couleur Texte</Label><Input type="color" value={splashTextColor} onChange={e => setSplashTextColor(e.target.value)} /></div></>
                ) : (
                  <div className="col-span-2 space-y-2"><Label className="text-xs">Image URL</Label><div className="flex gap-2"><Input value={splashImageUrl} onChange={e => setSplashImageUrl(e.target.value)} /><Input type="file" onChange={e => handleImageUpload(e, setSplashImageUrl)} className="max-w-[100px]" /></div></div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-between">
              <Button variant="outline" className="font-black uppercase text-xs" onClick={() => setIsPreviewing(true)}><Eye className="mr-2 size-4" /> Aperçu</Button>
              <Button className="font-black uppercase text-xs" onClick={handleSaveSplashSettings} disabled={isSavingSplash}><Save className="mr-2 size-4" /> Sauvegarder</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="fish" className="space-y-6">
          <Card className="border-2">
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="font-black uppercase text-sm">Guide Poissons</CardTitle><div className="flex gap-2"><Button variant="outline" size="sm" onClick={handleInitializeFish} disabled={isInitializingFish} className="text-[10px] uppercase font-black">Import Défaut</Button><Button size="sm" onClick={() => { setDialogMode('add'); setCurrentFish({ category: 'Lagon', gratteRisk: 0 }); setIsFishDialogOpen(true); }} className="text-[10px] uppercase font-black"><Plus className="mr-1 size-3" /> Ajouter</Button></div></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid gap-2">
                {dbFishSpecies?.map(fish => (
                  <div key={fish.id} className="flex items-center gap-3 p-2 border rounded-xl bg-card">
                    <div className="size-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {fish.imageUrl || fish.imagePlaceholder ? <Image src={fish.imageUrl || `https://picsum.photos/seed/${fish.imagePlaceholder}/100/100`} alt={fish.name} width={48} height={48} className="object-cover" /> : <Fish className="size-6 opacity-20" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-black uppercase text-[10px] truncate">{fish.name}</p>
                      <p className="text-[8px] italic opacity-60 truncate">{fish.scientificName}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDialogMode('edit'); setCurrentFish(fish); setIsFishDialogOpen(true); }}><Pencil className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFishToDelete(fish.id)}><Trash2 className="size-3 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sounds" className="space-y-6">
          <Card className="border-2">
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="font-black uppercase text-sm">Bibliothèque Sons</CardTitle><div className="flex gap-2"><Button variant="outline" size="sm" onClick={handleInitializeSounds} disabled={isInitializingSounds} className="text-[10px] uppercase font-black">Import Défaut</Button><Button size="sm" onClick={() => { setSoundDialogMode('add'); setCurrentSound({ categories: ['General'] }); setIsSoundDialogOpen(true); }} className="text-[10px] uppercase font-black"><Plus className="mr-1 size-3" /> Ajouter</Button></div></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid gap-2">
                {dbSounds?.map(sound => (
                  <div key={sound.id} className="flex items-center gap-3 p-3 border rounded-xl bg-card">
                    <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0"><Volume2 className="size-4" /></div>
                    <div className="flex-grow min-w-0">
                      <p className="font-bold text-xs truncate">{sound.label}</p>
                      <div className="flex gap-1 mt-1">{sound.categories?.map(c => <Badge key={c} variant="secondary" className="text-[7px] px-1 h-3">{c}</Badge>)}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playPreview(sound.url)}><Play className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(sound.url, sound.label)}><Download className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSoundToDelete(sound.id)}><Trash2 className="size-3 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="font-black uppercase text-sm">Accès Global (Cadeau)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {sharedToken && <Alert className="bg-primary/5 border-primary/20"><Crown className="size-4 text-primary" /><AlertTitle className="text-xs font-black uppercase">Actif</AlertTitle><AlertDescription className="text-[10px]">Expire le {format(sharedToken.expiresAt.toDate(), 'dd/MM/yy HH:mm', { locale: fr })}</AlertDescription></Alert>}
              <div className="flex gap-2">
                <Select value={globalDuration} onValueChange={setGlobalDuration}><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 jour</SelectItem><SelectItem value="7">1 semaine</SelectItem><SelectItem value="30">1 mois</SelectItem></SelectContent></Select>
                <Button className="h-10 px-6 font-black uppercase text-xs" onClick={() => handleUpdateSharedToken(parseInt(globalDuration))}>{sharedToken ? 'Prolonger' : 'Activer'}</Button>
                {sharedToken && <Button variant="destructive" className="h-10 px-4" onClick={handleDisableSharedToken}><Trash2 className="size-4" /></Button>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader><CardTitle className="font-black uppercase text-sm">Jetons Individuels</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={tokenDuration} onValueChange={setTokenDuration}><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 mois</SelectItem><SelectItem value="6">6 mois</SelectItem><SelectItem value="12">12 mois</SelectItem></SelectContent></Select>
                <Button className="h-10 px-6 font-black uppercase text-xs" onClick={handleGenerateToken} disabled={isGenerating}><KeyRound className="mr-2 size-4" /> Générer</Button>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30"><TableHead>Code</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {accessTokens?.map(t => (
                      <TableRow key={t.id} className="text-[10px]">
                        <TableCell className="font-mono">{t.id}</TableCell>
                        <TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="text-[8px]">{t.status}</Badge></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteDoc(doc(firestore, 'access_tokens', t.id))}><Trash2 className="size-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isUserEditDialogOpen} onOpenChange={setIsUserEditOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Accès Utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Statut</Label><Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Actif (Premium)</SelectItem><SelectItem value="inactive">Inactif</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs font-bold uppercase opacity-60">Fin Abo</Label><Input type="date" value={editExpiryDate} onChange={e => setEditExpiryDate(e.target.value)} className="h-12 border-2" /></div>
          </div>
          <DialogFooter><Button onClick={handleUpdateUser} disabled={isSavingUser} className="w-full h-12 font-black uppercase">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFishDialogOpen} onOpenChange={setIsFishDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-black uppercase">Fiche Poisson</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2"><Input placeholder="Nom..." value={currentFish.name || ''} onChange={e => setCurrentFish({...currentFish, name: e.target.value})} className="h-12 border-2" /><Button variant="secondary" className="h-12 font-black uppercase text-xs" onClick={handleAiFillFish} disabled={isAiGeneratingFish}><Sparkles className="mr-2 size-4" /> IA</Button></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Scientifique</Label><Input value={currentFish.scientificName || ''} onChange={e => setCurrentFish({...currentFish, scientificName: e.target.value})} className="h-10 border-2" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Catégorie</Label><Select value={currentFish.category} onValueChange={(v:any) => setCurrentFish({...currentFish, category: v})}><SelectTrigger className="h-10 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lagon">Lagon</SelectItem><SelectItem value="Large">Large</SelectItem><SelectItem value="Recif">Récif</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Risque Gratte (%)</Label><Input type="number" min="0" max="100" value={currentFish.gratteRisk ?? 0} onChange={e => setCurrentFish({...currentFish, gratteRisk: parseInt(e.target.value) || 0})} className="h-10 border-2" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Cuisine</Label><Textarea value={currentFish.culinaryAdvice || ''} onChange={e => setCurrentFish({...currentFish, culinaryAdvice: e.target.value})} className="text-xs border-2" /></div>
            <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Pêche</Label><Textarea value={currentFish.fishingAdvice || ''} onChange={e => setCurrentFish({...currentFish, fishingAdvice: e.target.value})} className="text-xs border-2" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveFish} disabled={isSavingFish} className="w-full h-12 font-black uppercase">Sauvegarder Fiche</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSoundDialogOpen} onOpenChange={setIsSoundDialogOpen}>
        <DialogContent className="max-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Ajouter Son</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Libellé</Label><Input value={currentSound.label || ''} onChange={e => setCurrentSound({...currentSound, label: e.target.value})} className="h-12 border-2" /></div>
            <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">URL / MP3</Label><div className="flex gap-2"><Input value={currentSound.url || ''} onChange={e => setCurrentSound({...currentSound, url: e.target.value})} className="h-12 border-2" /><div className="relative"><Input type="file" onChange={e => handleAudioUpload(e, (b) => setCurrentSound({...currentSound, url: b}))} className="absolute inset-0 opacity-0 cursor-pointer" /><Button variant="outline" size="icon" className="h-12 w-12 border-2 rounded-xl"><Upload className="size-5" /></Button></div></div></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Catégories</Label><div className="flex flex-wrap gap-2">{SOUND_CATEGORIES.map(c => <Button key={c.id} variant={(currentSound.categories || []).includes(c.id) ? 'default' : 'outline'} size="sm" onClick={() => handleToggleCategory(c.id)} className="text-[9px] h-7">{c.label}</Button>)}</div></div>
          </div>
          <DialogFooter><Button onClick={handleSaveSound} disabled={isSavingSound} className="w-full h-12 font-black uppercase">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!generatedToken} onOpenChange={() => setGeneratedToken(null)}><AlertDialogContent className="rounded-2xl border-2"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Jeton Prêt</AlertDialogTitle><div className="p-6 bg-muted/50 rounded-xl font-mono text-center text-lg border-2 border-dashed">{generatedToken}</div></AlertDialogHeader><AlertDialogFooter><AlertDialogAction className="font-black uppercase">Compris</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      
      <AlertDialog open={!!conversationToDelete} onOpenChange={() => setConversationToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Non</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteConversation(conversationToDelete!)}>Oui, supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible pour {userToDelete?.displayName}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUserConfirmed} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!soundToDelete} onOpenChange={() => setSoundToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce son ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSoundConfirmed}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      
      <AlertDialog open={!!fishToDelete} onOpenChange={() => setFishToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDeleteFishConfirmed}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
