
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Lock,
  Unlock,
  Waves,
  Phone,
  AlertCircle,
  BellRing
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle, Polyline } from '@react-google-maps/api';
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
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
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
  const lastActivityTimeRef = useRef<number>(Date.now());
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
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (mode === 'fleet' && fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true));
    }
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, mode, fleetId, isSharing, sharingId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

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

    const bootWindy = (retries = 0) => {
        (window as any).windyInit(options, (windyAPI: any) => {
            const { map } = windyAPI;
            setWindyMap(windyAPI);
            isWindyInitializing.current = false;
            
            setTimeout(() => {
                map.invalidateSize();
                if (currentPos) map.setView([currentPos.lat, currentPos.lng], 12);
            }, 800);
        }, (err: any) => {
            console.error("Windy Auth Error:", err);
            if (retries < 3) {
                setTimeout(() => bootWindy(retries + 1), 2000 * (retries + 1));
            } else {
                isWindyInitializing.current = false;
                toast({ variant: 'destructive', title: "Erreur Météo", description: "Impossible d'autoriser Windy." });
            }
        });
    };

    bootWindy();
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

  // SYNCHRONISATION MAPS
  useEffect(() => {
    if (!googleMap || !windyMap || viewMode !== 'beta') return;
    const gMap = googleMap;
    const wMap = windyMap.map;

    const sync = () => {
        const center = gMap.getCenter();
        const zoom = gMap.getZoom();
        if (center && zoom) {
            wMap.setView([center.lat(), center.lng()], zoom, { animate: false });
        }
    };

    const listener = gMap.addListener('idle', sync);
    return () => google.maps.event.removeListener(listener);
  }, [googleMap, windyMap, viewMode]);

  // CORE TRACKING LOGIC
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharingRef.current && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo = { batteryLevel: 100, isCharging: false };
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharingRef.current, 
            lastActive: serverTimestamp(),
            fleetId: customFleetId || null,
            isGhostMode: isGhostMode,
            ...batteryInfo,
            ...data 
        };

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});

        // Journal Technique Auto (60s)
        const now = Date.now();
        if (now - lastTechLogTime.current > 60000) {
            const duration = startTimeRef.current ? differenceInMinutes(new Date(), startTimeRef.current) : 0;
            const logEntry = {
                status: data.status || vesselStatusRef.current,
                battery: batteryInfo.batteryLevel,
                accuracy: data.accuracy || 0,
                time: new Date(),
                duration: `ACTIF ${duration} MIN`
            };
            setTechHistory(prev => [logEntry, ...prev].slice(0, 50));
            lastTechLogTime.current = now;
        }
    };
    update();
  }, [user, firestore, sharingId, customFleetId, vesselNickname, isGhostMode]);

  // GPS WATCHER
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
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
            
            if (knotSpeed > 0.5) lastActivityTimeRef.current = Date.now();

            // Breadcrumbs
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

            lastPosRef.current = newPos;
            vesselStatusRef.current = nextStatus;
            setVesselStatus(nextStatus);
            updateVesselInFirestore({ location: { latitude, longitude }, status: nextStatus, accuracy: Math.round(accuracy) });
            setIsInitializing(false);
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, mooringRadius, anchorPos, toast, updateVesselInFirestore, googleMap, isFollowMode, playSound, vesselPrefs.notifySounds.stationary, activeAlarm]);

  const handleStartSharing = async () => {
    initAudioSystem();
    if (!sharingId) { toast({ variant: 'destructive', title: "ID Navire requis" }); return; }
    setIsSharing(true);
    toast({ title: "Partage actif", description: `ID: ${sharingId}` });
  };

  const handleTacticalEvent = async (label: string, photo?: string | null) => {
    if (!firestore || !currentPos || !isSharing) return;
    playSound(vesselPrefs.notifySounds.birds || 'sonar');
    
    let weatherInfo = { wind: 0, temp: 0 };
    try {
        const windyData = await fetchWindyWeather(currentPos.lat, currentPos.lng);
        if (windyData.success) { weatherInfo = { wind: windyData.windSpeed, temp: windyData.temp }; }
    } catch (e) {}

    const newTacticalLog = {
        type: label, photoUrl: photo || null, lat: currentPos.lat, lng: currentPos.lng,
        time: new Date(), wind: weatherInfo.wind, temp: weatherInfo.temp
    };

    setTacticalHistory(prev => [newTacticalLog, ...prev].slice(0, 50));
    updateVesselInFirestore({ eventLabel: label });
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    if (st === 'stationary' && currentPos) setAnchorPos(currentPos);
    else if (st === 'moving') setAnchorPos(null);
    setVesselStatus(st);
    vesselStatusRef.current = st;
    updateVesselInFirestore({ status: st, eventLabel: label || null });
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {activeAlarm && (
          <Button variant="destructive" className="fixed top-12 left-4 right-4 z-[300] h-16 font-black uppercase text-sm animate-pulse shadow-2xl border-4 border-white" onClick={stopAlarm}>
              <VolumeX className="size-6 mr-3" /> ARRÊTER LE SON (ALARME ACTIVE)
          </Button>
      )}

      {!audioAuthorized && (
          <Alert className="bg-primary/10 border-primary/20 animate-in fade-in">
              <Zap className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-black uppercase">Interagissez avec la page pour autoriser les alertes sonores.</AlertDescription>
          </Alert>
      )}

      <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setViewMode('alpha')}>Alpha (Maps)</Button>
          <Button variant={viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setViewMode('beta')}>Béta (Météo)</Button>
          <Button variant={viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setViewMode('gamma')}>Gamma (Full)</Button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <div id="windy" className={cn("absolute inset-0 z-10", viewMode === 'alpha' && "hidden pointer-events-none")}></div>
        
        <GoogleMap
            mapContainerClassName={cn("w-full h-full", viewMode === 'gamma' && "hidden")}
            defaultCenter={INITIAL_CENTER}
            defaultZoom={12}
            onLoad={(m) => { setGoogleMap(m); setTimeout(() => google.maps.event.trigger(m, 'resize'), 800); }}
            onDragStart={() => setIsFollowMode(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
        >
            {breadcrumbs.length > 1 && (
                <Polyline path={breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 3 }} />
            )}
            {currentPos && (
                <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -50%) rotate('+currentHeading+'deg)' }} className="relative">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 shadow-sm overflow-hidden">
              <CardHeader className="p-4 bg-muted/10 border-b">
                  <CardTitle className="text-xs font-black uppercase flex items-center gap-2">Journal de Bord</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                  <Tabs defaultValue="technique">
                      <TabsList className="grid w-full grid-cols-2 h-10 border-b rounded-none">
                          <TabsTrigger value="technique" className="text-[10px] font-black uppercase">Tech</TabsTrigger>
                          <TabsTrigger value="tactique" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                      </TabsList>
                      <TabsContent value="technique" className="m-0">
                          <ScrollArea className="h-64 p-3">
                              {techHistory.map((log, i) => (
                                  <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl border-2 mb-2 text-[9px] font-bold">
                                      <div className="flex flex-col">
                                          <span className="font-black uppercase">{log.status}</span>
                                          <span className="text-primary">{log.duration}</span>
                                      </div>
                                      <div className="flex items-center gap-2 opacity-60">
                                          <span>{format(log.time, 'HH:mm:ss')}</span>
                                          <span>{log.battery}%🔋</span>
                                      </div>
                                  </div>
                              ))}
                          </ScrollArea>
                      </TabsContent>
                      <TabsContent value="tactique" className="m-0">
                          <ScrollArea className="h-64 p-3">
                              {tacticalHistory.map((log, i) => (
                                  <div key={i} className="p-3 bg-white rounded-xl border-2 mb-2 space-y-2 cursor-pointer" onClick={() => googleMap?.panTo({lat: log.lat, lng: log.lng})}>
                                      <div className="flex justify-between items-center">
                                          <Badge className="font-black text-[9px] uppercase">{log.type}</Badge>
                                          <span className="text-[9px] font-bold opacity-40">{format(log.time, 'HH:mm')}</span>
                                      </div>
                                      <div className="flex gap-4 text-[10px] font-bold text-muted-foreground">
                                          <span className="flex items-center gap-1"><Wind className="size-3" /> {log.wind} nds</span>
                                          <span className="flex items-center gap-1"><Thermometer className="size-3" /> {log.temp}°C</span>
                                      </div>
                                      {log.photoUrl && <img src={log.photoUrl} className="w-full h-32 object-cover rounded-lg border" alt="prise" />}
                                  </div>
                              ))}
                          </ScrollArea>
                      </TabsContent>
                  </Tabs>
              </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
              {isSharing ? (
                  <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-2xl border-2">
                      {['OISEAUX', 'THON', 'MAHI MAHI', 'TAZARD', 'WAHOO', 'BONITE', 'SARDINES'].map(label => (
                          <Button key={label} variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => handleTacticalEvent(label)}>
                              {label}
                          </Button>
                      ))}
                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-primary/5 text-primary" onClick={() => photoInputRef.current?.click()}>
                          <Camera className="size-5 mr-2" /> PRISE (PHOTO)
                      </Button>
                      <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => handleTacticalEvent('PRISE (PHOTO)', ev.target?.result as string);
                              reader.readAsDataURL(file);
                          }
                      }} />
                  </div>
              ) : (
                  <Button className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl" onClick={handleStartSharing}>
                      Lancer le Partage
                  </Button>
              )}
          </div>
      </div>
    </div>
  );
}
