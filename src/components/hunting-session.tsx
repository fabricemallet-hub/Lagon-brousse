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
  WifiOff,
  Volume2,
  VolumeX,
  AlertCircle
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
} from 'firebase/firestore';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import Link from 'next/link';

const iconMap = { Navigation, UserIcon, Crosshair, Footprints, Mountain, MapPin };

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
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const [mySessions, setMySessions] = useState<WithId<HuntingSession>[]>([]);
  const [areMySessionsLoading, setAreMySessionsLoading] = useState(false);

  const prevParticipantsRef = useRef<SessionParticipant[] | null>(null);

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
    let url = '';
    if (status === 'En position') {
        url = 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3'; // Cloche claire
    } else if (status === 'Battue en cours') {
        url = 'https://assets.mixkit.co/active_storage/sfx/2560/2560-preview.mp3'; // Clic métallique fort et sec
    } else if (status === 'gibier') {
        url = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Alerte urgente
    }
    if (url) {
        const audio = new Audio(url);
        audio.play().catch(() => {});
    }
  }, [isSoundEnabled]);

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
            <CardContent className="flex-grow flex flex-col p-2 gap-4">
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
                                        "px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-md whitespace-nowrap border border-white/20",
                                        p.isGibierEnVue ? "bg-red-600 animate-bounce" : "bg-black/60 backdrop-blur-sm"
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
                        <Alert className="bg-blue-50 border-blue-200">
                            <WifiOff className="size-4 text-blue-600" />
                            <AlertTitle className="text-blue-800 text-xs font-bold">Mode Hors Ligne</AlertTitle>
                            <AlertDescription className="text-[10px] text-blue-700">
                                Le fond de carte satellite est automatiquement mis en cache lorsque vous le consultez avec du réseau. Parcourez votre zone de chasse à la maison pour l'avoir sur le terrain sans internet.
                            </AlertDescription>
                        </Alert>
                        
                        <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Mon Profil de Session</Label>
                            <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Mon surnom..." />
                            
                            <div className="flex items-center justify-between py-2 border-t border-border/50">
                                <div className="flex items-center gap-2">
                                    {isSoundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-muted-foreground" />}
                                    <Label className="text-sm">Sons d'alerte</Label>
                                </div>
                                <Switch checked={isSoundEnabled} onCheckedChange={setIsSoundEnabled} />
                            </div>

                            <Button onClick={handleSavePreferences} size="sm" disabled={isSavingPrefs} className="w-full"><Save className="mr-2 h-4 w-4" /> Sauvegarder</Button>
                        </div>
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
                                <Button variant="ghost" size="icon" onClick={() => {
                                    if (confirm('Supprimer cette session et tous ses participants ?')) {
                                        const participantsRef = collection(firestore!, 'hunting_sessions', s.id, 'participants');
                                        getDocs(participantsRef).then(snap => {
                                            const batch = writeBatch(firestore!);
                                            snap.forEach(d => batch.delete(d.ref));
                                            batch.delete(doc(firestore!, 'hunting_sessions', s.id));
                                            batch.commit().then(() => fetchMySessions());
                                        });
                                    }
                                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
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
