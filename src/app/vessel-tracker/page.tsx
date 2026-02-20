
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
  arrayUnion,
  addDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  Layers,
  CloudSun
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const WINDY_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';

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

  // APP MODES
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [viewMode, setViewMode] = useState<'alpha' | 'beta' | 'gamma'>('alpha');
  
  // TRACKING STATES
  const [isSharing, setIsSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);

  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  
  // WINDY STATES
  const [windyLayer, setWindyLayer] = useState<'wind' | 'waves' | 'radar'>('wind');
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);
  const windyAPI = useRef<any>(null);
  const windyStore = useRef<any>(null);
  const windyLeafletMap = useRef<any>(null);
  const isWindyInitializing = useRef(false);
  const windyRetryCount = useRef(0);

  // REFS FOR STABILITY
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const isSharingRef = useRef(false);
  const anchorPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdatePosRef = useRef<{ lat: number, lng: number } | null>(null);
  const lowSpeedStartTime = useRef<number | null>(null);

  // IDENTITY
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(100);
  
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  // LOGS & DEBOUNCE
  const [technicalLogs, setTechnicalLogs] = useState<any[]>([]);
  const logsDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [selectedMarkerPhoto, setSelectedMarkerPhoto] = useState<string | null>(null);
  
  // AUDIO
  const [vesselPrefs, setVesselPrefs] = useState({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte' },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20
  });
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAnyAudioPlaying, setIsAnyAudioPlaying] = useState(false);

  // Sync Refs
  const vesselNicknameRef = useRef('');
  useEffect(() => { vesselNicknameRef.current = vesselNickname; }, [vesselNickname]);
  const isGhostModeRef = useRef(false);
  useEffect(() => { isGhostModeRef.current = isGhostMode; }, [isGhostMode]);
  const mooringRadiusRef = useRef(100);
  useEffect(() => { mooringRadiusRef.current = mooringRadius; }, [mooringRadius]);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);

  const sharingId = useMemo(() => {
    return (customSharingId.trim() || user?.uid || '').toUpperCase();
  }, [customSharingId, user?.uid]);

  const fleetId = useMemo(() => {
    return customFleetId.trim().toUpperCase();
  }, [customFleetId]);

  const userProfileRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const memoizedSavedVesselIds = useMemo(() => profile?.savedVesselIds || [], [profile?.savedVesselIds]);
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (mode === 'fleet' && fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true));
    }
    const queryIds = [...memoizedSavedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, memoizedSavedVesselIds, mode, fleetId, isSharing, sharingId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // --- LOGIQUE WINDY AVEC RETRY & 401 FIX ---
  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || viewMode === 'alpha' || isWindyInitializing.current) return;

    const bootSequentially = async () => {
        isWindyInitializing.current = true;
        const check = () => typeof (window as any).L !== 'undefined' && typeof (window as any).windyInit !== 'undefined';
        let attempts = 0;
        while (!check() && attempts < 50) { await new Promise(r => setTimeout(r, 200)); attempts++; }

        if (check()) {
            const options = {
                key: WINDY_KEY,
                lat: currentPos?.lat || INITIAL_CENTER.lat,
                lon: currentPos?.lng || INITIAL_CENTER.lng,
                zoom: googleMap?.getZoom() || 12,
                layer: windyLayer,
            };

            try {
                (window as any).windyInit(options, (windyApi: any) => {
                    const { map, store } = windyApi;
                    windyAPI.current = windyApi;
                    windyStore.current = store;
                    windyLeafletMap.current = map;
                    setIsWindyLoaded(true);
                    isWindyInitializing.current = false;
                    windyRetryCount.current = 0;
                    
                    googleMap?.addListener('idle', () => {
                        if (viewMode === 'beta' && windyLeafletMap.current) {
                            const center = googleMap.getCenter();
                            if (center) windyLeafletMap.current.setView([center.lat(), center.lng()], googleMap.getZoom());
                        }
                    });
                });
            } catch (err) {
                console.error("Windy Init Error:", err);
                if (windyRetryCount.current < 3) {
                    windyRetryCount.current++;
                    isWindyInitializing.current = false;
                    setTimeout(initWindy, 2000 * windyRetryCount.current);
                }
            }
        } else {
            isWindyInitializing.current = false;
        }
    };
    bootSequentially();
  }, [viewMode, currentPos, googleMap, windyLayer]);

  useEffect(() => {
    if (viewMode !== 'alpha' && !isWindyLoaded) {
        const lScript = document.createElement('script');
        lScript.src = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js';
        lScript.async = true;
        document.head.appendChild(lScript);

        const wScript = document.createElement('script');
        wScript.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
        wScript.async = true;
        document.head.appendChild(wScript);

        lScript.onload = () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.css';
            document.head.appendChild(link);
        };
        wScript.onload = () => initWindy();
    }
  }, [viewMode, isWindyLoaded, initWindy]);

  useEffect(() => {
    if (isWindyLoaded && windyStore.current) {
        windyStore.current.set('overlay', windyLayer);
    }
  }, [windyLayer, isWindyLoaded]);

  // --- TRACKING CORE AVEC FILTRAGE FIRESTORE ---
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharingRef.current && data.isSharing !== false)) return;
    
    // Filtrage des écritures : ne déclencher que si changement significatif
    const isMajorChange = data.status || data.isSharing === false || data.eventLabel;
    let distMoved = 0;
    if (data.location && lastUpdatePosRef.current) {
        distMoved = getDistance(data.location.latitude, data.location.longitude, lastUpdatePosRef.current.lat, lastUpdatePosRef.current.lng);
    }

    if (!isMajorChange && distMoved < 5) return;

    const update = async () => {
        let batteryInfo = {};
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNicknameRef.current || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharingRef.current, 
            lastActive: serverTimestamp(),
            fleetId: customFleetId || null,
            isGhostMode: isGhostModeRef.current,
            mooringRadius: mooringRadiusRef.current,
            ...batteryInfo,
            ...data 
        };

        if (data.status && lastSentStatusRef.current !== data.status) {
            updatePayload.statusChangedAt = serverTimestamp();
            lastSentStatusRef.current = data.status;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
        if (data.location) lastUpdatePosRef.current = { lat: data.location.latitude, lng: data.location.longitude };
    };
    update();
  }, [user, firestore, sharingId, customFleetId]);

  const stopAllAudio = useCallback(() => {
    if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null; }
    setIsAnyAudioPlaying(false);
  }, []);

  const handleStopSharing = useCallback(async () => {
    setIsSharing(false);
    isSharingRef.current = false;
    setIsInitializing(false);
    startTimeRef.current = null;
    stopAllAudio();
    
    if (user && firestore) {
        await updateDoc(doc(firestore, 'vessels', sharingId), { 
            isSharing: false, 
            lastActive: serverTimestamp()
        }).catch(() => {});
    }

    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    lastSentStatusRef.current = null;
    toast({ title: "Partage arrêté" });
  }, [user, firestore, stopAllAudio, toast, sharingId]);

  // LOGIQUE DE DÉRIVE (VITESSE & DISTANCE)
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    setIsInitializing(true);
    startTimeRef.current = new Date();

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, parseFloat(((speed || 0) * 1.94384).toFixed(2)));
            
            setCurrentPos(newPos);
            setCurrentSpeed(Math.round(knotSpeed));
            
            let nextStatus: VesselStatus['status'] = vesselStatusRef.current;
            let eventLabel: string | null = null;

            // Logique de vitesse précise
            if (knotSpeed < 0.2) {
                if (!lowSpeedStartTime.current) lowSpeedStartTime.current = Date.now();
                // Si immobile depuis 1 min -> AU MOUILLAGE
                if (Date.now() - lowSpeedStartTime.current > 60000 && vesselStatusRef.current !== 'stationary') {
                    nextStatus = 'stationary';
                    eventLabel = 'AU MOUILLAGE (VITESSE < 0.2)';
                }
            } else {
                lowSpeedStartTime.current = null;
                // Si vitesse > 0.5 et hors du cercle -> À LA DÉRIVE
                if (knotSpeed > 0.5 && anchorPosRef.current) {
                    const distToAnchor = getDistance(newPos.lat, newPos.lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
                    if (distToAnchor > 20 && vesselStatusRef.current !== 'drifting') {
                        nextStatus = 'drifting';
                        eventLabel = 'À LA DÉRIVE ! (VITESSE > 0.5)';
                    }
                }
                // Si vitesse > 2.0 -> EN MOUVEMENT
                if (knotSpeed > 2.0 && vesselStatusRef.current !== 'moving') {
                    nextStatus = 'moving';
                    eventLabel = 'EN MOUVEMENT';
                    setAnchorPos(null);
                    anchorPosRef.current = null;
                }
            }

            if (nextStatus !== vesselStatusRef.current || eventLabel) {
                if (logsDebounceTimer.current) clearTimeout(logsDebounceTimer.current);
                logsDebounceTimer.current = setTimeout(() => {
                    const duration = startTimeRef.current ? differenceInMinutes(new Date(), startTimeRef.current) : 0;
                    setTechnicalLogs(prev => [{
                        vesselName: vesselNicknameRef.current || 'Mon Navire',
                        statusLabel: eventLabel || nextStatus.toUpperCase(),
                        time: new Date(),
                        duration: `ACTIF ${duration} MIN`,
                        accuracy: Math.round(accuracy)
                    }, ...prev].slice(0, 50));
                }, 500);

                updateVesselInFirestore({ 
                    location: { latitude, longitude }, 
                    status: nextStatus, 
                    eventLabel, 
                    accuracy: Math.round(accuracy) 
                });

                vesselStatusRef.current = nextStatus;
                setVesselStatus(nextStatus);
            } else {
                // Mise à jour périodique de position
                updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
            }
        },
        () => toast({ variant: 'destructive', title: "GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, toast, updateVesselInFirestore]);

  const handleTacticalReport = async (type: string) => {
    if (!currentPos || !isSharing) return;
    const weather = await fetchWindyWeather(currentPos.lat, currentPos.lng);
    const log = {
        type, lat: currentPos.lat, lng: currentPos.lng, 
        time: new Date().toISOString(),
        wind: weather.success ? weather.windSpeed : null, 
        temp: weather.success ? weather.temp : null
    };
    await updateDoc(doc(firestore!, 'vessels', sharingId), { 
        huntingMarkers: arrayUnion({ ...log, id: Math.random().toString(36).substring(7) }) 
    });
    toast({ title: `Point ${type} épinglé !`, description: weather.success ? `${weather.windSpeed} nds / ${weather.temp}°C` : '' });
  };

  return (
    <div className="w-full space-y-4 pb-32">
      <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('fleet')}>Flotte (C)</Button>
      </div>

      <div className={cn("text-white p-4 rounded-2xl shadow-lg border relative overflow-hidden transition-all", vesselStatus === 'drifting' ? "bg-red-600 animate-pulse" : "bg-slate-900")}>
          <div className="flex justify-between items-center relative z-10">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-xl"><Navigation className="size-6" /></div>
                  <div>
                      <h2 className="text-[10px] font-black uppercase tracking-widest">{isInitializing ? 'INITIALISATION...' : vesselStatus.toUpperCase()}</h2>
                      <p className="text-2xl font-black">{currentSpeed} <span className="text-xs opacity-60">KTS</span></p>
                  </div>
              </div>
              <div className="text-right">
                  <span className="text-[8px] font-black uppercase text-white/40">ID ACTIF</span>
                  <p className="text-sm font-mono font-black">{sharingId}</p>
              </div>
          </div>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-950", isFullscreen ? "fixed inset-0 z-[150]" : "h-[500px]")}>
        <div id="windy" className={cn("absolute inset-0 z-10 transition-opacity", viewMode === 'alpha' ? "opacity-0 pointer-events-none" : "")} style={{ opacity: viewMode === 'beta' ? 0.6 : 1 }} />
        <GoogleMap
            mapContainerClassName="w-full h-full"
            defaultCenter={INITIAL_CENTER}
            defaultZoom={12}
            onLoad={setGoogleMap}
            options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
        >
            {currentPos && (
                <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" style={{ transform: 'translate(-50%, -50%)' }} />
                </OverlayView>
            )}
            {followedVessels?.map(v => v.id !== sharingId && v.location && (
                <OverlayView key={v.id} position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <Badge className="bg-slate-900/90 text-white border-white/20 whitespace-nowrap">{v.displayName || v.id}</Badge>
                        <div className="p-1.5 rounded-full bg-primary border-2 border-white shadow-xl"><Navigation className="size-4 text-white" /></div>
                    </div>
                </OverlayView>
            ))}
        </GoogleMap>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border-2 shadow-xl">
                <Button variant={viewMode === 'alpha' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('alpha')}>Alpha</Button>
                <Button variant={viewMode === 'beta' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('beta')}>Béta</Button>
                <Button variant={viewMode === 'gamma' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('gamma')}>Gamma</Button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 shadow-lg bg-muted/5">
              <CardHeader className="p-4 border-b bg-muted/10"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Target className="size-4" /> Signalement Tactique</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleTacticalReport('MARLIN')}><Fish className="size-4 text-blue-600" /> MARLIN</Button>
                  <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleTacticalReport('THON')}><Fish className="size-4 text-red-600" /> THON</Button>
                  <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleTacticalReport('OISEAUX')}><Bird className="size-4 text-orange-600" /> OISEAUX</Button>
                  <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleTacticalReport('PRISE')}><Camera className="size-4 text-purple-600" /> PRISE</Button>
              </CardContent>
          </Card>

          <Card className="border-2 shadow-sm overflow-hidden h-full">
              <CardHeader className="p-4 border-b bg-muted/5"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><HistoryIcon className="size-3" /> Journal de bord</CardTitle></CardHeader>
              <CardContent className="p-0">
                  <Tabs defaultValue="technique">
                      <TabsList className="grid w-full grid-cols-2 h-10 border-b rounded-none">
                          <TabsTrigger value="technique" className="text-[10px] font-black uppercase">Technique</TabsTrigger>
                          <TabsTrigger value="tactique" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                      </TabsList>
                      <TabsContent value="technique" className="m-0">
                        <ScrollArea className="h-64">
                            <div className="divide-y">
                                {technicalLogs.map((h, i) => (
                                    <div key={i} className="p-3 flex items-center justify-between text-[10px]">
                                        <div className="flex flex-col">
                                            <span className="font-black text-primary uppercase">{h.statusLabel}</span>
                                            <span className="text-[8px] font-bold opacity-40 uppercase">{format(h.time, 'HH:mm')} • {h.duration}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[8px] font-black">Acc: {h.accuracy}m</Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="tactique" className="m-0">
                        <ScrollArea className="h-64">
                            <div className="p-10 text-center opacity-20"><Fish className="size-10 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Aucune prise enregistrée</p></div>
                        </ScrollArea>
                      </TabsContent>
                  </Tabs>
              </CardContent>
          </Card>
      </div>

      <div className="flex flex-col gap-3">
          {isSharing ? (
              <Button variant="destructive" className="w-full h-16 font-black uppercase shadow-xl rounded-2xl border-4 border-white/20 gap-3" onClick={handleStopSharing}>
                  <X className="size-6" /> ARRÊTER LE PARTAGE
              </Button>
          ) : (
              <Button className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3" onClick={() => setIsSharing(true)}>
                  <Navigation className="size-6" /> LANCER PARTAGE
              </Button>
          )}
      </div>
    </div>
  );
}
