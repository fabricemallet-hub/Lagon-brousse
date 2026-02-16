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
import { Badge } from '@/components/ui/badge';
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
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertCircle,
  Settings,
  Zap,
  Volume2,
  Play,
  X,
  RefreshCw,
  Anchor,
  Fish,
  ChevronDown
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import {
  getDoc,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  getDocs,
  collection,
  query,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn, getDistance } from '@/lib/utils';
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

const INITIAL_CENTER = { lat: -21.45, lng: 165.5 };
const iconMap = { Navigation, UserIcon, Crosshair, Footprints, Mountain, MapPin, Anchor, Fish };

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
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
));
PulsingDot.displayName = 'PulsingDot';

interface HuntingSessionProps {
  sessionType?: 'chasse' | 'peche';
}

function HuntingSessionContent({ sessionType = 'chasse' }: HuntingSessionProps) {
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
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shouldPanOnNextFix = useRef(false);

  const [nickname, setNickname] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(sessionType === 'chasse' ? 'Navigation' : 'Anchor');
  const [selectedColor, setSelectedColor] = useState(sessionType === 'chasse' ? '#f97316' : '#3b82f6');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.8);
  const [soundSettings, setSoundSettings] = useState({
    position: '',
    battue: '',
    gibier: ''
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSection, setPrefsSection] = useState<string | undefined>(undefined);

  const [mySessions, setMySessions] = useState<WithId<HuntingSession>[]>([]);
  const [areMySessionsLoading, setAreMySessionsLoading] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);

  const prevParticipantsRef = useRef<SessionParticipant[] | null>(null);
  const hasLoadedInitialPrefs = useRef(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const labels = useMemo(() => {
    if (sessionType === 'peche') {
      return {
        title: "Session de Pêche",
        status1: "Au Mouillage",
        status2: "En Dérive",
        alertBtn: "SIGNALER POISSON",
        alertTitle: "POISSON SIGNALÉ !",
        alertDesc: "Poisson repéré !",
        icon1: Anchor,
        icon2: RefreshCw
      };
    }
    return {
      title: "Session de Chasse",
      status1: "En Position",
      status2: "En Battue",
      alertBtn: "SIGNALER GIBIER",
      alertTitle: "GIBIER SIGNALÉ !",
      alertDesc: "Gibier en vue !",
      icon1: MapPin,
      icon2: Footprints
    };
  }, [sessionType]);

  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !session?.id) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session?.id]);
  const { data: participants } = useCollection<SessionParticipant>(participantsQuery);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.filter(s => 
      !s.categories || s.categories.includes('Hunting') || s.categories.includes('General')
    ).map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  const playStatusSound = useCallback((statusOrType: string) => {
    if (!isSoundEnabled) return;
    
    let sId = '';
    const normalized = statusOrType.toLowerCase().trim();
    const posLabelNorm = labels.status1.toLowerCase().trim();
    const battueLabelNorm = labels.status2.toLowerCase().trim();

    if (normalized === 'gibier' || normalized === labels.alertBtn.toLowerCase() || normalized === labels.alertTitle.toLowerCase()) {
      sId = soundSettings.gibier;
    } else if (normalized === 'position' || normalized === posLabelNorm) {
      sId = soundSettings.position;
    } else if (normalized === 'battue' || normalized === battueLabelNorm) {
      sId = soundSettings.battue;
    }

    const sound = availableSounds.find(s => s.id === sId || s.label === sId);
    if (sound) {
        const audio = new Audio(sound.url);
        audio.volume = soundVolume;
        audio.play().catch(() => {});
    }
  }, [isSoundEnabled, soundSettings, soundVolume, availableSounds, labels]);

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
        toast({ title: labels.alertTitle, description: `Par ${p.displayName}`, variant: "destructive" });
      }
      if (p.baseStatus !== prev?.baseStatus && p.baseStatus) {
        playStatusSound(p.baseStatus);
      }
    });
    prevParticipantsRef.current = participants;
  }, [participants, user, playStatusSound, toast, labels]);

  const fetchMySessions = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    setAreMySessionsLoading(true);
    try {
      const q = collection(firestore, 'hunting_sessions');
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as WithId<HuntingSession>))
        .filter(s => s.organizerId === user.uid && (s.sessionType || 'chasse') === sessionType);
      sessions.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setMySessions(sessions.slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setAreMySessionsLoading(false);
    }
  }, [firestore, user?.uid, sessionType]);

  useEffect(() => { fetchMySessions(); }, [fetchMySessions]);
  
  useEffect(() => {
    if (userProfile && !hasLoadedInitialPrefs.current) {
      setNickname(userProfile.huntingNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '');
      setSelectedIcon(userProfile.mapIcon || (sessionType === 'chasse' ? 'Navigation' : 'Anchor'));
      setSelectedColor(userProfile.mapColor || (sessionType === 'chasse' ? '#f97316' : '#3b82f6'));
      
      const savedVesselPrefs = userProfile.vesselPrefs;
      if (savedVesselPrefs?.huntingSoundSettings) {
        setSoundSettings(savedVesselPrefs.huntingSoundSettings);
        setSoundVolume(savedVesselPrefs.huntingVolume !== undefined ? savedVesselPrefs.huntingVolume : 0.8);
        setIsSoundEnabled(savedVesselPrefs.huntingSoundEnabled ?? true);
      }
      hasLoadedInitialPrefs.current = true;
    }
  }, [userProfile, user, sessionType]);
  
  const { isLoaded, loadError } = useGoogleMaps();

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); } }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const handleLeaveSession = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    const previousSessionId = session?.id;
    setSession(null);
    setIsParticipating(false);
    setIsGpsActive(false);
    setUserLocation(null);
    
    if (!user || !previousSessionId || !firestore) return;
    
    const participantRef = doc(firestore, 'hunting_sessions', previousSessionId, 'participants', user.uid);
    deleteDoc(participantRef).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: participantRef.path,
          operation: 'delete'
        }));
    });
  }, [user, session, firestore]);

  const startTracking = useCallback(() => {
    if (!user || !firestore || !navigator.geolocation || !session?.id) return;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

    watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ latitude, longitude });
            if (shouldPanOnNextFix.current && map) {
                map.panTo({ lat: latitude, lng: longitude });
                map.setZoom(16);
                shouldPanOnNextFix.current = false;
            }
            const ref = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
            
            const updateWithBattery = async () => {
                let batt = null;
                if ('getBattery' in navigator) {
                    const b: any = await (navigator as any).getBattery();
                    batt = { level: b.level, charging: b.charging };
                }
                const updatePayload = { location: { latitude, longitude }, battery: batt, updatedAt: serverTimestamp() };
                updateDoc(ref, updatePayload).catch(async (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: ref.path,
                        operation: 'update',
                        requestResourceData: updatePayload
                    } satisfies SecurityRuleContext));
                });
            };
            updateWithBattery();
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [user, firestore, session, map]);
  
  useEffect(() => {
    if (isParticipating && session && isGpsActive) startTracking();
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isParticipating, session, isGpsActive, startTracking]);

  const handleCreateSession = () => {
    if (!user || !firestore) return;
    setIsSessionLoading(true);
    const code = createCode.trim() ? createCode.trim().toUpperCase() : `${sessionType === 'chasse' ? 'CH' : 'PE'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const sessionData = { organizerId: user.uid, sessionType, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt) };
    const sessionRef = doc(firestore, 'hunting_sessions', code);
    
    setDoc(sessionRef, sessionData)
      .then(() => {
        const participantData = { 
            id: user.uid, displayName: nickname, mapIcon: selectedIcon, mapColor: selectedColor, baseStatus: '', isGibierEnVue: false, updatedAt: serverTimestamp() 
        };
        const participantRef = doc(firestore, 'hunting_sessions', code, 'participants', user.uid);
        setDoc(participantRef, participantData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: participantRef.path,
              operation: 'create',
              requestResourceData: participantData
            }));
        });

        setSession({ id: code, ...sessionData } as any);
        setIsParticipating(true);
        fetchMySessions();
        setIsSessionLoading(false);
        toast({ title: 'Session créée !', description: `Code : ${code}` });
      })
      .catch(async (err) => {
        setIsSessionLoading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: sessionRef.path,
          operation: 'create',
          requestResourceData: sessionData
        }));
      });
  };
  
  const handleJoinSession = () => {
    if (!user || !firestore || !joinCode) return;
    setIsSessionLoading(true);
    const sessionId = joinCode.toUpperCase();
    const sessionRef = doc(firestore, 'hunting_sessions', sessionId);
    
    getDoc(sessionRef).then(snap => {
      if (!snap.exists()) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Session non trouvée.' });
        setIsSessionLoading(false);
        return;
      }

      const participantData = { 
          id: user.uid, displayName: nickname, mapIcon: selectedIcon, mapColor: selectedColor, baseStatus: '', isGibierEnVue: false, updatedAt: serverTimestamp() 
      };
      const participantRef = doc(firestore, 'hunting_sessions', sessionId, 'participants', user.uid);
      
      setDoc(participantRef, participantData, { merge: true })
        .then(() => {
          setSession({ id: snap.id, ...snap.data() } as any);
          setIsParticipating(true);
          toast({ title: 'Session rejointe' });
          setIsSessionLoading(false);
        })
        .catch(async (err) => {
          setIsSessionLoading(false);
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: participantRef.path,
            operation: 'write',
            requestResourceData: participantData
          }));
        });
    }).catch(e => {
        setIsSessionLoading(false);
        toast({ variant: 'destructive', title: 'Erreur accès' });
    });
  };

  const handleToggleGps = () => {
    if (!isGpsActive) {
        setIsGpsActive(true);
        shouldPanOnNextFix.current = true;
        toast({ title: "GPS Activé" });
    } else {
        setIsGpsActive(false);
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setUserLocation(null);
        toast({ title: "GPS Désactivé" });
    }
  };

  const handleRecenter = () => {
    if (watchIdRef.current === null) {
        setIsGpsActive(true);
        shouldPanOnNextFix.current = true;
        toast({ description: "Activation du GPS..." });
    } else if (userLocation && map) {
        map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
        map.setZoom(16);
    }
  };

  const handleDeleteSessionConfirmed = () => {
    if (!firestore || !sessionToDelete) return;
    const sId = sessionToDelete;
    setSessionToDelete(null);

    const participantsRef = collection(firestore, 'hunting_sessions', sId, 'participants');
    getDocs(participantsRef).then(snap => {
        const batch = writeBatch(firestore);
        snap.forEach(d => batch.delete(d.ref));
        batch.delete(doc(firestore, 'hunting_sessions', sId));
        batch.commit().then(() => {
            fetchMySessions();
            toast({ title: 'Session supprimée' });
        }).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `hunting_sessions/${sId}`,
                operation: 'delete'
            }));
        });
    });
  };

  const updateTacticalStatus = (st: string) => {
    if (!user || !firestore || !session) return;
    const ref = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
    const me = participants?.find(p => p.id === user.uid);
    const isDeactivating = me?.baseStatus === st;
    const newVal = isDeactivating ? '' : st;
    
    updateDoc(ref, { baseStatus: newVal }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: { baseStatus: newVal }
        }));
    });

    if (!isDeactivating) { 
        playStatusSound(st); 
        toast({ title: `Statut : ${st}` }); 
    }
  };

  const toggleGibierEnVue = () => {
    if (!user || !firestore || !session) return;
    const ref = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
    const me = participants?.find(p => p.id === user.uid);
    const newVal = !me?.isGibierEnVue;
    
    updateDoc(ref, { isGibierEnVue: newVal }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: { isGibierEnVue: newVal }
        }));
    });

    if (newVal) playStatusSound('gibier');
    toast({ title: newVal ? labels.alertDesc : "Alerte levée", variant: newVal ? "destructive" : "default" });
  };

  const handleSavePreferences = () => {
    if (!user || !firestore || !nickname) return;
    setIsSavingPrefs(true);
    const currentVesselPrefs = userProfile?.vesselPrefs || {};
    const prefsPayload = { 
      huntingNickname: nickname, 
      mapIcon: selectedIcon, 
      mapColor: selectedColor,
      vesselPrefs: {
        ...currentVesselPrefs,
        huntingSoundSettings: soundSettings,
        huntingVolume: soundVolume,
        huntingSoundEnabled: isSoundEnabled
      }
    };
    
    const userRef = doc(firestore, 'users', user.uid);
    updateDoc(userRef, prefsPayload)
      .then(() => {
        if (session && isParticipating) {
          const participantRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
          updateDoc(participantRef, { displayName: nickname, mapIcon: selectedIcon, mapColor: selectedColor }).catch(() => {});
        }
        toast({ title: 'Préférences sauvegardées !' });
        setPrefsSection(undefined); 
        setIsSavingPrefs(false);
      })
      .catch(async (err) => {
        setIsSavingPrefs(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: prefsPayload
        }));
      });
  };

  if (session) {
    if (loadError) return <Card><CardContent><Alert variant="destructive"><AlertTitle>Erreur Maps</AlertTitle></Alert></CardContent></Card>;
    if (!isLoaded || isProfileLoading) return <Card><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>;
    const me = participants?.find(p => p.id === user?.uid);

    return (
        <div className={cn("transition-all", isFullscreen ? "fixed inset-0 z-[150] w-screen h-[100dvh] bg-black" : "relative w-full space-y-4")}>
            <Card className={cn("border-2 shadow-sm overflow-hidden flex flex-col", isFullscreen && "h-full w-full border-none rounded-none")}>
                <CardHeader className={cn("flex-shrink-0 bg-background transition-all", isFullscreen ? "p-3 border-b shadow-md z-20" : "p-4")}>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Users className="size-4 text-primary" /> <span className="text-sm font-black uppercase">{session.id}</span></div>
                        <div className="flex items-center gap-2">
                            {isFullscreen && (
                                <Button onClick={handleRecenter} variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase border-2 gap-1 px-2">
                                    <LocateFixed className="size-3" /> Recentrer
                                </Button>
                            )}
                            <Button onClick={handleLeaveSession} variant="destructive" size="sm" className="h-8 text-[9px] font-black uppercase gap-1" disabled={isSessionLoading}>
                                <LogOut className="size-3"/> Quitter
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                
                <CardContent className={cn("flex-grow flex flex-col overflow-hidden relative", isFullscreen ? "p-0" : "p-2 gap-4")}>
                    <div className={cn("relative w-full overflow-hidden transition-all", isFullscreen ? "flex-grow" : "h-80 rounded-lg border")}>
                        <GoogleMap
                            mapContainerClassName="w-full h-full"
                            defaultCenter={INITIAL_CENTER}
                            defaultZoom={16}
                            onLoad={setMap}
                            options={{ disableDefaultUI: true, zoomControl: false, mapTypeControl: false, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
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
                                            "px-2 py-1 rounded text-[11px] font-black text-white shadow-lg border transition-all whitespace-nowrap", 
                                            p.isGibierEnVue 
                                                ? "bg-red-600 animate-bounce border-red-400" 
                                                : p.baseStatus === labels.status1 
                                                    ? "bg-blue-600 border-blue-400" 
                                                    : p.baseStatus === labels.status2 
                                                        ? "bg-indigo-600 border-indigo-400" 
                                                        : "bg-slate-900/80 backdrop-blur-md border-white/20"
                                        )}>
                                            {p.displayName} {p.baseStatus && <span className="ml-1 opacity-80">| {p.baseStatus.toUpperCase()}</span>}
                                        </div>
                                        <div 
                                            className={cn(
                                                "p-1.5 rounded-full shadow-lg border-2 border-white transition-all", 
                                                p.isGibierEnVue && "scale-125 ring-4 ring-red-500/50"
                                            )} 
                                            style={{ 
                                                backgroundColor: p.isGibierEnVue 
                                                    ? '#ef4444' 
                                                    : p.baseStatus === labels.status1 
                                                        ? '#2563eb' 
                                                        : p.baseStatus === labels.status2 
                                                            ? '#4f46e5' 
                                                            : (p.mapColor || '#3b82f6') 
                                            }}
                                        >
                                            {React.createElement(iconMap[p.mapIcon as keyof typeof iconMap] || Navigation, { className: "size-4 text-white" })}
                                        </div>
                                    </div>
                                </OverlayView>
                            ))}
                        </GoogleMap>
                        
                        <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-3 left-3 shadow-2xl h-10 w-10 z-10 bg-background/90 backdrop-blur-md border-2 border-primary/20">
                            {isFullscreen ? <Shrink className="size-6 text-primary" /> : <Expand className="size-6 text-primary" />}
                        </Button>

                        {!isFullscreen && (
                            <Button 
                                onClick={handleRecenter} 
                                className={cn(
                                    "absolute top-3 right-3 shadow-lg h-10 w-auto px-3 z-10 border-2 gap-2 flex items-center", 
                                    isGpsActive ? "bg-primary text-white border-primary" : "bg-background/90 backdrop-blur-md border-primary/10"
                                )}
                            >
                                <span className="text-[9px] font-black uppercase tracking-tighter text-primary">RECENTRER</span>
                                <LocateFixed className="size-5 text-primary" />
                            </Button>
                        )}

                        {isFullscreen && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-20">
                                <div className="flex flex-col gap-3 pointer-events-auto max-w-lg mx-auto">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button 
                                            variant={me?.baseStatus === labels.status1 ? 'default' : 'secondary'} 
                                            className={cn("h-14 font-black uppercase text-xs border-2 shadow-xl", me?.baseStatus === labels.status1 ? "border-primary" : "bg-white/90 backdrop-blur-md border-white/20")} 
                                            onClick={() => updateTacticalStatus(labels.status1)}
                                        >
                                            <labels.icon1 className="mr-2 size-5" /> {labels.status1}
                                        </Button>
                                        <Button 
                                            variant={me?.baseStatus === labels.status2 ? 'default' : 'secondary'} 
                                            className={cn("h-14 font-black uppercase text-xs border-2 shadow-xl", me?.baseStatus === labels.status2 ? "border-primary" : "bg-white/90 backdrop-blur-md border-white/20")} 
                                            onClick={() => updateTacticalStatus(labels.status2)}
                                        >
                                            <labels.icon2 className="mr-2 size-5" /> {labels.status2}
                                        </Button>
                                    </div>
                                    <Button 
                                        variant={me?.isGibierEnVue ? 'destructive' : 'secondary'} 
                                        className={cn("h-16 text-lg font-black shadow-2xl border-4 uppercase tracking-tighter", me?.isGibierEnVue ? "animate-pulse border-red-400" : "bg-white border-white/20")} 
                                        onClick={toggleGibierEnVue}
                                    >
                                        <Target className="mr-3 size-8" /> {me?.isGibierEnVue ? labels.alertTitle : labels.alertBtn}
                                    </Button>

                                    <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value="team-list" className="border-none">
                                            <AccordionTrigger className="flex items-center justify-center gap-2 hover:no-underline py-2 bg-black/60 backdrop-blur-md text-white rounded-xl h-8 px-4 opacity-80">
                                                <div className="flex items-center gap-2 font-black uppercase text-[9px] tracking-widest">
                                                    <Users className="size-3" /> Voir l'équipe ({participants?.length || 0})
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2">
                                                <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-y-auto max-h-40 divide-y divide-white/5 scrollbar-hide">
                                                    {participants?.map(p => (
                                                        <div key={p.id} className="flex justify-between items-center p-3 text-white">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.mapColor || '#3b82f6' }} />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-black uppercase text-[10px] truncate">{p.displayName}</span>
                                                                    {p.baseStatus && <span className="text-[8px] font-black text-primary uppercase">{p.baseStatus}</span>}
                                                                </div>
                                                            </div>
                                                            {p.battery && <div className="flex items-center gap-1 text-[9px] font-black opacity-60"><BatteryIcon level={p.battery.level} charging={p.battery.charging} /> {Math.round(p.battery.level * 100)}%</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isFullscreen && (
                        <div className="flex flex-col gap-4 animate-in fade-in">
                            {!isGpsActive && (
                                <Alert className="bg-primary/5 border-primary/20">
                                    <LocateFixed className="size-4 text-primary" />
                                    <AlertTitle className="text-xs font-black uppercase">GPS Inactif</AlertTitle>
                                    <AlertDescription className="flex flex-col gap-2">
                                        <p className="text-[10px] font-medium leading-relaxed">Activez votre position pour que vos coéquipiers puissent vous situer sur la carte.</p>
                                        <Button size="sm" onClick={handleToggleGps} className="font-black h-10 uppercase text-[10px] tracking-widest">Activez ma position</Button>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <Button variant={me?.baseStatus === labels.status1 ? 'default' : 'outline'} className="h-12 font-bold" onClick={() => updateTacticalStatus(labels.status1)}><labels.icon1 className="mr-2 size-4" /> {labels.status1}</Button>
                                <Button variant={me?.baseStatus === labels.status2 ? 'default' : 'outline'} className="h-12 font-bold" onClick={() => updateTacticalStatus(labels.status2)}><labels.icon2 className="mr-2 size-4" /> {labels.status2}</Button>
                                <Button variant={me?.isGibierEnVue ? 'destructive' : 'secondary'} className={cn("col-span-2 h-14 text-lg font-black shadow-lg", me?.isGibierEnVue && "animate-pulse")} onClick={toggleGibierEnVue}><Target className="mr-2 size-6" /> {me?.isGibierEnVue ? labels.alertTitle : labels.alertBtn}</Button>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2 px-1 text-muted-foreground"><Users className="size-3" /> Équipe ({participants?.length || 0})</h4>
                                <div className="overflow-y-auto space-y-1 divide-y border-2 rounded-xl bg-card shadow-inner max-h-64 scrollbar-hide">
                                    {participants?.map(p => (
                                        <div key={p.id} className={cn("flex justify-between items-center p-3 text-sm transition-colors", p.isGibierEnVue && "bg-red-50 animate-pulse")}>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: p.mapColor || '#3b82f6' }} />
                                                    <span className="font-black uppercase text-xs truncate text-slate-800">{p.displayName}</span>
                                                </div>
                                                {(p.baseStatus || p.isGibierEnVue) && (
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase ml-4.5 mt-0.5 px-1.5 rounded w-fit leading-tight",
                                                        p.isGibierEnVue ? "text-red-600 bg-red-100" : "text-primary bg-primary/5"
                                                    )}>
                                                        {p.isGibierEnVue ? (sessionType === 'chasse' ? 'GIBIER EN VUE !' : 'POISSON SIGNALÉ !') : p.baseStatus}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                                {p.battery && (
                                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border-2 border-slate-100 text-[10px] font-black shadow-sm">
                                                        <span className={cn(p.battery.level < 0.2 ? "text-red-600 animate-pulse" : "text-slate-500")}>
                                                            {Math.round(p.battery.level * 100)}%
                                                        </span>
                                                        <BatteryIcon level={p.battery.level} charging={p.battery.charging} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Accordion type="single" collapsible value={prefsSection} onValueChange={setPrefsSection} className="w-full">
                                <AccordionItem value="prefs" className="border-none">
                                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-2 bg-muted/50 rounded-lg px-4 mb-2"><Settings className="size-4" /><span>Profil & Sons</span></AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2 px-1">
                                        <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                                            <div className="space-y-1.5">
                                              <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Mon Surnom</Label>
                                              <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Surnom..." />
                                            </div>
                                            
                                            <Button variant={wakeLock ? "secondary" : "outline"} size="sm" className="w-full h-11 border-2" onClick={toggleWakeLock}><Zap className="size-4 mr-2" />{wakeLock ? "ÉVEIL ACTIF" : "MAINTENIR ÉCRAN"}</Button>
                                            
                                            <div className="space-y-4 pt-4 border-t border-dashed">
                                              <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                  <Label className="text-xs font-black uppercase">Sons actifs</Label>
                                                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Alertes audio session</p>
                                                </div>
                                                <Switch checked={isSoundEnabled} onCheckedChange={setIsSoundEnabled} />
                                              </div>

                                              <div className={cn("space-y-4 transition-opacity", !isSoundEnabled && "opacity-40 pointer-events-none")}>
                                                <div className="space-y-3">
                                                  <Label className="text-[10px] font-black uppercase flex items-center gap-2">
                                                    <Volume2 className="size-3" /> Volume des alertes
                                                  </Label>
                                                  <Slider 
                                                    value={[Math.round((soundVolume || 0) * 100)]} 
                                                    max={100} step={1} 
                                                    onValueChange={v => setSoundVolume(v[0] / 100)} 
                                                  />
                                                </div>

                                                <div className="grid gap-3">
                                                  {[
                                                    { key: 'position', label: labels.status1 },
                                                    { key: 'battue', label: labels.status2 },
                                                    { key: 'gibier', label: 'Gibier / Poisson' }
                                                  ].map(item => (
                                                    <div key={item.key} className="flex items-center justify-between gap-4">
                                                      <span className="text-[10px] font-bold uppercase flex-1">{item.label}</span>
                                                      <Select 
                                                        value={soundSettings[item.key as keyof typeof soundSettings]} 
                                                        onValueChange={v => setSoundSettings({ ...soundSettings, [item.key]: v })}
                                                      >
                                                        <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-muted/30">
                                                          <SelectValue placeholder="Choisir..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {availableSounds.length > 0 ? (
                                                            availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)
                                                          ) : (
                                                            <p className="p-2 text-[8px] text-center opacity-50 uppercase">Aucun son disponible</p>
                                                          )}
                                                        </SelectContent>
                                                      </Select>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        const s = availableSounds.find(snd => snd.id === soundSettings[item.key as keyof typeof soundSettings]);
                                                        if (s) {
                                                          const a = new Audio(s.url);
                                                          a.volume = soundVolume;
                                                          a.play();
                                                        }
                                                      }}><Play className="size-3" /></Button>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>

                                            <Button onClick={handleSavePreferences} size="sm" disabled={isSavingPrefs} className="w-full h-12 font-black uppercase tracking-widest">
                                              {isSavingPrefs ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                                              Sauvegarder Profil & Sons
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" /> {labels.title}</CardTitle></CardHeader>
            <CardContent>
                <Tabs defaultValue="join">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="join">Rejoindre</TabsTrigger>
                        <TabsTrigger value="create">Créer</TabsTrigger>
                    </TabsList>
                    <TabsContent value="join" className="space-y-4 pt-4">
                        <Input placeholder="Code EX: CH-XXXX" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="text-center font-mono text-lg uppercase h-12" />
                        <Button onClick={handleJoinSession} className="w-full h-12 text-lg font-bold" disabled={isSessionLoading}>Rejoindre le groupe</Button>
                    </TabsContent>
                    <TabsContent value="create" className="space-y-4 pt-4">
                        <Input placeholder="Code perso (optionnel)" value={createCode} onChange={e => setCreateCode(e.target.value)} className="text-center font-mono text-lg uppercase h-12" />
                        <Button onClick={handleCreateSession} className="w-full h-12 text-lg font-bold" disabled={isSessionLoading}>Créer une session</Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        {mySessions.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Mes sessions</CardTitle></CardHeader>
            <CardContent className="space-y-2">{mySessions.map(s => <div key={s.id} className="flex justify-between items-center p-3 border rounded-lg text-sm bg-card"><span className="font-bold">{s.id}</span><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setJoinCode(s.id)}>Sélectionner</Button><Button variant="ghost" size="icon" onClick={() => setSessionToDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</CardContent></Card>}
        
        {sessionToDelete && (
          <AlertDialog open={!!sessionToDelete} onOpenChange={(o) => !o && setSessionToDelete(null)}>
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase tracking-tight text-destructive flex items-center gap-2">
                  <AlertCircle className="size-5" /> Supprimer la session ?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed">
                  Cette action supprimera définitivement la session "{sessionToDelete}" ainsi que la position de tous les participants inscrits. Cette opération est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="h-12 font-black uppercase text-[10px] border-2">Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSessionConfirmed} className="h-12 font-black uppercase text-[10px] bg-destructive hover:bg-destructive/90">Supprimer définitivement</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
    </div>
  );
}

export function HuntingSessionCard({ sessionType = 'chasse' }: HuntingSessionProps) {
  const { user, isUserLoading } = useUser();
  if (isUserLoading) return <Skeleton className="h-48 w-full" />;
  if (!user) return <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="text-destructive" /> Connexion requise</CardTitle></CardHeader><CardContent><Button asChild className="w-full"><Link href="/login">Se connecter</Link></Button></CardContent></Card>;
  return <HuntingSessionContent sessionType={sessionType} />;
}
