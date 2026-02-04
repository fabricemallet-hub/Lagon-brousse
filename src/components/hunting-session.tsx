
'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  LogOut,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  Navigation,
  Expand,
  Shrink,
  User as UserIcon,
  Crosshair,
  Footprints,
  Mountain,
  Save,
  Trash2,
  Target,
  LocateFixed,
  MapPin,
  Volume2,
  VolumeX,
  AlertCircle,
  Play,
  Settings,
  Zap,
  Plus,
  Minus,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import {
  collection,
  getDoc,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import Link from 'next/link';
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

const iconMap = { Navigation, UserIcon, Crosshair, Footprints, Mountain, MapPin };

const defaultHuntingSounds = [
  { id: 'trompette', label: 'Fanfare Trompette', url: 'https://assets.mixkit.co/active_storage/sfx/2700/2700-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'cor', label: 'Cor de chasse', url: 'https://assets.mixkit.co/active_storage/sfx/2701/2701-preview.mp3' },
];

const BatteryIcon = React.memo(({ level, charging }: { level: number; charging: boolean }) => {
  const props = { className: 'w-4 h-4 inline-block' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 0.2) return <BatteryLow {...props} className="text-red-500" />;
  if (level < 0.6) return <BatteryMedium {...props} className="text-amber-500" />;
  return <BatteryFull {...props} className="text-green-500" />;
});
BatteryIcon.displayName = 'BatteryIcon';

const PulsingDot = React.memo(() => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="w-5 h-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
));
PulsingDot.displayName = 'PulsingDot';

function HuntingSessionContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [session, setSession] = useState<WithId<HuntingSession> | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number} | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [nickname, setNickname] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Navigation');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.8);
  const [soundSettings, setSoundSettings] = useState({
    position: 'cloche',
    battue: 'trompette',
    gibier: 'alerte'
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSection, setPrefsSection] = useState<string | undefined>(undefined);

  const [mySessions, setMySessions] = useState<WithId<HuntingSession>[]>([]);
  const [areMySessionsLoading, setAreMySessionsLoading] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  // Background/WakeLock State
  const [wakeLock, setWakeLock] = useState<any>(null);

  const prevParticipantsRef = useRef<SessionParticipant[] | null>(null);

  // Sound Library from Firestore
  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    const list = [...defaultHuntingSounds];
    if (dbSounds) {
        dbSounds.forEach(s => {
            const hasRightCategory = !s.categories || s.categories.includes('Hunting') || s.categories.includes('General');
            if (hasRightCategory && !list.find(l => l.url === s.url)) {
                list.push({ id: s.id, label: s.label, url: s.url });
            }
        });
    }
    return list;
  }, [dbSounds]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants } = useCollection<SessionParticipant>(participantsCollectionRef);

  const playStatusSound = useCallback((status: string) => {
    if (!isSoundEnabled) return;
    
    let soundToIdentify = '';
    if (status === 'En position') soundToIdentify = soundSettings.position;
    else if (status === 'Battue en cours') soundToIdentify = soundSettings.battue;
    else if (status === 'gibier') soundToIdentify = soundSettings.gibier;

    const sound = availableSounds.find(s => s.id === soundToIdentify || s.label === soundToIdentify);
    if (sound) {
        const audio = new Audio(sound.url);
        audio.volume = soundVolume;
        audio.play().catch(() => {
          console.warn(`Could not play sound: ${soundToIdentify}`);
        });
    }
  }, [isSoundEnabled, soundSettings, soundVolume, availableSounds]);

  const previewSound = (soundToIdentify: string) => {
    const sound = availableSounds.find(s => s.id === soundToIdentify || s.label === soundToIdentify);
    if (sound) {
        const audio = new Audio(sound.url);
        audio.volume = soundVolume;
        audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (!participants || !user) return;
    
    if (prevParticipantsRef.current === null) {
      prevParticipantsRef.current = participants;
      return;
    }

    participants.forEach(p => {
      if (p.id === user.uid) return;
      const prev = prevParticipantsRef.current?.find(old => old.id === p.id);
      
      if (p.isGibierEnVue && !prev?.isGibierEnVue) {
        playStatusSound('gibier');
        toast({ title: "GIBIER SIGNALÉ !", description: `Par ${p.displayName}`, variant: "destructive" });
      }
      
      if (p.baseStatus !== prev?.baseStatus && p.baseStatus) {
        playStatusSound(p.baseStatus);
      }
    });

    prevParticipantsRef.current = participants;
  }, [participants, user, playStatusSound, toast]);

  const fetchMySessions = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    setAreMySessionsLoading(true);
    try {
      const q = collection(firestore, 'hunting_sessions');
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as WithId<HuntingSession>))
        .filter(s => s.organizerId === user.uid);
      
      sessions.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setMySessions(sessions.slice(0, 5));
    } catch (e) {
      console.error("Error fetching sessions:", e);
    } finally {
      setAreMySessionsLoading(false);
    }
  }, [firestore, user?.uid]);

  useEffect(() => {
    fetchMySessions();
  }, [fetchMySessions]);
  
  useEffect(() => {
    if (userProfile) {
      setNickname(userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '');
      setSelectedIcon(userProfile.mapIcon || 'Navigation');
      setSelectedColor(userProfile.mapColor || '#3b82f6');
    }
  }, [userProfile, user]);
  
  const { isLoaded, loadError } = useGoogleMaps();

  // Mode Éveil (Wake Lock) avec interception propre de l'erreur de politique
  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      toast({ 
        variant: "destructive", 
        title: "Non supporté", 
        description: "Votre navigateur ne supporte pas le maintien de l'écran allumé." 
      });
      return;
    }

    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        toast({ title: "Mode éveil désactivé", description: "L'écran peut désormais se mettre en veille." });
      } catch (e) {
        console.warn("Wake lock release failed:", e);
        setWakeLock(null);
      }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil activé", description: "L'écran restera allumé pour garantir le suivi GPS." });
          lock.addEventListener('release', () => {
            setWakeLock(null);
          });
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.message?.includes('permissions policy')) {
          toast({ 
            variant: "destructive", 
            title: "Permission bloquée", 
            description: "Le maintien de l'écran est bloqué par cet environnement (iframe). Cette fonction sera active sur navigateur mobile ou onglet indépendant." 
          });
        } else {
          console.error("Wake Lock error:", err);
        }
      }
    }
  };

  const handleLeaveSession = useCallback(async () => {
    if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    
    const previousSessionId = session?.id;
    setSession(null);
    setIsParticipating(false);
    setUserLocation(null);
    setInitialZoomDone(false);

    if (!user || !previousSessionId || !firestore) return;

    setIsSessionLoading(true);
    try {
        const participantDocRef = doc(firestore, 'hunting_sessions', previousSessionId, 'participants', user.uid);
        await deleteDoc(participantDocRef);
        toast({ title: 'Vous avez quitté la session.' });
    } catch (e: any) {
        console.error("Failed to leave session:", e);
    } finally {
        setIsSessionLoading(false);
    }
  }, [user, session, firestore, toast]);

  const startTracking = useCallback(() => {
    if (!user || !firestore || !navigator.geolocation || !session?.id) return;

    if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const newLocation = { latitude, longitude };
            setUserLocation(newLocation);

            if (!initialZoomDone && map) {
                map.panTo({ lat: latitude, lng: longitude });
                setInitialZoomDone(true);
            }

            const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
            
            let batteryData = null;
            if ('getBattery' in navigator) {
                const battery: any = await (navigator as any).getBattery();
                batteryData = { level: battery.level, charging: battery.charging };
            }

            updateDoc(participantDocRef, {
                location: newLocation,
                battery: batteryData,
                updatedAt: serverTimestamp(),
            }).catch(() => {});
        },
        (err) => console.error("Geolocation watch error:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [user, firestore, session, map, initialZoomDone]);
  
  useEffect(() => {
    if (isParticipating && session) {
        startTracking();
    }
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isParticipating, session, startTracking]);

  const handleCreateSession = async () => {
    if (!user || !firestore) return;
    setIsSessionLoading(true);
    try {
        const code = createCode.trim() ? createCode.trim().toUpperCase() : `CH-${Math.floor(1000 + Math.random() * 9000)}`;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const newSessionData = { organizerId: user.uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt) };
        await setDoc(doc(firestore, 'hunting_sessions', code), newSessionData);
        
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const participantDocRef = doc(firestore, 'hunting_sessions', code, 'participants', user.uid);
            await setDoc(participantDocRef, { 
                id: user.uid,
                displayName: nickname, 
                mapIcon: selectedIcon, 
                mapColor: selectedColor, 
                baseStatus: '', 
                isGibierEnVue: false,
                location: { latitude, longitude },
                updatedAt: serverTimestamp() 
            });
            setUserLocation({ latitude, longitude });
        });
        
        setSession({ id: code, ...newSessionData } as any);
        setIsParticipating(true);
        fetchMySessions();
        toast({ title: 'Session créée !', description: `Code : ${code}` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
        setIsSessionLoading(false);
    }
  };
  
  const handleJoinSession = async () => {
    if (!user || !firestore || !joinCode) return;
    setIsSessionLoading(true);
    try {
      const sessionId = joinCode.toUpperCase();
      const sessionDoc = await getDoc(doc(firestore, 'hunting_sessions', sessionId));
      if (!sessionDoc.exists()) throw new Error('Session non trouvée.');
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          const participantDocRef = doc(firestore, 'hunting_sessions', sessionId, 'participants', user.uid);
          await setDoc(participantDocRef, { 
              id: user.uid,
              displayName: nickname, 
              mapIcon: selectedIcon, 
              mapColor: selectedColor, 
              baseStatus: '', 
              isGibierEnVue: false,
              location: { latitude, longitude },
              updatedAt: serverTimestamp() 
          }, { merge: true });
          setUserLocation({ latitude, longitude });
      });
      
      setSession({ id: sessionDoc.id, ...sessionDoc.data() } as any);
      setIsParticipating(true);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
        setIsSessionLoading(false);
    }
  };

  const handleDeleteSessionConfirmed = async () => {
    if (!firestore || !sessionToDelete) return;
    try {
        const participantsRef = collection(firestore, 'hunting_sessions', sessionToDelete, 'participants');
        const snap = await getDocs(participantsRef);
        const batch = writeBatch(firestore);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        fetchMySessions();
        toast({ title: 'Session supprimée' });
    } catch (e) {
        console.error(e);
    } finally {
        setSessionToDelete(null);
    }
  };

  const updateTacticalStatus = async (status: string) => {
    if (!user || !firestore || !session) return;
    const ref = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
    const me = participants?.find(p => p.id === user.uid);
    
    const isDeactivating = me?.baseStatus === status;
    const newStatus = isDeactivating ? '' : status;
    
    await updateDoc(ref, { baseStatus: newStatus });
    
    if (!isDeactivating) {
        playStatusSound(status);
        toast({ title: `Statut : ${status}` });
    } else {
        toast({ title: 'Statut retiré' });
    }
  };

  const toggleGibierEnVue = async () => {
    if (!user || !firestore || !session) return;
    const ref = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
    const me = participants?.find(p => p.id === user.uid);
    const newVal = !me?.isGibierEnVue;
    await updateDoc(ref, { isGibierEnVue: newVal });
    if (newVal) playStatusSound('gibier');
    toast({ 
        title: newVal ? "Gibier signalé !" : "Alerte levée", 
        variant: newVal ? "destructive" : "default" 
    });
  };

  const handleSavePreferences = async () => {
    if (!user || !firestore || !nickname) return;
    setIsSavingPrefs(true);
    try {
        const prefs = { displayName: nickname, mapIcon: selectedIcon, mapColor: selectedColor };
        await updateDoc(doc(firestore, 'users', user.uid), prefs);
        if (session && isParticipating) {
            await updateDoc(doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid), prefs);
        }
        toast({ title: 'Préférences sauvegardées !' });
        setPrefsSection(undefined); 
    } catch (e) {
        console.error(e);
    } finally {
        setIsSavingPrefs(false);
    }
  };

  const mapOptions = useMemo(() => ({
    disableDefaultUI: true, 
    zoomControl: true, 
    mapTypeId: 'satellite'
  }), []);

  if (session) {
    if (loadError) return <Card><CardContent><Alert variant="destructive"><AlertTitle>Erreur Google Maps</AlertTitle></Alert></CardContent></Card>;
    if (!isLoaded || isProfileLoading) return <Card><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>;

    const me = participants?.find(p => p.id === user?.uid);

    return (
        <Card className={cn("transition-all", isFullscreen && "fixed inset-0 z-50 w-screen h-screen rounded-none border-none flex flex-col")}>
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Users className="size-5 text-primary" /> Session {session.id}</div>
                    <Button onClick={handleLeaveSession} variant="destructive" size="sm" disabled={isSessionLoading}><LogOut className="size-4 mr-2"/> Quitter</Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col p-2 gap-4 overflow-y-auto">
                 <div className={cn("relative w-full rounded-lg overflow-hidden border", isFullscreen ? "flex-grow" : "h-80")}>
                    <GoogleMap
                        mapContainerClassName="w-full h-full"
                        center={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: -21.45, lng: 165.5 }}
                        zoom={16}
                        onLoad={setMap}
                        options={mapOptions}
                    >
                        {userLocation && (
                            <OverlayView position={{ lat: userLocation.latitude, lng: userLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <PulsingDot />
                            </OverlayView>
                        )}

                        {participants?.map(p => p.location && (
                            <OverlayView key={p.id} position={{ lat: p.location.latitude, lng: p.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                    <div className={cn(
                                        "px-2.5 py-1 rounded text-[11px] font-black text-white shadow-lg whitespace-nowrap border border-white/30",
                                        p.isGibierEnVue ? "bg-red-600 animate-bounce" : "bg-slate-900 backdrop-blur-md"
                                    )}>
                                        {p.displayName} {p.baseStatus ? `• ${p.baseStatus}` : ''}
                                    </div>
                                    <div 
                                        className={cn(
                                            "p-1.5 rounded-full shadow-lg border-2 border-white transition-all",
                                            p.isGibierEnVue && "scale-125 ring-4 ring-red-500/50"
                                        )} 
                                        style={{ backgroundColor: p.isGibierEnVue ? '#ef4444' : (p.mapColor || '#3b82f6') }}
                                    >
                                        {React.createElement(iconMap[p.mapIcon as keyof typeof iconMap] || Navigation, { className: "size-4 text-white" })}
                                    </div>
                                </div>
                            </OverlayView>
                        ))}
                    </GoogleMap>
                    <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-2 left-2 shadow-lg h-9 w-9 z-10 bg-background/80 backdrop-blur-sm">
                        {isFullscreen ? <Shrink /> : <Expand />}
                    </Button>
                    <Button size="icon" onClick={() => userLocation && map?.panTo({ lat: userLocation.latitude, lng: userLocation.longitude })} className="absolute top-2 right-2 shadow-lg h-9 w-9 z-10 bg-background/80 backdrop-blur-sm">
                        <LocateFixed className="size-5" />
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        variant={me?.baseStatus === 'En position' ? 'default' : 'outline'} 
                        className="h-12 font-bold"
                        onClick={() => updateTacticalStatus('En position')}
                    >
                        <MapPin className="mr-2 size-4" /> En Position
                    </Button>
                    <Button 
                        variant={me?.baseStatus === 'Battue en cours' ? 'default' : 'outline'} 
                        className="h-12 font-bold"
                        onClick={() => updateTacticalStatus('Battue en cours')}
                    >
                        <Footprints className="mr-2 size-4" /> En Battue
                    </Button>
                    <Button 
                        variant={me?.isGibierEnVue ? 'destructive' : 'secondary'} 
                        className={cn("col-span-2 h-14 text-lg font-black shadow-lg", me?.isGibierEnVue && "animate-pulse")}
                        onClick={toggleGibierEnVue}
                    >
                        <Target className="mr-2 size-6" /> {me?.isGibierEnVue ? 'GIBIER SIGNALÉ !' : 'SIGNALER GIBIER'}
                    </Button>
                </div>

                {!isFullscreen && (
                    <div className="space-y-4">
                        <Accordion type="single" collapsible value={prefsSection} onValueChange={setPrefsSection} className="w-full">
                            <AccordionItem value="prefs" className="border-none">
                                <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-2 bg-muted/50 rounded-lg px-4 mb-2">
                                    <Settings className="size-4" />
                                    <span>Mon Profil & Sons</span>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2 px-1">
                                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Paramètres de session</Label>
                                        <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Mon surnom..." />
                                        
                                        <Button 
                                          variant={wakeLock ? "secondary" : "outline"} 
                                          size="sm"
                                          className={cn("w-full gap-2 font-bold h-11 border-2 my-2", wakeLock && "bg-primary/10 text-primary border-primary")}
                                          onClick={toggleWakeLock}
                                        >
                                          <Zap className={cn("size-4", wakeLock && "fill-current")} />
                                          {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
                                        </Button>

                                        <div className="space-y-4 pt-4 border-t border-border/50">
                                            <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                                <Volume2 className="size-4" /> Paramètres Audio
                                            </Label>
                                            
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {isSoundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-muted-foreground" />}
                                                    <Label className="text-sm">Activer les sons</Label>
                                                </div>
                                                <Switch checked={isSoundEnabled} onCheckedChange={setIsSoundEnabled} />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span>Volume des alertes</span>
                                                    <span>{Math.round(soundVolume * 100)}%</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Button variant="outline" size="icon" className="size-8 shrink-0 rounded-full border-2" onClick={() => setSoundVolume(prev => Math.max(0, parseFloat((prev - 0.1).toFixed(1))))}><Minus className="size-3" /></Button>
                                                    <Slider value={[soundVolume]} min={0} max={1} step={0.1} onValueChange={(val) => setSoundVolume(val[0])} className="flex-grow" />
                                                    <Button variant="outline" size="icon" className="size-8 shrink-0 rounded-full border-2" onClick={() => setSoundVolume(prev => Math.min(1, parseFloat((prev + 0.1).toFixed(1))))}><Plus className="size-3" /></Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                                        <MapPin className="size-3" /> Son : En Position
                                                    </Label>
                                                    <div className="flex gap-2">
                                                        <Select value={soundSettings.position} onValueChange={(val) => { setSoundSettings(prev => ({...prev, position: val})); previewSound(val); }}>
                                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {availableSounds.map(s => <SelectItem key={s.id || s.label} value={s.id || s.label}>{s.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => previewSound(soundSettings.position)}><Play className="size-3" /></Button>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                                        <Footprints className="size-3" /> Son : En Battue
                                                    </Label>
                                                    <div className="flex gap-2">
                                                        <Select value={soundSettings.battue} onValueChange={(val) => { setSoundSettings(prev => ({...prev, battue: val})); previewSound(val); }}>
                                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {availableSounds.map(s => <SelectItem key={s.id || s.label} value={s.id || s.label}>{s.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => previewSound(soundSettings.battue)}><Play className="size-3" /></Button>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-destructive flex items-center gap-1">
                                                        <Target className="size-3" /> Son : Gibier en vue
                                                    </Label>
                                                    <div className="flex gap-2">
                                                        <Select value={soundSettings.gibier} onValueChange={(val) => { setSoundSettings(prev => ({...prev, gibier: val})); previewSound(val); }}>
                                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {availableSounds.map(s => <SelectItem key={s.id || s.label} value={s.id || s.label}>{s.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => previewSound(soundSettings.gibier)}><Play className="size-3" /></Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <Button onClick={handleSavePreferences} size="sm" disabled={isSavingPrefs} className="w-full"><Save className="mr-2 h-4 w-4" /> Sauvegarder Profil</Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="space-y-2">
                            <h4 className="font-bold text-sm flex items-center gap-2">
                                <Users className="size-4" /> Équipe ({participants?.length || 0})
                            </h4>
                            <div className="max-h-48 overflow-y-auto space-y-1 divide-y border rounded-lg bg-card">
                                {participants?.map(p => (
                                    <div key={p.id} className={cn("flex justify-between items-center p-3 text-sm", p.isGibierEnVue && "bg-red-50 dark:bg-red-950/20")}>
                                        <div className="flex items-center gap-3">
                                            <div className="size-3 rounded-full" style={{ backgroundColor: p.mapColor || '#3b82f6' }} />
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{p.displayName}</span>
                                                {p.baseStatus && (
                                                    <Badge 
                                                        className={cn(
                                                            "text-[10px] font-black uppercase px-1.5 py-0 shadow-sm border-none",
                                                            p.baseStatus === 'En position' 
                                                                ? "bg-blue-600 hover:bg-blue-600 text-white" 
                                                                : "bg-orange-600 hover:bg-orange-600 text-white"
                                                        )}
                                                    >
                                                        {p.baseStatus}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            {p.battery && <BatteryIcon level={p.battery.level} charging={p.battery.charging} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" /> Session de Chasse</CardTitle></CardHeader>
            <CardContent>
                <Tabs defaultValue="join">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="join">Rejoindre</TabsTrigger><TabsTrigger value="create">Créer</TabsTrigger></TabsList>
                    <TabsContent value="join" className="space-y-4 pt-4">
                        <Input placeholder="Code CH-XXXX" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="text-center font-mono text-lg uppercase tracking-widest h-12" />
                        <Button onClick={handleJoinSession} className="w-full h-12 text-lg font-bold" disabled={isSessionLoading}>Rejoindre le groupe</Button>
                    </TabsContent>
                    <TabsContent value="create" className="space-y-4 pt-4">
                        <Input placeholder="Code personnalisé (optionnel)" value={createCode} onChange={e => setCreateCode(e.target.value)} className="text-center font-mono text-lg uppercase tracking-widest h-12" />
                        <Button onClick={handleCreateSession} className="w-full h-12 text-lg font-bold" disabled={isSessionLoading}>Créer une session</Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        {areMySessionsLoading ? <Skeleton className="h-24 w-full" /> : mySessions && mySessions.length > 0 && (
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Mes sessions récentes</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {mySessions.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-3 border rounded-lg text-sm font-mono bg-card hover:bg-muted/50 transition-colors">
                            <span className="font-bold">{s.id}</span>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setJoinCode(s.id)}>Sélectionner</Button>
                                <Button variant="ghost" size="icon" onClick={() => setSessionToDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}

        {sessionToDelete && (
            <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer la session ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible et supprimera la session ainsi que tous ses participants.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSessionConfirmed}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
    </div>
  );
}

export function HuntingSessionCard() {
  const { user, isUserLoading } = useUser();
  if (isUserLoading) return <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>;
  if (!user) return (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="text-destructive" /> Connexion requise</CardTitle>
            <CardDescription>Vous devez être connecté pour rejoindre ou créer une session de chasse de groupe.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild className="w-full"><Link href="/login">Se connecter</Link></Button>
        </CardContent>
    </Card>
  );
  return <HuntingSessionContent />;
}
