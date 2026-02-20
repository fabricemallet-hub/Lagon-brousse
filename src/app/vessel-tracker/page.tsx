
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
  CloudSun,
  Lock,
  Unlock
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
  const [isFollowMode, setIsFollowMode] = useState(true);

  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
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
  const isFollowModeRef = useRef(true);

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

  // Sync Refs
  useEffect(() => { isFollowModeRef.current = isFollowMode; }, [isFollowMode]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);

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

  const soundsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // --- FORCE RENDERING (Carte Grise Fix) ---
  const forceMapReflow = useCallback(() => {
    setTimeout(() => {
        if (googleMap) {
            google.maps.event.trigger(googleMap, 'resize');
        }
        if (windyLeafletMap.current) {
            windyLeafletMap.current.invalidateSize();
        }
    }, 800);
  }, [googleMap]);

  // --- LOGIQUE WINDY AVEC FORÇAGE DE RENDU ---
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
                    
                    // Fix carte grise Windy
                    setTimeout(() => map.invalidateSize(), 800);

                    googleMap?.addListener('idle', () => {
                        if (viewMode === 'beta' && windyLeafletMap.current) {
                            const center = googleMap.getCenter();
                            if (center) windyLeafletMap.current.setView([center.lat(), center.lng()], googleMap.getZoom());
                        }
                    });
                });
            } catch (err) {
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

  // --- TRACKING CORE ---
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharingRef.current && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo = {};
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
            ...batteryInfo,
            ...data 
        };

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, sharingId, customFleetId, vesselNickname]);

  const handleStopSharing = useCallback(async () => {
    setIsSharing(false);
    isSharingRef.current = false;
    setIsInitializing(false);
    
    if (user && firestore) {
        await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }).catch(() => {});
    }

    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  }, [user, firestore, toast, sharingId]);

  // GPS WATCHER AVEC LOCK & HEADING
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    setIsInitializing(true);
    shouldPanOnNextFix.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed, heading, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, parseFloat(((speed || 0) * 1.94384).toFixed(2)));
            
            setCurrentPos(newPos);
            setCurrentSpeed(Math.round(knotSpeed));
            setCurrentHeading(heading || 0);
            
            // Verrouillage GPS (Follow Mode)
            if (isFollowModeRef.current && googleMap) {
                googleMap.panTo(newPos);
                if (shouldPanOnNextFix.current) {
                    googleMap.setZoom(15);
                    shouldPanOnNextFix.current = false;
                }
            }

            // Logique de dérive simplifiée
            let nextStatus: VesselStatus['status'] = 'moving';
            if (knotSpeed < 0.2) nextStatus = 'stationary';
            else if (knotSpeed > 0.5 && anchorPosRef.current) {
                if (getDistance(latitude, longitude, anchorPosRef.current.lat, anchorPosRef.current.lng) > 20) nextStatus = 'drifting';
            }

            updateVesselInFirestore({ location: { latitude, longitude }, status: nextStatus, accuracy: Math.round(accuracy) });
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, toast, updateVesselInFirestore, googleMap]);

  const handleRecenter = () => {
    setIsFollowMode(true);
    if (currentPos && googleMap) {
        googleMap.panTo(currentPos);
        googleMap.setZoom(15);
    }
    toast({ title: "Verrouillage GPS activé" });
  };

  return (
    <div className="w-full space-y-4 pb-32">
      <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('fleet')}>Flotte (C)</Button>
      </div>

      {/* MAP VIEWER AVEC FOLLOW MODE UI */}
      <div 
        className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}
        style={{ height: isFullscreen ? '100dvh' : '500px' }}
      >
        <div id="windy" className={cn("absolute inset-0 z-10 transition-opacity", viewMode === 'alpha' ? "opacity-0 pointer-events-none" : "")} style={{ opacity: viewMode === 'beta' ? 0.6 : 1, width: '100%', height: '100%' }} />
        
        <GoogleMap
            mapContainerClassName="w-full h-full"
            defaultCenter={INITIAL_CENTER}
            defaultZoom={12}
            onLoad={(m) => { setGoogleMap(m); setTimeout(() => google.maps.event.trigger(m, 'resize'), 800); }}
            onDragStart={() => setIsFollowMode(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
        >
            {currentPos && (
                <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
                        <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                        <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center" style={{ transform: `rotate(${currentHeading}deg)` }}>
                            <Navigation className="size-3 text-white fill-white" />
                        </div>
                    </div>
                </OverlayView>
            )}
            {followedVessels?.map(v => v.id !== sharingId && v.location && (
                <OverlayView key={v.id} position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <Badge className="bg-slate-900/90 text-white border-white/20 whitespace-nowrap text-[8px] font-black">{v.displayName || v.id}</Badge>
                        <div className="p-1.5 rounded-full bg-primary border-2 border-white shadow-xl"><Navigation className="size-3 text-white" /></div>
                    </div>
                </OverlayView>
            ))}
        </GoogleMap>
        
        {/* BOUTONS FLOTTANTS */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border-2 shadow-xl">
                <Button variant={viewMode === 'alpha' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('alpha')}>Alpha</Button>
                <Button variant={viewMode === 'beta' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('beta')}>Béta</Button>
                <Button variant={viewMode === 'gamma' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('gamma')}>Gamma</Button>
            </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[160]">
            <Button 
                onClick={() => setIsFollowMode(!isFollowMode)} 
                className={cn("h-10 w-10 border-2 shadow-xl p-0", isFollowMode ? "bg-primary text-white" : "bg-white/90 text-slate-400")}
            >
                {isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!isFollowMode && currentPos && (
                <Button onClick={handleRecenter} className="bg-white text-primary border-2 shadow-xl h-10 font-black text-[10px] uppercase gap-2 px-3 animate-in fade-in slide-in-from-right-2">
                    <LocateFixed className="size-4" /> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-1">
          {isSharing ? (
              <Button variant="destructive" className="w-full h-16 font-black uppercase shadow-xl rounded-2xl border-4 border-white/20 gap-3" onClick={handleStopSharing}>
                  <X className="size-6" /> ARRÊTER LE PARTAGE
              </Button>
          ) : (
              <Button className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3" onClick={() => setIsSharing(true)}>
                  <Navigation className="size-6" /> LANCER LE PARTAGE
              </Button>
          )}
      </div>

      <Card className="border-2 shadow-sm p-4 bg-muted/10">
          <Tabs defaultValue="tech">
              <TabsList className="grid w-full grid-cols-2 h-10 mb-4">
                  <TabsTrigger value="tech" className="text-[10px] font-black uppercase">Télémétrie Tech</TabsTrigger>
                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase">Journal Tactique</TabsTrigger>
              </TabsList>
              <TabsContent value="tech">
                  <div className="text-[9px] font-bold uppercase opacity-40 text-center py-10 italic">Les événements techniques apparaîtront ici...</div>
              </TabsContent>
              <TabsContent value="tactical">
                  <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white" onClick={() => toast({ title: "Point enregistré" })}>MARLIN</Button>
                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white" onClick={() => toast({ title: "Point enregistré" })}>THON</Button>
                  </div>
              </TabsContent>
          </Tabs>
      </Card>
    </div>
  );
}
