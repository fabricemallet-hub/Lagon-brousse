
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
  Check,
  Trash2,
  Ship,
  Home,
  RefreshCw,
  Settings,
  Smartphone,
  Waves,
  Bird,
  Globe,
  ChevronDown,
  Target,
  Compass,
  Fish,
  Radio,
  Sun,
  Activity,
  Wind,
  Plus,
  Thermometer,
  CloudRain,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, WindDirection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';

const WINDY_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 20) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 60) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const WINDY_LAYERS = [
    { id: 'wind', icon: Wind, label: 'Vent' },
    { id: 'radar', icon: Radio, label: 'Radar' },
    { id: 'gust', icon: Wind, label: 'Rafales' },
    { id: 'temp', icon: Thermometer, label: 'Temp.' },
    { id: 'rain', icon: CloudRain, label: 'Pluie' },
    { id: 'waves', icon: Waves, label: 'Houle' },
    { id: 'pressure', icon: Activity, label: 'Pression' },
    { id: 'uv', icon: Sun, label: 'UV' },
];

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded: isGoogleLoaded, loadError: googleError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [viewMode, setViewMode] = useState<'google' | 'windy'>('google');
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  
  const [isSharing, setIsSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [windyMap, setWindyMap] = useState<any>(null);
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);

  const [activeOverlay, setActiveOverlay] = useState('wind');
  const [vesselValueAtPos, setVesselValueAtPos] = useState<string>('--');

  const [syncCountdown, setSyncCountdown] = useState(60);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [technicalLogs, setTechnicalLogs] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: {lat: number, lng: number}, batteryLevel?: number, isCharging?: boolean }[]>([]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const ids = [...savedVesselIds];
    if (isSharing && !ids.includes(sharingId)) ids.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const watchIdRef = useRef<number | null>(null);
  const shouldPanOnNextFix = useRef(false);
  const lastStatusesRef = useRef<Record<string, string>>({});

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    const lat = currentPos?.lat.toFixed(6) || '-21.3';
    const lng = currentPos?.lng.toFixed(6) || '165.5';
    return `${nicknamePrefix}${customText} Position : https://www.google.com/maps?q=${lat},${lng}`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname, currentPos]);

  const loadLeafletAssets = useCallback(() => {
    return new Promise<void>((resolve) => {
        if ((window as any).L) return resolve();
        
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.css'; // Version 1.4.0 requise par Windy
            document.head.appendChild(link);
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
  }, []);

  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || isWindyLoaded) return;

    const loadWindyScript = () => {
        return new Promise<void>((resolve) => {
            if (document.getElementById('windy-boot')) return resolve();
            const s = document.createElement('script');
            s.id = 'windy-boot';
            s.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
            s.async = true;
            s.onload = () => resolve();
            document.head.appendChild(s);
        });
    };

    const bootSequentially = async () => {
        try {
            await loadLeafletAssets();
            await loadWindyScript();

            const checkDependencies = () => {
                if ((window as any).windyInit && (window as any).L) {
                    try {
                        (window as any).windyInit({
                            key: WINDY_KEY,
                            lat: INITIAL_CENTER.lat,
                            lon: INITIAL_CENTER.lng,
                            zoom: 13,
                        }, (api: any) => {
                            const { map: wMap, store, picker } = api;
                            setWindyMap(wMap);
                            setIsWindyLoaded(true);
                            store.set('overlay', 'wind');
                            
                            picker.on('pickerOpened', (data: any) => {
                                if (data.overlay === 'wind') setVesselValueAtPos(`${Math.round(data.wind * 1.94384)} kts`);
                                else if (data.overlay === 'waves') setVesselValueAtPos(`${data.waves.toFixed(1)}m`);
                                else if (data.overlay === 'temp') setVesselValueAtPos(`${Math.round(data.temp - 273.15)}°C`);
                                else setVesselValueAtPos('--');
                            });
                        });
                    } catch (e) {
                        console.warn("Windy Init Error", e);
                    }
                } else {
                    setTimeout(checkDependencies, 300);
                }
            };
            checkDependencies();
        } catch (e) {
            console.warn("Boot Sequence Error", e);
        }
    };

    bootSequentially();
  }, [isWindyLoaded, loadLeafletAssets]);

  const handleLayerChange = useCallback((layerId: string) => {
    if (!isWindyLoaded || !(window as any).W) return;
    
    requestAnimationFrame(() => {
        try {
            const store = (window as any).W.store;
            if (!store) return;

            if (layerId === 'gust') {
                store.set('overlay', 'wind'); 
                store.set('product', 'gust'); 
            } else {
                store.set('overlay', layerId);
            }
            setActiveOverlay(layerId);
        } catch (e) { console.warn("Layer Change Error", e); }
    });
  }, [isWindyLoaded]);

  useEffect(() => {
    if (!googleMap || !windyMap || (!isOverlayActive && viewMode !== 'windy')) return;

    const syncMaps = () => {
        try {
            const center = googleMap.getCenter();
            const zoom = googleMap.getZoom();
            if (center && zoom) {
                windyMap.setView([center.lat(), center.lng()], zoom, { animate: false });
            }
        } catch (e) { console.warn("Sync Maps Error", e); }
    };

    const listener = googleMap.addListener('bounds_changed', syncMaps);
    return () => google.maps.event.removeListener(listener);
  }, [googleMap, windyMap, isOverlayActive, viewMode]);

  const updateVesselInFirestore = useCallback((data: any) => {
    if (!user || !firestore || !isSharing) return;
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, {
        id: sharingId,
        userId: user.uid,
        displayName: vesselNickname || user.displayName || 'Capitaine',
        isSharing: true,
        lastActive: serverTimestamp(),
        status: vesselStatus,
        ...data
    }, { merge: true }).catch(e => console.warn("Firestore Update Warn", e));
  }, [user, firestore, isSharing, sharingId, vesselNickname, vesselStatus]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            setCurrentPos(newPos);
            setCurrentSpeed(Math.max(0, Math.round((speed || 0) * 1.94384)));

            if (isFollowMode && googleMap) googleMap.panTo(newPos);
            if (!anchorPos) setAnchorPos(newPos);
            
            updateVesselInFirestore({ location: { latitude, longitude } });
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    const interval = setInterval(() => {
        setSyncCountdown(prev => {
            if (prev <= 1) { updateVesselInFirestore({ eventLabel: 'SYNC AUTO' }); return 60; }
            return prev - 1;
        });
    }, 1000);

    return () => {
        clearInterval(interval);
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, mode, googleMap, isFollowMode, anchorPos, updateVesselInFirestore, toast]);

  useEffect(() => {
    if (!followedVessels) return;
    followedVessels.forEach(v => {
        const isOffline = (Date.now() - (v.lastActive?.toMillis() || 0)) > 75000;
        const currentLabel = isOffline ? 'OFFLINE' : (v.status === 'emergency' ? 'SOS' : v.status === 'stationary' ? 'MOUIL' : 'MOUV');
        
        if (lastStatusesRef.current[v.id] && lastStatusesRef.current[v.id] !== currentLabel) {
            setTechnicalLogs(prev => [{
                vesselName: v.displayName || v.id,
                statusLabel: currentLabel,
                time: new Date(),
                pos: v.location ? { lat: v.location.latitude, lng: v.location.longitude } : INITIAL_CENTER,
                batteryLevel: v.batteryLevel,
                isCharging: v.isCharging
            }, ...prev].slice(0, 50));
        }
        lastStatusesRef.current[v.id] = currentLabel;
    });
  }, [followedVessels]);

  const handleRecenter = () => {
    if (currentPos && googleMap) {
        googleMap.setZoom(18);
        googleMap.panTo(currentPos);
    } else {
        shouldPanOnNextFix.current = true;
        if (!isSharing) {
            setIsSharing(true);
            toast({ title: "GPS Activé", description: "Recherche de votre position..." });
        }
    }
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), { 
            isSharing: false, 
            lastActive: serverTimestamp(),
            statusChangedAt: serverTimestamp() 
        });
    } catch (e) { console.warn("Stop Sharing Error", e); }

    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    setCurrentPos(null);
    setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleSaveSmsSettings = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            emergencyContact,
            vesselSmsMessage,
            isEmergencyEnabled,
            isCustomMessageEnabled
        });
        toast({ title: "Paramètres SMS sauvegardés" });
    } catch (e) { toast({ variant: 'destructive', title: "Erreur sauvegarde" }); }
  };

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = customSharingId.trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            lastVesselId: cleanId,
            vesselNickname: vesselNickname
        });
        toast({ title: "ID enregistré" });
    } catch (e) { toast({ variant: 'destructive', title: "Erreur sauvegarde" }); }
  };

  const sendEmergencySms = (type: string) => {
    if (!emergencyContact) {
        toast({ variant: 'destructive', title: "Numéro manquant", description: "Renseignez un contact d'urgence dans les réglages." });
        return;
    }
    const body = `${type} - ${smsPreview}`;
    window.location.href = `sms:${emergencyContact}?body=${encodeURIComponent(body)}`;
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); } }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <div className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4"><Navigation className="size-32" /></div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-xl shadow-lg animate-pulse"><Ship className="size-6 text-white" /></div>
                  <div className="min-w-0">
                      <h2 className="text-[9px] font-black uppercase tracking-widest text-primary">MON BATEAU</h2>
                      <div className="flex items-center gap-3 mt-1">
                          <p className="text-xl font-black tracking-tighter">{currentSpeed} <span className="text-[10px] opacity-60">Kts</span></p>
                          <div className="h-4 w-px bg-white/20" />
                          <p className="text-[10px] font-mono text-slate-400 truncate">
                              {currentPos ? `${currentPos.lat.toFixed(4)}°S / ${currentPos.lng.toFixed(4)}°E` : 'GPS...'}
                          </p>
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                  <div className="text-right">
                      <span className="text-[8px] font-black uppercase text-slate-500">Capteur {activeOverlay}</span>
                      <p className="text-sm font-black text-blue-400 uppercase">{vesselValueAtPos}</p>
                  </div>
                  <Badge variant="outline" className="border-green-500/50 text-green-400 font-black text-[9px]">LIVE</Badge>
              </div>
          </div>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden transition-all bg-slate-950", isFullscreen ? "fixed inset-0 z-[150] h-screen w-screen rounded-none" : "h-[600px]")}>
        
        <div className={cn("absolute inset-0 z-0 transition-opacity duration-500", viewMode === 'windy' ? "opacity-0 pointer-events-none" : "opacity-100")}>
            {isGoogleLoaded ? (
                <GoogleMap
                    mapContainerClassName="w-full h-full"
                    defaultCenter={INITIAL_CENTER}
                    defaultZoom={12}
                    onLoad={setGoogleMap}
                    options={{ 
                        disableDefaultUI: true, 
                        mapTypeId: 'hybrid', 
                        gestureHandling: 'greedy',
                        backgroundColor: '#020617'
                    }}
                >
                    {currentPos && (
                        <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" style={{ transform: 'translate(-50%, -50%)' }} />
                        </OverlayView>
                    )}
                    {followedVessels?.filter(v => v.isSharing).map(v => v.location && (
                        <OverlayView key={v.id} position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[9px] font-black shadow-lg border border-white/20 whitespace-nowrap">
                                    {v.displayName || v.id}
                                </div>
                                <div className="p-1.5 rounded-full bg-primary border-2 border-white shadow-xl"><Navigation className="size-4 text-white" /></div>
                            </div>
                        </OverlayView>
                    ))}
                </GoogleMap>
            ) : <div className="flex h-full w-full items-center justify-center text-white font-black uppercase text-xs animate-pulse">Initialisation des systèmes...</div>}
        </div>

        <div 
            id="windy" 
            className={cn(
                "absolute inset-0 z-10 transition-opacity duration-500", 
                viewMode === 'windy' ? "opacity-100" : (isOverlayActive ? "opacity-50 pointer-events-none" : "opacity-0 pointer-events-none")
            )}
        />

        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}</Button>
            <Button size="icon" className={cn("bg-white border-2 h-10 w-10 shadow-xl", isFollowMode ? "border-blue-500 bg-blue-50" : "border-slate-200")} onClick={() => setIsFollowMode(!isFollowMode)}>
                {isFollowMode ? <Lock className="size-5 text-blue-600" /> : <Unlock className="size-5 text-slate-400" />}
            </Button>
            <Button onClick={handleRecenter} className="h-10 bg-primary text-white border-2 border-white/20 px-3 gap-2 shadow-xl font-black uppercase text-[9px]">RECENTRER <LocateFixed className="size-4" /></Button>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[160]">
            <Button 
                onClick={() => {
                    const nextStatus = !isOverlayActive;
                    setIsOverlayActive(nextStatus);
                    if (nextStatus) {
                        if (!isWindyLoaded) initWindy();
                        setViewMode('google');
                    }
                }}
                className={cn("h-12 px-4 border-2 font-black uppercase text-[10px] shadow-2xl rounded-xl gap-2 backdrop-blur-md", isOverlayActive ? "bg-primary text-white border-white" : "bg-slate-900/80 text-white border-white/20")}
            >
                <Layers className={cn("size-4", isOverlayActive && "animate-pulse")} />
                {isOverlayActive ? 'DÉSACTIVER SUPERPOSITION' : 'SUPERPOSITION MÉTÉO'}
            </Button>
            <Button 
                onClick={() => {
                    const nextMode = viewMode === 'google' ? 'windy' : 'google';
                    setViewMode(nextMode);
                    setIsOverlayActive(false);
                    if (nextMode === 'windy' && !isWindyLoaded) initWindy();
                }}
                className={cn("h-12 px-4 border-2 font-black uppercase text-[10px] shadow-2xl rounded-xl gap-2 backdrop-blur-md", viewMode === 'windy' ? "bg-blue-600 text-white border-white" : "bg-slate-900/80 text-white border-white/20")}
            >
                <Globe className="size-4" />
                {viewMode === 'windy' ? 'RETOUR GOOGLE MAPS' : 'VUE WINDY TOTALE'}
            </Button>
        </div>

        {(viewMode === 'windy' || isOverlayActive) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-[160] overflow-x-auto max-w-[90vw] pb-2 scrollbar-hide">
                {WINDY_LAYERS.map(layer => (
                    <Button 
                        key={layer.id} 
                        size="sm" 
                        onClick={() => handleLayerChange(layer.id)}
                        className={cn("h-10 px-3 rounded-full border-2 font-black uppercase text-[9px] gap-2 shrink-0 transition-all", activeOverlay === layer.id ? "bg-primary text-white border-white scale-110 shadow-xl" : "bg-slate-900/80 text-white border-white/10 backdrop-blur-md")}
                    >
                        <layer.icon className="size-3" /> {layer.label}
                    </Button>
                ))}
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
            <Card className="border-2 shadow-lg bg-muted/5">
                <CardHeader className="p-4 border-b bg-muted/10">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Target className="size-4" /> Signalement Tactique (Flotte)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { id: 'MARLIN', icon: Fish, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { id: 'THON', icon: Fish, color: 'text-red-600', bg: 'bg-red-50' },
                            { id: 'OISEAUX', icon: Bird, color: 'text-orange-600', bg: 'bg-orange-50' },
                            { id: 'SARDINES', icon: Waves, color: 'text-cyan-600', bg: 'bg-cyan-50' }
                        ].map(sig => (
                            <Button key={sig.id} variant="outline" className={cn("h-16 flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95", sig.bg)} onClick={() => {}}>
                                <sig.icon className={cn("size-5", sig.color)} />
                                <span className={cn("text-[8px] font-black uppercase", sig.color)}>{sig.id}</span>
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {isSharing ? (
                    <Button variant="destructive" className="w-full h-16 font-black uppercase shadow-xl rounded-2xl border-4 border-white/20 gap-3" onClick={handleStopSharing}>
                        <X className="size-6" /> ARRÊTER LE PARTAGE
                    </Button>
                ) : (
                    <Button className="w-full h-20 text-lg font-black uppercase tracking-widest shadow-xl rounded-2xl gap-4" onClick={() => setIsSharing(true)}>
                        <Navigation className="size-8" /> ACTIVER PILOTAGE
                    </Button>
                )}
            </div>
        </div>

        <Card className="border-2 shadow-sm overflow-hidden h-full">
            <CardHeader className="p-4 border-b bg-muted/5 flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><HistoryIcon className="size-3" /> Journal de bord technique</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={() => setTechnicalLogs([])}><Trash2 className="size-3 mr-1" /> Effacer</Button>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-64">
                    <div className="divide-y">
                        {technicalLogs.map((h, i) => (
                            <div key={i} className="p-3 flex items-center justify-between text-[10px] hover:bg-muted/30 transition-colors">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                        <span className={cn("font-black", h.statusLabel === 'SOS' ? 'text-red-600' : '')}>{h.statusLabel}</span>
                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />
                                    </div>
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(h.time, 'HH:mm:ss')}</span>
                                </div>
                                <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => { if(googleMap) googleMap.panTo(h.pos); }}>GPS</Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
      </div>

      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="sender-prefs" className="border-none">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                  <Settings className="size-4 text-primary" />
                  <span className="text-[10px] font-black uppercase">Réglages Identité & Surnom</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Surnom du navire</Label>
                      <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="CAPITAINE..." className="font-bold h-12 border-2 uppercase" />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID Partage personnalisé</Label>
                      <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="BATEAU-1" className="font-black h-12 border-2 uppercase" />
                  </div>
                  <Button onClick={handleSaveVessel} className="w-full h-10 font-black uppercase text-[10px] border-2">Mémoriser mon identité</Button>
              </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sms-config" className="border-none mt-2">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50 border-2 border-orange-100 rounded-xl"><Smartphone className="size-4 text-orange-600" /><span className="text-[10px] font-black uppercase text-orange-800">Configuration SMS d'Urgence</span></AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <div className="p-4 bg-white border-2 rounded-2xl space-y-4 shadow-inner">
                      <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Contact Terre</Label><Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">Message SOS personnalisé</Label><Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="min-h-[80px] border-2" /></div>
                      <div className="p-3 bg-muted/30 rounded-xl border-2 border-dashed text-[10px] italic">Aperçu : {smsPreview}</div>
                      <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] gap-2 shadow-lg"><Save className="size-4" /> Enregistrer réglages SMS</Button>
                  </div>
              </AccordionContent>
          </AccordionItem>
      </Accordion>
    </div>
  );
}
