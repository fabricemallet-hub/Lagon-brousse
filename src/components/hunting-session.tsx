
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Share2,
  LogIn,
  LogOut,
  Copy,
  Users,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  LocateFixed,
  AlertCircle,
  Navigation,
  Download,
  Expand,
  Shrink,
  User as UserIcon,
  Crosshair,
  Footprints,
  Mountain,
  Save,
  MapPin,
  Eye,
  Trash2,
  Clock,
} from 'lucide-react';
import {
  useUser,
  useAuth,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
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
  deleteField,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const playSound = (type: 'position' | 'battue' | 'gibier') => {
  if (typeof window === 'undefined') return;
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);

  switch (type) {
    case 'position':
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.type = 'sine';
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
      oscillator.stop(audioCtx.currentTime + 0.2);
      break;
    case 'battue':
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.type = 'square';
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
      oscillator.stop(audioCtx.currentTime + 0.3);
      break;
    case 'gibier':
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.type = 'triangle';
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
      oscillator.stop(audioCtx.currentTime + 0.4);
      break;
  }
};

const iconMap = { Navigation, UserIcon, Crosshair, Footprints, Mountain };
const availableIcons = Object.keys(iconMap);
const availableColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const BatteryIcon = ({ level, charging }: { level: number; charging: boolean }) => {
  const props = { className: 'w-4 h-4 inline-block' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 0.2) return <BatteryLow {...props} className="text-red-500" />;
  if (level < 0.6) return <BatteryMedium {...props} className="text-amber-500" />;
  return <BatteryFull {...props} className="text-green-500" />;
};

function HuntingSessionContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [session, setSession] = useState<WithId<HuntingSession> | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number} | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(8);
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<string>('terrain');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialCenter, setInitialCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [nickname, setNickname] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Navigation');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const [baseStatus, setBaseStatus] = useState<SessionParticipant['baseStatus']>(undefined);
  const [isGibierEnVue, setIsGibierEnVue] = useState(false);
  const [flashingStatus, setFlashingStatus] = useState<{text: string; color: string} | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const previousParticipantsRef = useRef<WithId<SessionParticipant>[] | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants, isLoading: areParticipantsLoading } = useCollection<SessionParticipant>(participantsCollectionRef);
  
  // History query simplified for performance and debugging
  const mySessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'hunting_sessions'),
      where('organizerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [firestore, user?.uid]);
  const { data: mySessions, isLoading: areMySessionsLoading } = useCollection<HuntingSession>(mySessionsQuery);

  const myParticipant = useMemo(() => participants?.find(p => p.id === user?.uid), [participants, user]);
  const otherParticipants = useMemo(() => participants?.filter(p => p.id !== user?.uid), [participants, user]);
  
  useEffect(() => {
    if (userProfile) {
      setNickname(userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '');
      setSelectedIcon(userProfile.mapIcon || 'Navigation');
      setSelectedColor(userProfile.mapColor || '#3b82f6');
    }
  }, [userProfile, user]);
  
  const { isLoaded, loadError } = useGoogleMaps();

  useEffect(() => {
    const savedMapTypeId = localStorage.getItem('huntingMapTypeId');
    if (savedMapTypeId) setMapTypeId(savedMapTypeId);
  }, []);

  const handleLeaveSession = useCallback(async () => {
    if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
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

  const handleDeleteSessionFromList = async (sessionId: string) => {
    if (!firestore || !user) return;
    try {
        const participantsRef = collection(firestore, 'hunting_sessions', sessionId, 'participants');
        const participantsSnap = await getDocs(participantsRef);
        const batch = writeBatch(firestore);
        participantsSnap.forEach(pDoc => batch.delete(pDoc.ref));
        batch.delete(doc(firestore, 'hunting_sessions', sessionId));
        await batch.commit();
        if (session?.id === sessionId) handleLeaveSession();
        toast({ title: 'Session supprimée.' });
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Erreur' });
    }
  };

  const fetchAndSetUserPosition = useCallback(async (isFirstUpdate = false) => {
    if (!user || !firestore || !navigator.geolocation || !session?.id) return;

    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000, 
                maximumAge: 0,
            });
        });
        
        const { latitude, longitude } = position.coords;
        const newLocation = { latitude, longitude };
        setUserLocation(newLocation);

        if (isFirstUpdate && map) {
            map.panTo({ lat: latitude, lng: longitude });
            map.setZoom(16);
            setInitialZoomDone(true);
        }

        const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
        const dataToUpdate: any = {
            location: newLocation,
            updatedAt: serverTimestamp(),
        };
        
        updateDoc(participantDocRef, dataToUpdate).catch(err => console.error("Error updating position:", err));

    } catch (err: any) {
        console.error("Error getting geolocation:", err);
    }
  }, [user, firestore, session, map]);
  
  useEffect(() => {
      if (!participants || areParticipantsLoading || !previousParticipantsRef.current) {
        previousParticipantsRef.current = participants;
        return;
      }
      const prevParts = new Map(previousParticipantsRef.current.map(p => [p.id, p]));
      participants.forEach(currentPart => {
        const prevPart = prevParts.get(currentPart.id);
        if (!prevPart || currentPart.id === user?.uid) return;
        if (currentPart.isGibierEnVue && !prevPart.isGibierEnVue) playSound('gibier');
        else if (currentPart.baseStatus && currentPart.baseStatus !== prevPart.baseStatus) {
            if (currentPart.baseStatus === 'En position') playSound('position');
            else if (currentPart.baseStatus === 'Battue en cours') playSound('battue');
        }
      });
      previousParticipantsRef.current = participants;
    }, [participants, areParticipantsLoading, user?.uid]);

  useEffect(() => {
    if (isParticipating && session && !updateIntervalRef.current) {
        updateIntervalRef.current = setInterval(() => fetchAndSetUserPosition(), 300000);
    }
    return () => { if (updateIntervalRef.current) clearInterval(updateIntervalRef.current); };
  }, [isParticipating, session, fetchAndSetUserPosition]);

  const handleCreateSession = async () => {
    if (!user || !firestore) return;
    setIsSessionLoading(true);
    setError(null);
    try {
        const code = createCode.trim() ? createCode.trim().toUpperCase() : `CH-${Math.floor(1000 + Math.random() * 9000)}`;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const newSessionData = { organizerId: user.uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt) };
        await setDoc(doc(firestore, 'hunting_sessions', code), newSessionData);
        
        const participantDocRef = doc(firestore, 'hunting_sessions', code, 'participants', user.uid);
        await setDoc(participantDocRef, { displayName: nickname, mapIcon: selectedIcon, mapColor: selectedColor, updatedAt: serverTimestamp() });
        await fetchAndSetUserPosition(true);

        setSession({ id: code, ...newSessionData } as any);
        setIsParticipating(true);
        toast({ title: 'Session créée !', description: `Code : ${code}` });
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsSessionLoading(false);
    }
  };
  
  const handleJoinSession = async () => {
    if (!user || !firestore || !joinCode) return;
    setIsSessionLoading(true);
    setError(null);
    try {
      const sessionId = joinCode.toUpperCase();
      const sessionDoc = await getDoc(doc(firestore, 'hunting_sessions', sessionId));
      if (!sessionDoc.exists()) throw new Error('Session non trouvée.');
      
      const participantDocRef = doc(firestore, 'hunting_sessions', sessionId, 'participants', user.uid);
      await setDoc(participantDocRef, { displayName: nickname, mapIcon: selectedIcon, mapColor: selectedColor, updatedAt: serverTimestamp() }, { merge: true });
      await fetchAndSetUserPosition(true);

      setSession({ id: sessionDoc.id, ...sessionDoc.data() } as any);
      setIsParticipating(true);
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsSessionLoading(false);
    }
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

  if (session) {
    if (loadError) return <Card><CardContent><Alert variant="destructive"><AlertTitle>Erreur Google Maps</AlertTitle></Alert></CardContent></Card>;
    if (!isLoaded || isProfileLoading) return <Card><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>;

    return (
        <Card className={cn("transition-all", isFullscreen && "fixed inset-0 z-50 w-screen h-screen rounded-none border-none flex flex-col")}>
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Users className="size-5 text-primary" /> Session {session.id}</div>
                    <Button onClick={handleLeaveSession} variant="destructive" size="sm" disabled={isSessionLoading}><LogOut className="size-4 mr-2"/> Quitter</Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col p-2 gap-2">
                 <div className={cn("relative w-full rounded-lg overflow-hidden border", isFullscreen ? "flex-grow" : "h-80 mb-4")}>
                    <GoogleMap
                        mapContainerClassName="w-full h-full"
                        center={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: -21.45, lng: 165.5 }}
                        zoom={zoom}
                        onLoad={setMap}
                        options={{ disableDefaultUI: true, zoomControl: true, mapTypeId: mapTypeId }}
                    >
                        {participants?.map(p => p.location && (
                            <OverlayView key={p.id} position={{ lat: p.location.latitude, lng: p.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                    <div className="px-2 pb-0.5 text-[10px] font-bold text-white [text-shadow:0_1px_2px_black] whitespace-nowrap">
                                        {p.displayName} {p.isGibierEnVue ? '⚠️' : ''}
                                    </div>
                                    <div className="p-1.5 rounded-full shadow-lg" style={{ backgroundColor: p.mapColor || '#3b82f6' }}>
                                        {React.createElement(iconMap[p.mapIcon as keyof typeof iconMap] || Navigation, { className: "size-4 text-white" })}
                                    </div>
                                </div>
                            </OverlayView>
                        ))}
                    </GoogleMap>
                    <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-2 left-2 shadow-lg h-9 w-9 z-10">
                        {isFullscreen ? <Shrink /> : <Expand />}
                    </Button>
                </div>
                {!isFullscreen && (
                    <div className="space-y-4">
                        <div className="space-y-4 rounded-lg border p-4">
                            <Label>Surnom</Label>
                            <Input value={nickname} onChange={e => setNickname(e.target.value)} />
                            <Button onClick={handleSavePreferences} size="sm" disabled={isSavingPrefs} className="w-full"><Save className="mr-2 h-4 w-4" /> Sauvegarder</Button>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Participants ({participants?.length || 0})</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {participants?.map(p => (
                                    <div key={p.id} className="flex justify-between items-center text-xs p-2 border rounded">
                                        <span>{p.displayName}</span>
                                        {p.battery && <BatteryIcon level={p.battery.level} charging={p.battery.charging} />}
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
                        <Input placeholder="Code CH-XXXX" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="text-center font-mono" />
                        <Button onClick={handleJoinSession} className="w-full" disabled={isSessionLoading}>Rejoindre</Button>
                    </TabsContent>
                    <TabsContent value="create" className="space-y-4 pt-4">
                        <Input placeholder="Code personnalisé (optionnel)" value={createCode} onChange={e => setCreateCode(e.target.value)} className="text-center font-mono" />
                        <Button onClick={handleCreateSession} className="w-full" disabled={isSessionLoading}>Créer</Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        {mySessions && mySessions.length > 0 && (
            <Card>
                <CardHeader><CardTitle className="text-sm">Mes sessions récentes</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {mySessions.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-2 border rounded text-xs font-mono">
                            <span>{s.id}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSessionFromList(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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
  if (!user) return <Card><CardContent><Alert><AlertCircle /><AlertTitle>Connexion requise</AlertTitle></Alert></CardContent></Card>;
  return <HuntingSessionContent />;
}
