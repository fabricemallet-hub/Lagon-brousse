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
  Share2, Palette, Save, Upload, 
  Fish, Plus, Pencil, DatabaseZap, Info, Sparkles, BrainCircuit, UserX,
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
  
  // User Edit States
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isUserEditDialogOpen, setIsUserEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('inactive');
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState(false);

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
  const [isAiGeneratingFish, setIsAiGeneratingFish] = useState(false);

  // Sound Admin States
  const [isSoundDialogOpen, setIsSoundDialogOpen] = useState(false);
  const [soundDialogMode, setSoundDialogMode] = useState<'add' | 'edit'>('add');
  const [currentSound, setCurrentSound] = useState<Partial<SoundLibraryEntry>>({});
  const [isSavingSound, setIsSavingSound] = useState(false);
  const [isInitializingSounds, setIsInitializingSounds] = useState(false);

  // Global Access States
  const [globalDuration, setGlobalDuration] = useState('7');

  const isAdmin = useMemo(() => 
    user?.email === 'f.mallet81@outlook.com' || user?.email === 'f.mallet81@gmail.com', 
  [user]);

  const splashRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore, isAdmin]);
  const { data: savedSplashSettings } = useDoc<SplashScreenSettings>(splashRef);

  // Fetch dynamic fish species from Firestore
  const fishSpeciesRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'fish_species'), orderBy('name', 'asc'));
  }, [firestore, isAdmin]);
  const { data: dbFishSpecies, isLoading: areFishLoading } = useCollection<FishSpeciesInfo>(fishSpeciesRef);

  // Fetch Sound Library from Firestore
  const soundsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore, isAdmin]);
  const { data: dbSounds, isLoading: areSoundsLoading } = useCollection<SoundLibraryEntry>(soundsRef);

  // Fetch Global Shared Token
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

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      toast({ 
        variant: 'destructive', 
        title: "Fichier trop lourd", 
        description: "Le MP3 doit faire moins de 500 Ko pour garantir une lecture fluide en mer." 
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      callback(base64);
      toast({ title: "Son chargé", description: "Le fichier est prêt à être sauvegardé." });
    };
    reader.readAsDataURL(file);
  };

  const handleAiFillFish = async () => {
    if (!currentFish.name) {
        toast({ variant: 'destructive', title: "Nom manquant", description: "Saisissez au moins le nom commun du poisson." });
        return;
    }
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
        toast({ title: "Fiche générée", description: "Les informations ont été complétées par l'IA." });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur IA", description: "Impossible de générer les infos." });
    } finally {
        setIsAiGeneratingFish(false);
    }
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

  const handleDeleteFishConfirmed = async () => {
    if (!firestore || !isAdmin || !fishToDelete) return;
    
    try {
        await deleteDoc(doc(firestore, 'fish_species', fishToDelete));
        toast({ title: "Espèce supprimée" });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer l'espèce." });
    } finally {
        setFishToDelete(null);
    }
  };

  const handleSaveSound = async () => {
    if (!firestore || !isAdmin || !currentSound.label || !currentSound.url) {
        toast({ variant: 'destructive', title: "Données manquantes", description: "Le libellé et l'URL sont obligatoires." });
        return;
    }
    if (!currentSound.categories || currentSound.categories.length === 0) {
        toast({ variant: 'destructive', title: "Catégorie manquante", description: "Veuillez sélectionner au moins une catégorie." });
        return;
    }
    setIsSavingSound(true);
    try {
        if (soundDialogMode === 'add') {
            await addDoc(collection(firestore, 'sound_library'), {
                ...currentSound,
                createdAt: serverTimestamp()
            });
            toast({ title: "Son ajouté", description: `${currentSound.label} est disponible.` });
        } else {
            const soundRef = doc(firestore, 'sound_library', currentSound.id!);
            await updateDoc(soundRef, {
                ...currentSound,
                updatedAt: serverTimestamp()
            });
            toast({ title: "Son mis à jour" });
        }
        setIsSoundDialogOpen(false);
        setCurrentSound({});
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de sauvegarder le son." });
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
        toast({ title: "Sons importés", description: `${defaultSounds.length} sons ajoutés.` });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur import" });
    } finally {
        setIsInitializingSounds(false);
    }
  };

  const playPreview = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(e => toast({ variant: 'destructive', title: 'Erreur lecture', description: 'URL invalide ou inaccessible.' }));
  };

  const downloadFile = async (url: string, label: string) => {
    const filename = `${label.toLowerCase().replace(/\s/g, '-')}.mp3`;
    toast({ title: "Préparation du téléchargement..." });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch failed");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast({ title: "Téléchargement terminé" });
    } catch (error) {
      window.open(url, '_blank');
      toast({ 
        title: "Ouverture du fichier", 
        description: "Le téléchargement direct est bloqué par le serveur distant. Le fichier s'ouvre dans un nouvel onglet : faites 'Clic droit -> Enregistrer sous'." 
      });
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
        const updates: Partial<UserAccount> = {
            subscriptionStatus: editStatus as any,
            subscriptionExpiryDate: editExpiryDate ? new Date(editExpiryDate).toISOString() : undefined
        };
        await updateDoc(userRef, updates);
        toast({ title: "Profil mis à jour", description: `Les accès de ${userToEdit.displayName} ont été modifiés.` });
        setIsUserEditOpen(false);
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de mettre à jour le profil." });
    } finally {
        setIsSavingUser(false);
    }
  };

  const handleDeleteUserConfirmed = async () => {
    if (!firestore || !isAdmin || !userToDelete) return;
    if (userToDelete.id === user?.uid) {
        toast({ variant: 'destructive', title: "Action impossible", description: "Vous ne pouvez pas supprimer votre propre compte administrateur." });
        setUserToDelete(null);
        return;
    }

    try {
        await deleteDoc(doc(firestore, 'users', userToDelete.id));
        toast({ title: "Compte supprimé", description: `Le compte de ${userToDelete.displayName} a été retiré.` });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer le compte." });
    } finally {
        setUserToDelete(null);
    }
  };

  const handleInitializeFish = async () => {
    if (!firestore || !isAdmin || !lagoonFishData) return;
    setIsInitializingFish(true);
    try {
        const batch = writeBatch(firestore);
        lagoonFishData.forEach(fish => {
            const fishId = fish.id || fish.name.toLowerCase().replace(/\s/g, '-');
            const newDocRef = doc(firestore, 'fish_species', fishId);
            batch.set(newDocRef, {
                ...fish,
                id: fishId,
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

  const handleUpdateSharedToken = async (daysCount: number) => {
    if (!firestore || !isAdmin) return;
    try {
      const now = new Date();
      const expiresAt = addDays(now, daysCount);
      await setDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'), {
        durationMonths: 0,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      });
      toast({ title: "Accès global activé !", description: `Valable ${daysCount} jours.` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur" });
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
  
  const getUserEmail = (uid?: string) => {
    if (!uid || !allUsers) return 'N/A';
    return allUsers.find(u => u.id === uid)?.email || 'Utilisateur inconnu';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copié !" });
  };

  const handleToggleCategory = (catId: string) => {
    const current = currentSound.categories || [];
    const next = current.includes(catId)
        ? current.filter(c => c !== catId)
        : [...current, catId];
    setCurrentSound({ ...currentSound, categories: next });
  };

  if (isUserLoading || !isAdmin) return <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-24 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isPreviewing && <SplashScreen settings={{ splashMode, splashText, splashTextColor, splashFontSize, splashBgColor, splashImageUrl, splashImageFit, splashDuration }} isExiting={false} />}

      <Card>
        <CardHeader><CardTitle>Tableau de Bord Administrateur</CardTitle></CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-6 h-auto">
          <TabsTrigger value="overview">Stats</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="fish">Fish</TabsTrigger>
          <TabsTrigger value="sounds">Sons</TabsTrigger>
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

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users /> Liste des Utilisateurs</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Fin Abo</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers?.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <span className="font-bold">{u.displayName}</span><br/>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin' ? 'default' : 'secondary'}>
                            {u.subscriptionStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {u.subscriptionExpiryDate ? format(new Date(u.subscriptionExpiryDate), 'dd/MM/yy') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEditUser(u)}
                                title="Modifier les accès"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                disabled={u.id === user?.uid}
                                onClick={() => setUserToDelete(u)}
                                title={u.id === user?.uid ? "Impossible de supprimer votre propre compte" : "Supprimer le compte"}
                            >
                                <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
            <CardFooter className="flex justify-between border-t p-6">
              <Button variant="outline" onClick={startPreview}><Eye className="mr-2"/> Aperçu</Button>
              <Button onClick={handleSaveSplashSettings} disabled={isSavingSplash}><Save className="mr-2"/> Sauvegarder</Button>
            </CardFooter>
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
                {areFishLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />) : dbFishSpecies && dbFishSpecies.length > 0 ? dbFishSpecies.map(fish => (
                  <Card key={fish.id} className="overflow-hidden border shadow-sm">
                    <div className="flex items-center p-4 gap-4">
                      <div className="relative size-20 rounded-lg overflow-hidden border bg-white shrink-0">
                        {fish.imageUrl || fish.imagePlaceholder ? (
                          <Image src={fish.imageUrl || `https://picsum.photos/seed/${fish.imagePlaceholder}/200/200`} alt={fish.name} fill className="object-contain p-1" sizes="128px" />
                        ) : <Fish className="size-8 m-auto text-muted-foreground" />}
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-black uppercase text-sm">{fish.name}</h4>
                        <p className="text-[10px] text-muted-foreground italic">{fish.scientificName}</p>
                        <Badge variant="outline" className="mt-1 text-[8px]">{fish.category}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setFishDialogMode('edit'); setCurrentFish(fish); setIsFishDialogOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setFishToDelete(fish.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </Card>
                )) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
                        <div className="size-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <Info className="text-muted-foreground size-6" />
                        </div>
                        <h3 className="font-bold">Base de données vide</h3>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                            Cliquez sur "Importer Défaut" pour charger les espèces emblématiques.
                        </p>
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sounds" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><Music /> Bibliothèque de Sons</CardTitle>
                <CardDescription>Sons pour le Vessel Tracker et la Chasse.</CardDescription>
              </div>
              <div className="flex gap-2">
                {(!dbSounds || dbSounds.length === 0) && (
                    <Button variant="outline" onClick={handleInitializeSounds} disabled={isInitializingSounds}>
                        <DatabaseZap className="mr-2 size-4" /> Import Défaut
                    </Button>
                )}
                <Button onClick={() => { setSoundDialogMode('add'); setCurrentSound({ categories: ['General'] }); setIsSoundDialogOpen(true); }}>
                    <Plus className="mr-2 size-4" /> Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {areSoundsLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />) : dbSounds && dbSounds.length > 0 ? dbSounds.map(sound => (
                  <Card key={sound.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-full text-primary">
                        <Volume2 className="size-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{sound.label}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {sound.categories?.map(cat => (
                                <Badge key={cat} variant="secondary" className="text-[8px] font-black uppercase tracking-tighter h-4 px-1.5">{SOUND_CATEGORIES.find(c => c.id === cat)?.label || cat}</Badge>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-1">{sound.url}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => playPreview(sound.url)} title="Aperçu"><Play className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => downloadFile(sound.url, sound.label)} title="Télécharger"><Download className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSoundDialogMode('edit'); setCurrentSound(sound); setIsSoundDialogOpen(true); }} title="Modifier"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setSoundToDelete(sound.id)} title="Supprimer"><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </Card>
                )) : <p className="text-center py-8 text-muted-foreground italic">Aucun son personnalisé.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Share2 className="text-primary" /> Accès Global (Cadeau)</CardTitle>
              <CardDescription>Ouvrez l'accès premium à TOUS les utilisateurs inscrits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sharedToken ? (
                <Alert className="bg-primary/10 border-primary/20">
                  <Crown className="size-4 text-primary" />
                  <AlertTitle>Accès Global Actif</AlertTitle>
                  <AlertDescription>
                    Expire le : {sharedToken.expiresAt ? format(sharedToken.expiresAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr }) : '...'}
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucun accès global actif.</p>
              )}
              
              <div className="flex items-end gap-4">
                <div className="flex-grow space-y-2">
                  <Label>Durée de l'offre (jours)</Label>
                  <Select value={globalDuration} onValueChange={setGlobalDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 jour</SelectItem>
                      <SelectItem value="3">3 jours</SelectItem>
                      <SelectItem value="7">1 semaine</SelectItem>
                      <SelectItem value="30">1 mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleUpdateSharedToken(parseInt(globalDuration))} className="bg-primary">
                  {sharedToken ? 'Prolonger' : 'Activer'}
                </Button>
                {sharedToken && (
                  <Button variant="destructive" onClick={handleDisableSharedToken}>Désactiver</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Jetons d'Accès Individuels</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-end gap-4">
                <div className="flex-grow space-y-2"><Label>Durée (mois)</Label><Select value={tokenDuration} onValueChange={setTokenDuration}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="6">6</SelectItem><SelectItem value="12">12</SelectItem></SelectContent></Select></div>
                <Button onClick={handleGenerateToken} disabled={isGenerating}><KeyRound className="mr-2"/> Générer</Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Statut / Utilisateur</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {accessTokens?.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                            {t.status === 'active' ? 'Disponible' : 'Utilisé'}
                          </Badge>
                          {t.status === 'redeemed' && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Par: {getUserEmail(t.redeemedBy)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteToken(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for User Edit */}
      <Dialog open={isUserEditDialogOpen} onOpenChange={setIsUserEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Modifier les accès</DialogTitle>
                <DialogDescription>Modifiez le statut et la date d'expiration pour {userToEdit?.displayName}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="status">Statut du compte</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger id="status">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Actif (Premium)</SelectItem>
                            <SelectItem value="inactive">Inactif (Limité)</SelectItem>
                            <SelectItem value="trial">Essai (Temporaire)</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expiry">Date de fin d'abonnement</Label>
                    <Input 
                        id="expiry" 
                        type="date" 
                        value={editExpiryDate} 
                        onChange={e => setEditExpiryDate(e.target.value)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsUserEditOpen(false)}>Annuler</Button>
                <Button onClick={handleUpdateUser} disabled={isSavingUser}>{isSavingUser ? 'Enregistrement...' : 'Sauvegarder'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Fish Create/Edit */}
      <Dialog open={isFishDialogOpen} onOpenChange={setIsFishDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{fishDialogMode === 'add' ? 'Ajouter une espèce' : 'Modifier l\'espèce'}</DialogTitle>
                <DialogDescription>Remplissez les informations techniques du poisson.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="flex items-end gap-2">
                    <div className="flex-grow space-y-2">
                        <Label>Nom Commun</Label>
                        <Input value={currentFish.name || ''} onChange={e => setCurrentFish({...currentFish, name: e.target.value})} placeholder="Bec de cane..." />
                    </div>
                    <Button 
                        variant="secondary" 
                        className="gap-2 font-bold"
                        disabled={!currentFish.name || isAiGeneratingFish}
                        onClick={handleAiFillFish}
                    >
                        {isAiGeneratingFish ? <BrainCircuit className="size-4 animate-pulse" /> : <Sparkles className="size-4" />}
                        {isAiGeneratingFish ? 'Analyse...' : 'Générer avec l\'IA'}
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nom Scientifique</Label><Input value={currentFish.scientificName || ''} onChange={e => setCurrentFish({...currentFish, scientificName: e.target.value})} placeholder="Lethrinus..." /></div>
                    <div className="space-y-2"><Label>Catégorie</Label><Select value={currentFish.category} onValueChange={(v:any) => setCurrentFish({...currentFish, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lagon">Lagon</SelectItem><SelectItem value="Large">Large</SelectItem><SelectItem value="Recif">Récif</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Risque Gratte (%)</Label><Input type="number" value={currentFish.gratteRisk || 0} onChange={e => setCurrentFish({...currentFish, gratteRisk: parseInt(e.target.value)})} /></div>
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
                <div className="space-y-2"><Label>Conseil Culinaire</Label><Textarea value={currentFish.culinaryAdvice || ''} onChange={e => setCurrentFish({...currentFish, culinaryAdvice: e.target.value})} /></div>
                <div className="space-y-2"><Label>Conseil de Pêche</Label><Textarea value={currentFish.fishingAdvice || ''} onChange={e => setCurrentFish({...currentFish, fishingAdvice: e.target.value})} /></div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsFishDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSaveFish} disabled={isSavingFish}>{isSavingFish ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Sound Create/Edit */}
      <Dialog open={isSoundDialogOpen} onOpenChange={setIsSoundDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{soundDialogMode === 'add' ? 'Ajouter un son' : 'Modifier le son'}</DialogTitle>
                <DialogDescription>Saisissez le nom du son et son URL ou chargez un fichier MP3.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="size-4 text-blue-600" />
                  <AlertTitle className="text-xs font-black uppercase">Spécifications recommandées</AlertTitle>
                  <AlertDescription className="text-[10px] leading-relaxed">
                    Format : <strong>MP3 uniquement</strong>.<br/>
                    Compression : <strong>128 kbps</strong> recommandé.<br/>
                    Poids idéal : <strong>{"< 500 Ko"}</strong> pour un chargement instantané en mer.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2"><Label>Libellé du son</Label><Input value={currentSound.label || ''} onChange={e => setCurrentSound({...currentSound, label: e.target.value})} placeholder="Signal radio..." /></div>
                <div className="space-y-2">
                    <Label>Fichier MP3 / URL</Label>
                    <div className="flex gap-2">
                        <Input value={currentSound.url || ''} onChange={e => setCurrentSound({...currentSound, url: e.target.value})} placeholder="https://... ou fichier chargé" />
                        <div className="relative">
                            <input 
                                type="file" 
                                accept="audio/mpeg" 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                onChange={e => handleAudioUpload(e, (b) => setCurrentSound({...currentSound, url: b}))} 
                            />
                            <Button variant="outline" size="icon" title="Charger depuis l'ordinateur"><Upload className="size-4"/></Button>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => currentSound.url && playPreview(currentSound.url)} title="Aperçu"><Play className="size-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => currentSound.url && downloadFile(currentSound.url, currentSound.label || 'son')} title="Télécharger"><Download className="size-4"/></Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Catégories (Sélection multiple possible)</Label>
                    <div className="flex flex-wrap gap-2">
                        {SOUND_CATEGORIES.map(cat => (
                            <Button 
                                key={cat.id} 
                                variant={(currentSound.categories || []).includes(cat.id) ? 'default' : 'outline'}
                                size="sm"
                                className="text-[10px] font-black uppercase h-8 px-3"
                                onClick={() => handleToggleCategory(cat.id)}
                            >
                                {cat.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsSoundDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSaveSound} disabled={isSavingSound}>{isSavingSound ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
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

      {conversationToDelete && (
        <AlertDialog open={!!conversationToDelete} onOpenChange={(open) => !open && setConversationToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteConversation(conversationToDelete!)}>Supprimer</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le compte de {userToDelete.displayName} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera définitivement le profil de l'utilisateur dans Firestore.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteUserConfirmed} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer le compte
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {soundToDelete && (
        <AlertDialog open={!!soundToDelete} onOpenChange={() => setSoundToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Supprimer ce son ?</AlertDialogTitle><AlertDialogDescription>Il ne sera plus disponible pour les alertes.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSoundConfirmed}>Supprimer</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
