'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  where,
  Timestamp,
  addDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Save, 
  WifiOff, 
  Move, 
  Expand, 
  Shrink, 
  Zap, 
  AlertTriangle,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  History as HistoryIcon,
  MapPin,
  X,
  Play,
  Volume2,
  VolumeX,
  Check,
  Trash2,
  Home,
  RefreshCw,
  Settings,
  Smartphone,
  Bird,
  Target,
  Compass,
  Fish,
  Camera,
  Ghost,
  Users,
  Eye,
  EyeOff,
  Phone,
  Waves,
  History,
  Clock,
  Battery,
  Lock,
  Unlock,
  ShieldCheck
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Polyline, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const WINDY_API_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 20) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 60) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();

  // MODES & NAVIGATION
  const [viewMode, setViewMode] = useState<'alpha' | 'beta' | 'gamma'>('alpha');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [windyMap, setWindyMap] = useState<any>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [wakeLock, setWakeLock] = useState<any>(null);

  // ÉTATS TRACKING
  const [isSharing, setIsSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  
  // ALERTE & SON
  const [activeAlarm, setActiveAlarm] = useState<HTMLAudioElement | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioAuthorized, setAudioAuthorized] = useState(false);

  // REFS STABILITÉ
  const shouldPanOnNextFix = useRef(false); 
  const isSharingRef = useRef(false);
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const startTimeRef = useRef<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const lastTechLogTime = useRef<number>(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isWindyInitializing = useRef(false);

  // IDENTITÉ & FLOTTE
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  // PRÉFÉRENCES AUDIO
  const [vesselPrefs, setVesselPrefs] = useState({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, assistance: true, birds: true },
    notifySounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte', assistance: 'alerte', birds: 'bip' },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20
  });

  // RÉCUPÉRATION DATA
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);

  const userProfileRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const savedVesselIds = useMemo(() => profile?.savedVesselIds || [], [profile?.savedVesselIds]);
  const vesselIdHistory = useMemo(() => profile?.vesselIdHistory || [], [profile?.vesselIdHistory]);
  const fleetIdHistory = useMemo(() => profile?.fleetIdHistory || [], [profile?.fleetIdHistory]);
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true));
    }
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, fleetId, isSharing, sharingId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  // JOURNAUX (LOGS)
  const [techHistory, setTechHistory] = useState<{ status: string, battery: number, accuracy: number, time: Date, duration: string }[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<{ type: string, lat: number, lng: number, time: Date, wind: number, temp: number, photoUrl?: string | null }[]>([]);

  const soundsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // INITIALISATION AUDIO
  const initAudioSystem = useCallback(() => {
    if (!silentAudioRef.current && typeof window !== 'undefined') {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
      audio.loop = true;
      audio.play().then(() => {
        silentAudioRef.current = audio;
        setAudioAuthorized(true);
      }).catch(() => {
        setAudioAuthorized(false);
      });
    }
  }, []);

  const playSound = useCallback((soundId: string, loop: boolean = false) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.loop = loop;
      audio.play().catch(() => {});
      if (loop) setActiveAlarm(audio);
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

  const stopAlarm = useCallback(() => {
    if (activeAlarm) {
      activeAlarm.pause();
      activeAlarm.currentTime = 0;
      setActiveAlarm(null);
      setTechHistory(prev => [{
          status: "ALERTE ARRÊTÉE MANUELLEMENT",
          battery: 0,
          accuracy: 0,
          time: new Date(),
          duration: "STOP MANUEL"
      }, ...prev]);
    }
  }, [activeAlarm]);

  // INITIALISATION WINDY
  const initWindy = useCallback(async () => {
    if (isWindyInitializing.current || windyMap) return;
    isWindyInitializing.current = true;

    const options = {
      key: WINDY_API_KEY,
      lat: currentPos?.lat || INITIAL_CENTER.lat,
      lon: currentPos?.lng || INITIAL_CENTER.lng,
      zoom: 12,
      verbose: false
    };

    const bootSequentially = (retries = 0) => {
        (window as any).windyInit(options, (windyAPI: any) => {
            const { map } = windyAPI;
            setWindyMap(windyAPI);
            isWindyInitializing.current = false;
            
            setTimeout(() => {
                map.invalidateSize();
                if (currentPos) map.setView([currentPos.lat, currentPos.lng], 12);
            }, 800);
        }, (err: any) => {
            if (retries < 3) {
                setTimeout(() => bootSequentially(retries + 1), 2000 * (retries + 1));
            } else {
                isWindyInitializing.current = false;
                toast({ variant: 'destructive', title: "Authentification Windy", description: "Impossible d'autoriser la clé météo." });
            }
        });
    };

    bootSequentially();
  }, [currentPos, windyMap, toast]);

  useEffect(() => {
    if ((viewMode === 'beta' || viewMode === 'gamma') && !windyMap) {
        if ((window as any).windyInit) {
            initWindy();
        } else {
            const script = document.createElement('script');
            script.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
            script.async = true;
            script.onload = initWindy;
            document.head.appendChild(script);
        }
    }
  }, [viewMode, windyMap, initWindy]);

  // GPS WATCHER
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
        return;
    }
    
    setIsInitializing(true);
    shouldPanOnNextFix.current = true;
    if (!startTimeRef.current) startTimeRef.current = new Date();
    isSharingRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed, heading, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, parseFloat(((speed || 0) * 1.94384).toFixed(2)));
            
            setCurrentPos(newPos);
            setCurrentSpeed(Math.round(knotSpeed));
            setCurrentHeading(heading || 0);
            
            const now = Date.now();
            const lastBreadcrumb = lastPosRef.current;
            const distMoved = lastBreadcrumb ? getDistance(latitude, longitude, lastBreadcrumb.lat, lastBreadcrumb.lng) : 10;

            if (distMoved > 2) {
                setBreadcrumbs(prev => {
                    const thirtyMinsAgo = now - 30 * 60 * 1000;
                    return [...prev.filter(p => p.timestamp > thirtyMinsAgo), { lat: latitude, lng: longitude, timestamp: now }];
                });
            }

            if (isFollowMode && googleMap) googleMap.panTo(newPos);

            let nextStatus: VesselStatus['status'] = 'moving';
            if (knotSpeed < 0.2) {
                nextStatus = 'stationary';
            } else if (knotSpeed > 0.5 && anchorPos) {
                const distFromAnchor = getDistance(latitude, longitude, anchorPos.lat, anchorPos.lng);
                if (distFromAnchor > mooringRadius) {
                    nextStatus = 'drifting';
                    if (!activeAlarm) playSound(vesselPrefs.notifySounds.stationary || 'alerte', true);
                }
            }

            if (now - lastTechLogTime.current > 60000 || nextStatus !== vesselStatusRef.current) {
                const elapsedMin = startTimeRef.current ? differenceInMinutes(new Date(), startTimeRef.current) : 0;
                const hours = Math.floor(elapsedMin / 60);
                const mins = elapsedMin % 60;
                
                setTechHistory(prev => [{
                    status: nextStatus.toUpperCase(),
                    battery: 100, 
                    accuracy: Math.round(accuracy),
                    time: new Date(),
                    duration: `ACTIF ${hours}H ${mins}MIN`
                }, ...prev].slice(0, 50));
                lastTechLogTime.current = now;
            }

            lastPosRef.current = newPos;
            vesselStatusRef.current = nextStatus;
            setVesselStatus(nextStatus);
            
            const updatePayload: Partial<VesselStatus> = { 
                location: { latitude, longitude }, 
                status: nextStatus, 
                accuracy: Math.round(accuracy),
                isSharing: true,
                lastActive: serverTimestamp()
            };
            setDoc(doc(firestore!, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});

            setIsInitializing(false);
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, mooringRadius, anchorPos, toast, googleMap, isFollowMode, playSound, vesselPrefs.notifySounds.stationary, activeAlarm, sharingId, firestore]);

  const handleStartSharing = async () => {
    initAudioSystem();
    if (!sharingId) { toast({ variant: 'destructive', title: "ID Navire requis" }); return; }
    
    if (user && firestore) {
        await updateDoc(doc(firestore, 'users', user.uid), {
            vesselIdHistory: arrayUnion(sharingId),
            fleetIdHistory: customFleetId ? arrayUnion(customFleetId) : fleetIdHistory,
            lastVesselId: sharingId
        });
    }
    
    setIsSharing(true);
    toast({ title: "Partage actif", description: `ID: ${sharingId}` });
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    isSharingRef.current = false;
    
    await updateDoc(doc(firestore, 'vessels', sharingId), { 
        isSharing: false, 
        lastActive: serverTimestamp()
    });

    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    setCurrentPos(null);
    setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    if (st === 'stationary' && currentPos) setAnchorPos(currentPos);
    else if (st === 'moving') setAnchorPos(null);
    setVesselStatus(st);
    vesselStatusRef.current = st;
    
    if (firestore) {
        updateDoc(doc(firestore, 'vessels', sharingId), { 
            status: st, 
            eventLabel: label || null,
            statusChangedAt: serverTimestamp() 
        }).catch(() => {});
    }
    toast({ title: label || "Statut mis à jour" });
  };

  const addTacticalMarker = async (type: string, photoUrl?: string) => {
    if (!currentPos) return;
    
    const weather = await fetchWindyWeather(currentPos.lat, currentPos.lng);
    const elapsedMin = startTimeRef.current ? differenceInMinutes(new Date(), startTimeRef.current) : 0;
    const hours = Math.floor(elapsedMin / 60);
    const mins = elapsedMin % 60;

    const marker = {
        type,
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date(),
        wind: weather.windSpeed || 0,
        temp: weather.temp || 0,
        photoUrl,
        duration: `ACTIF ${hours}H ${mins}M`
    };

    setTacticalHistory(prev => [marker, ...prev].slice(0, 50));
    
    if (firestore && isSharing) {
        await addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), {
            ...marker,
            time: serverTimestamp()
        });
    }
    
    toast({ title: `Signalement ${type}`, description: `Vent: ${marker.wind} nds` });
    playSound(vesselPrefs.notifySounds.birds || 'bip');
  };

  const sendEmergencySms = (type: 'MAYDAY' | 'PANPAN' | 'SOS') => {
    if (!emergencyContact) { toast({ variant: 'destructive', title: "Numéro requis", description: "Réglez votre contact d'urgence." }); return; }
    
    const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat},${currentPos.lng}` : "[GPS INCONNU]";
    const body = `[${type}] ${vesselNickname || sharingId} : ${vesselSmsMessage || "DEMANDE ASSISTANCE"}. Position : ${posUrl}`;
    
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    handleManualStatus('emergency', type);
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {activeAlarm && (
          <Button variant="destructive" className="fixed top-12 left-4 right-4 z-[300] h-16 font-black uppercase text-sm animate-pulse shadow-2xl border-4 border-white" onClick={stopAlarm}>
              <VolumeX className="size-6 mr-3" /> ARRÊTER LE SON (ALARME ACTIVE)
          </Button>
      )}

      {!audioAuthorized && (
          <Alert className="bg-primary/10 border-primary/20 animate-in fade-in z-[200]">
              <Zap className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-black uppercase">Interagissez avec la page pour autoriser les alertes sonores.</AlertDescription>
          </Alert>
      )}

      <div className="flex bg-muted/30 p-1 rounded-xl border z-20 relative">
          <Button variant={viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setViewMode('alpha')}>Alpha (Maps)</Button>
          <Button variant={viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setViewMode('beta')}>Béta (Météo)</Button>
          <Button variant={viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setViewMode('gamma')}>Gamma (Windy)</Button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <div id="windy" className={cn("absolute inset-0 z-10", viewMode === 'alpha' && "hidden pointer-events-none")}></div>
        
        <GoogleMap
            mapContainerClassName={cn("w-full h-full", viewMode === 'gamma' && "hidden")}
            defaultCenter={INITIAL_CENTER}
            defaultZoom={12}
            onLoad={setGoogleMap}
            onDragStart={() => setIsFollowMode(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
        >
            {breadcrumbs.length > 1 && (
                <Polyline path={breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 3 }} />
            )}
            {currentPos && (
                <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: `translate(-50%, -50%) rotate(${currentHeading}deg)` }} className="relative">
                        <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                        <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
                            <Navigation className="size-3 text-white fill-white" />
                        </div>
                    </div>
                </OverlayView>
            )}
            {anchorPos && (
                <OverlayView position={anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500/80 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                        <Anchor className="size-4 text-white" />
                    </div>
                </OverlayView>
            )}
            {anchorPos && <Circle center={anchorPos} radius={mooringRadius} options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }} />}
        </GoogleMap>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[200]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[200]">
            <Button onClick={() => setIsFollowMode(!isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl", isFollowMode ? "bg-primary text-white" : "bg-white text-slate-400")}>
                {isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!isFollowMode && (
                <Button onClick={() => { setIsFollowMode(true); googleMap?.panTo(currentPos!); }} className="bg-white border-2 shadow-xl h-10 px-3 font-black text-[9px] uppercase text-primary gap-2">
                    <LocateFixed className="size-4" /> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-20">
          <div className="flex flex-col gap-3">
              {isSharing ? (
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-indigo-50 text-indigo-700" onClick={() => handleManualStatus('returning')}>
                              <Navigation className="size-4 mr-2" /> Retour Maison
                          </Button>
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-green-50 text-green-700" onClick={() => handleManualStatus('landed')}>
                              <Home className="size-4 mr-2" /> Home (À terre)
                          </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                          <Button variant="destructive" className="h-14 font-black uppercase text-[10px] shadow-lg" onClick={() => sendEmergencySms('MAYDAY')}>MAYDAY</Button>
                          <Button variant="secondary" className="h-14 font-black uppercase text-[10px] border-2 border-orange-200 text-orange-700" onClick={() => sendEmergencySms('PANPAN')}>PANPAN</Button>
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-red-50 text-red-600 animate-pulse" onClick={() => handleManualStatus('emergency', 'ASSISTANCE')}>ASSISTANCE</Button>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                          <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] bg-slate-50 border-2" onClick={() => addTacticalMarker('OISEAUX')}><Bird className="size-4" /> OISEAUX</Button>
                          <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] bg-red-50 border-2 border-red-100" onClick={() => addTacticalMarker('THON')}><Target className="size-4 text-red-600" /> THON</Button>
                          <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] bg-emerald-50 border-2 border-emerald-100" onClick={() => addTacticalMarker('TAZARD')}><Fish className="size-4 text-emerald-600" /> TAZARD</Button>
                          <Button variant="secondary" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => photoInputRef.current?.click()}><Camera className="size-4" /> PHOTO</Button>
                          <input type="file" accept="image/*" capture="environment" className="hidden" ref={photoInputRef} onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => addTacticalMarker('PRISE', ev.target?.result as string);
                                  reader.readAsDataURL(file);
                              }
                          }} />
                      </div>

                      <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl" onClick={handleStopSharing}>
                          <X className="size-5 mr-2" /> Arrêter le partage
                      </Button>
                  </div>
              ) : (
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                      <CardHeader className="bg-primary/5 p-4 border-b">
                          <CardTitle className="text-xs font-black uppercase flex items-center gap-2"><Smartphone className="size-4" /> Identité & IDs</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase opacity-60">Mon Surnom</Label>
                              <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="CAPITAINE..." className="h-11 border-2 font-black uppercase" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60">ID Navire</Label>
                                  <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="ID UNIQUE..." className="h-11 border-2 font-black uppercase" />
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60">ID Flotte C</Label>
                                  <Input value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} placeholder="GROUPE..." className="h-11 border-2 font-black uppercase" />
                              </div>
                          </div>
                          
                          {(vesselIdHistory.length > 0 || fleetIdHistory.length > 0) && (
                              <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-2">
                                  <p className="text-[8px] font-black uppercase text-muted-foreground ml-1">Historique des IDs</p>
                                  <div className="flex flex-wrap gap-1.5">
                                      {vesselIdHistory.slice(-5).map(id => (
                                          <Badge key={id} variant="outline" className="bg-white text-[8px] font-black uppercase cursor-pointer hover:bg-primary/10" onClick={() => setCustomSharingId(id)}>{id}</Badge>
                                      ))}
                                      {fleetIdHistory.slice(-5).map(fid => (
                                          <Badge key={fid} variant="secondary" className="text-[8px] font-black uppercase cursor-pointer hover:bg-indigo-100" onClick={() => setCustomFleetId(fid)}>{fid}</Badge>
                                      ))}
                                  </div>
                              </div>
                          )}

                          <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl rounded-xl" onClick={handleStartSharing}>Lancer le Partage</Button>
                      </CardContent>
                  </Card>
              )}
          </div>

          <Card className="border-2 shadow-lg rounded-2xl overflow-hidden flex flex-col h-full bg-white">
              <Tabs defaultValue="tactical" className="flex flex-col h-full">
                  <TabsList className="grid grid-cols-2 h-12 rounded-none bg-muted/30 border-b p-1">
                      <TabsTrigger value="tactical" className="font-black uppercase text-[10px] gap-2"><MapPin className="size-3"/> Tactique</TabsTrigger>
                      <TabsTrigger value="tech" className="font-black uppercase text-[10px] gap-2"><Settings className="size-3"/> Technique</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tactical" className="flex-1 p-0 m-0">
                      <ScrollArea className="h-[280px]">
                          <div className="p-3 space-y-2">
                              {tacticalHistory.length > 0 ? tacticalHistory.map((log, i) => (
                                  <div key={i} onClick={() => googleMap?.panTo({ lat: log.lat, lng: log.lng })} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between cursor-pointer active:scale-95 transition-all shadow-sm">
                                      <div className="flex items-center gap-3">
                                          {log.photoUrl ? (
                                              <div className="size-10 rounded-lg border overflow-hidden"><img src={log.photoUrl} className="size-full object-cover" alt=""/></div>
                                          ) : (
                                              <div className="p-2 bg-muted rounded-lg"><History className="size-4 opacity-40"/></div>
                                          )}
                                          <div className="flex flex-col">
                                              <span className="font-black text-xs uppercase text-primary">{log.type}</span>
                                              <span className="text-[8px] font-bold opacity-40 uppercase">{format(log.time, 'HH:mm:ss')}</span>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[9px] font-black uppercase text-blue-600">{log.wind} ND</p>
                                          <p className="text-[9px] font-black uppercase text-orange-600">{log.temp}°C</p>
                                      </div>
                                  </div>
                              )) : (
                                  <div className="p-12 text-center border-2 border-dashed rounded-2xl opacity-20"><HistoryIcon className="size-8 mx-auto mb-2"/><p className="text-[10px] font-black uppercase">Aucun événement</p></div>
                              )}
                          </div>
                      </ScrollArea>
                  </TabsContent>
                  <TabsContent value="tech" className="flex-1 p-0 m-0">
                      <ScrollArea className="h-[280px]">
                          <div className="p-3 space-y-2">
                              {techHistory.map((log, i) => (
                                  <div key={i} className="p-3 bg-slate-50 border-2 rounded-xl flex items-center justify-between">
                                      <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                              <span className={cn("font-black text-[10px] uppercase", 
                                                  log.status.includes('DÉRIVE') || log.status.includes('ALERTE') ? 'text-red-600' : 'text-slate-800'
                                              )}>{log.status}</span>
                                              <Badge variant="outline" className="text-[8px] h-4 font-bold border-slate-200">{log.duration}</Badge>
                                          </div>
                                          <span className="text-[8px] font-bold opacity-40 uppercase mt-1">{format(log.time, 'dd/MM HH:mm:ss')}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <div className="flex flex-col items-end gap-0.5">
                                              <div className="flex items-center gap-1 text-[9px] font-black text-slate-500"><Battery className="size-2.5"/> {log.battery}%</div>
                                              <div className="text-[8px] font-bold text-slate-400">+/- {log.accuracy}m</div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </ScrollArea>
                  </TabsContent>
              </Tabs>
          </Card>
      </div>

      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="settings" className="border-none">
              <AccordionTrigger className="h-12 bg-muted/30 px-4 rounded-xl border-2 hover:no-underline">
                  <div className="flex items-center gap-2 font-black uppercase text-[10px]"><Settings className="size-4" /> Réglages Notifications & Veille</div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <Card className="border-2 p-4 space-y-4 bg-card shadow-inner">
                      <div className="space-y-3">
                          <div className="flex justify-between items-center">
                              <Label className="text-[10px] font-black uppercase opacity-60">Volume Global</Label>
                              <span className="text-[10px] font-black">{Math.round(vesselPrefs.vesselVolume * 100)}%</span>
                          </div>
                          <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => setVesselPrefs({...vesselPrefs, vesselVolume: v[0] / 100})} />
                      </div>
                      <div className="grid gap-3 pt-2 border-t border-dashed">
                          {Object.keys(vesselPrefs.notifySettings).map(key => (
                              <div key={key} className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase">{key}</span>
                                  <div className="flex items-center gap-2">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playSound(vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds])}><Play className="size-3" /></Button>
                                      <Switch checked={vesselPrefs.notifySettings[key as keyof typeof vesselPrefs.notifySettings]} onCheckedChange={v => setVesselPrefs({...vesselPrefs, notifySettings: {...vesselPrefs.notifySettings, [key]: v}})} />
                                  </div>
                              </div>
                          ))}
                      </div>
                      <Button className="w-full h-10 font-black uppercase text-[9px] tracking-widest border-2" variant="outline" onClick={() => updateDoc(doc(firestore!, 'users', user!.uid), { vesselPrefs })}>Sauvegarder Sons</Button>
                  </Card>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      <div className="space-y-2 relative z-10">
          <Card className="border-2 shadow-sm bg-muted/5">
              <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Phone className="size-3" /> Annuaire Maritime NC</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</p><p className="text-xs font-black">COSS Mer : 16</p><p className="text-xs font-black">SAMU Terre : 15</p></div>
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</p><p className="text-xs font-black">Météo Marine : 36 67 36</p></div>
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">Ports</p><p className="text-xs font-black">VHF 12 / 16</p></div>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
