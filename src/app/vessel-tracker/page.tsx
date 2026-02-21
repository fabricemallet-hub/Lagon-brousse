
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
  limit,
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
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Waves,
  History,
  Phone,
  AlertCircle
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const WINDY_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
const IMMOBILITY_THRESHOLD_METERS = 20;

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
  
  // REFS STABILITÉ
  const shouldPanOnNextFix = useRef(false); 
  const isSharingRef = useRef(false);
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const startTimeRef = useRef<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const lastTechLogTime = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number, lng: number } | null>(null);

  // IDENTITÉ & FLOTTE
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  // PRÉFÉRENCES AUDIO
  const [vesselPrefs, setVesselPrefs] = useState({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte' },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20
  });

  // RÉCUPÉRATION DATA
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

  const [techHistory, setTechHistory] = useState<{ status: string, battery: number, accuracy: number, time: Date, duration: string }[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<{ type: string, lat: number, lng: number, time: Date, wind: number, temp: number }[]>([]);

  const soundsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // INITIALISATION WINDY
  const [windyLayer, setWindyLayer] = useState<'wind' | 'waves' | 'radar'>('wind');
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);
  const windyAPI = useRef<any>(null);
  const windyStore = useRef<any>(null);
  const windyLeafletMap = useRef<any>(null);
  const isWindyInitializing = useRef(false);

  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || viewMode === 'alpha' || isWindyInitializing.current) return;

    const boot = async () => {
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
                (window as any).windyInit(options, (api: any) => {
                    windyAPI.current = api;
                    windyStore.current = api.store;
                    windyLeafletMap.current = api.map;
                    setIsWindyLoaded(true);
                    isWindyInitializing.current = false;
                    setTimeout(() => api.map.invalidateSize(), 800);
                });
            } catch (err) {
                isWindyInitializing.current = false;
            }
        }
    };
    boot();
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
    if (isWindyLoaded && windyStore.current) windyStore.current.set('overlay', windyLayer);
  }, [windyLayer, isWindyLoaded]);

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
            const statusLabel = data.status || vesselStatusRef.current;
            
            const newLog = {
                status: statusLabel,
                battery: batteryInfo.batteryLevel,
                accuracy: data.accuracy || 0,
                durationText: `ACTIF ${duration} MIN`,
                createdAt: serverTimestamp()
            };

            addDoc(collection(firestore, 'vessels', sharingId, 'logs_technique'), newLog).catch(() => {});
            
            setTechHistory(prev => [{
                status: statusLabel,
                battery: batteryInfo.batteryLevel,
                accuracy: data.accuracy || 0,
                time: new Date(),
                duration: `ACTIF ${duration} MIN`
            }, ...prev].slice(0, 50));

            lastTechLogTime.current = now;
        }
    };
    update();
  }, [user, firestore, sharingId, customFleetId, vesselNickname, isGhostMode]);

  const handleTacticalEvent = async (label: string) => {
    if (!firestore || !currentPos || !isSharing) return;
    
    toast({ title: `${label} signalé`, description: "Récupération météo IA..." });
    
    let weatherInfo = { wind: 0, temp: 0 };
    try {
        const windyData = await fetchWindyWeather(currentPos.lat, currentPos.lng);
        if (windyData.success) {
            weatherInfo = { wind: windyData.windSpeed, temp: windyData.temp };
        }
    } catch (e) {}

    const newTacticalLog = {
        type: label,
        location: { latitude: currentPos.lat, longitude: currentPos.lng },
        wind: weatherInfo.wind,
        temp: weatherInfo.temp,
        createdAt: serverTimestamp()
    };

    addDoc(collection(firestore, 'vessels', sharingId, 'logs_tactique'), newTacticalLog);
    
    setTacticalHistory(prev => [{
        type: label,
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date(),
        wind: weatherInfo.wind,
        temp: weatherInfo.temp
    }, ...prev].slice(0, 50));

    updateVesselInFirestore({ eventLabel: label });
  };

  const handleClearLogs = async (type: 'tech' | 'tactique') => {
    if (!firestore || !sharingId) return;
    const colName = type === 'tech' ? 'logs_technique' : 'logs_tactique';
    const snap = await getDocs(collection(firestore, 'vessels', sharingId, colName));
    const batch = writeBatch(firestore);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    if (type === 'tech') setTechHistory([]);
    else setTacticalHistory([]);
    
    toast({ title: `Journal ${type === 'tech' ? 'Technique' : 'Tactique'} effacé` });
  };

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
            
            if (isFollowMode && googleMap) {
                googleMap.panTo(newPos);
                if (shouldPanOnNextFix.current) { googleMap.setZoom(15); shouldPanOnNextFix.current = false; }
            }

            let nextStatus: VesselStatus['status'] = 'moving';
            if (knotSpeed < 0.2) {
                if (!lastPosRef.current) lastPosRef.current = newPos;
                const movementSinceLast = getDistance(latitude, longitude, lastPosRef.current.lat, lastPosRef.current.lng);
                if (movementSinceLast < 5) nextStatus = 'stationary';
            } else if (knotSpeed > 0.5 && anchorPos) {
                const distFromAnchor = getDistance(latitude, longitude, anchorPos.lat, anchorPos.lng);
                if (distFromAnchor > mooringRadius) nextStatus = 'drifting';
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
  }, [isSharing, toast, updateVesselInFirestore, googleMap, isFollowMode, anchorPos, mooringRadius]);

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

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = customSharingId.trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: cleanId ? arrayUnion(cleanId) : memoizedSavedVesselIds,
            lastVesselId: cleanId,
            vesselNickname: vesselNickname
        });
        toast({ title: "ID enregistré" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur sauvegarde" });
    }
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    vesselStatusRef.current = st;
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || (st === 'returning' ? 'Retour Maison' : st === 'landed' ? 'À terre' : 'Statut mis à jour') });
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const pos = currentPos;
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = vesselSmsMessage ? vesselSmsMessage : "Requiert assistance immédiate.";
    const body = `${nicknamePrefix}${customText} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); } catch (err) {} }
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('fleet')}>Flotte (C)</Button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <div id="windy" className={cn("absolute inset-0 z-10 transition-opacity duration-500", viewMode === 'alpha' ? "hidden opacity-0 pointer-events-none" : "block")} style={{ opacity: viewMode === 'beta' ? 0.6 : 1, width: '100%', height: '100%' }} />
        
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
                    <div style={{ transform: 'translate(-50%, -50%)' }} className="relative">
                        <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                        <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center" style={{ transform: `rotate(${currentHeading}deg)` }}>
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
            {anchorPos && <Circle center={anchorPos} radius={mooringRadius} options={{ strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 2, fillColor: '#3b82f6', fillOpacity: 0.15 }} />}
            
            {mode !== 'sender' && followedVessels?.filter(v => v.isSharing && (!v.isGhostMode || mode === 'receiver')).map(v => v.location && (
                <OverlayView key={v.id} position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <Badge className="bg-slate-900/90 text-white border-white/20 text-[8px] font-black uppercase whitespace-nowrap">{v.displayName || v.id}</Badge>
                        <div className={cn("p-1.5 rounded-full border-2 border-white shadow-lg", v.status === 'stationary' ? "bg-orange-500" : "bg-blue-600")}>
                            {v.status === 'stationary' ? <Anchor className="size-3 text-white" /> : <Navigation className="size-3 text-white" />}
                        </div>
                    </div>
                </OverlayView>
            ))}
        </GoogleMap>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[200]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border-2 shadow-xl">
                {['alpha', 'beta', 'gamma'].map(m => (
                    <Button key={m} variant={viewMode === m ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode(m as any)}>{m}</Button>
                ))}
            </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[200]">
            <Button onClick={() => setIsFollowMode(!isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl", isFollowMode ? "bg-primary text-white" : "bg-white text-slate-400")}>
                {isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            <Button onClick={() => { setIsFollowMode(true); shouldPanOnNextFix.current = true; googleMap?.setZoom(15); }} className="bg-white border-2 shadow-xl h-10 px-3 font-black text-[9px] uppercase text-primary gap-2">
                <LocateFixed className="size-4" /> RE-CENTRER
            </Button>
        </div>
      </div>

      {mode === 'sender' && (
          <div className="flex flex-col gap-3">
              {isSharing ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-3 bg-white p-1 rounded-2xl">
                          <Button 
                              variant="destructive" 
                              className="w-full h-16 font-black uppercase text-xs shadow-lg rounded-xl gap-3 border-2 border-white/20 touch-manipulation bg-red-500 hover:bg-red-600" 
                              onClick={() => {
                                  handleManualStatus('emergency', 'DEMANDE ASSISTANCE');
                                  sendEmergencySms('SOS');
                              }}
                          >
                              <AlertCircle className="size-5" /> DEMANDE ASSISTANCE (PROBLÈME)
                          </Button>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <Button 
                                  variant="outline" 
                                  className="h-20 flex items-center justify-center px-4 rounded-xl border-2 bg-slate-50 hover:bg-slate-100 transition-all touch-manipulation border-slate-200" 
                                  onClick={() => handleManualStatus('returning')}
                                  disabled={vesselStatus === 'returning'}
                              >
                                  <Navigation className="size-5 text-blue-600 mr-4" />
                                  <div className="flex flex-col text-left">
                                      <span className="text-[10px] font-black uppercase text-slate-800 leading-tight tracking-tight">Retour</span>
                                      <span className="text-[10px] font-black uppercase text-slate-800 leading-tight tracking-tight">Maison</span>
                                  </div>
                              </Button>
                              <Button 
                                  variant="outline" 
                                  className="h-20 flex items-center justify-center px-4 rounded-xl border-2 bg-slate-50 hover:bg-slate-100 transition-all touch-manipulation border-slate-200" 
                                  onClick={() => handleManualStatus('landed')}
                                  disabled={vesselStatus === 'landed'}
                              >
                                  <Home className="size-5 text-green-600 mr-3" />
                                  <span className="text-[10px] font-black uppercase text-slate-800 leading-tight tracking-tight">Home (À terre)</span>
                              </Button>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2 touch-manipulation" onClick={() => handleTacticalEvent('MARLIN')}><Fish className="size-4 text-blue-600" /> MARLIN</Button>
                          <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2 touch-manipulation" onClick={() => handleTacticalEvent('THON')}><Fish className="size-4 text-red-600" /> THON</Button>
                          <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2 touch-manipulation" onClick={() => handleTacticalEvent('TAZARD')}><Fish className="size-4 text-emerald-600" /> TAZARD</Button>
                          <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2 touch-manipulation" onClick={() => handleTacticalEvent('OISEAUX')}><Bird className="size-4 text-slate-600" /> OISEAUX</Button>
                      </div>

                      <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20 touch-manipulation" onClick={handleStopSharing}>
                          <X className="size-5" /> ARRÊTER LE PARTAGE
                      </Button>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <Button className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3" onClick={() => setIsSharing(true)}>
                          <Navigation className="size-6" /> LANCER LE PARTAGE
                      </Button>
                      <div className="p-4 bg-muted/20 rounded-2xl border-2 space-y-4">
                          <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID du navire</Label>
                              <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                          </div>
                          <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Surnom du capitaine</Label>
                              <Input placeholder="EX: CAPITAINE NEMO" value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold text-center h-12 border-2 uppercase" />
                          </div>
                          <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] border-2 gap-2" onClick={toggleWakeLock}>
                              <Zap className={cn("size-4", wakeLock && "fill-primary")} />
                              {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
                          </Button>
                      </div>
                  </div>
              )}
          </div>
      )}

      <Card className="border-2 shadow-sm overflow-hidden bg-muted/10">
          <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="logs" className="border-none">
                  <AccordionTrigger className="flex items-center justify-between px-4 h-12 bg-white hover:no-underline">
                      <div className="flex items-center gap-2 font-black uppercase text-[10px]"><HistoryIcon className="size-3" /> Journal de Bord</div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t border-dashed">
                      <Tabs defaultValue="technique">
                          <TabsList className="grid w-full grid-cols-2 h-10 border-b rounded-none bg-slate-50">
                              <TabsTrigger value="technique" className="text-[10px] font-black uppercase">Tech</TabsTrigger>
                              <TabsTrigger value="tactique" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                          </TabsList>
                          <TabsContent value="technique" className="p-3 space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                              <div className="flex justify-end mb-2"><Button variant="ghost" size="sm" className="h-6 text-[8px] font-black text-destructive gap-1" onClick={() => handleClearLogs('tech')}><Trash2 className="size-2.5" /> Effacer</Button></div>
                              {techHistory.map((log, i) => (
                                  <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl border-2 text-[9px] font-bold shadow-sm">
                                      <div className="flex items-center gap-3">
                                          <Badge variant="outline" className="text-[8px] h-4 font-black uppercase">{log.status}</Badge>
                                          <span className="text-primary">{log.duration}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-muted-foreground">
                                          <span>BAT: {log.battery}%</span>
                                          <span>+/- {log.accuracy}m</span>
                                          <span>{format(log.time, 'HH:mm')}</span>
                                      </div>
                                  </div>
                              ))}
                          </TabsContent>
                          <TabsContent value="tactique" className="p-3 space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                              <div className="flex justify-end mb-2"><Button variant="ghost" size="sm" className="h-6 text-[8px] font-black text-destructive gap-1" onClick={() => handleClearLogs('tactique')}><Trash2 className="size-2.5" /> Effacer</Button></div>
                              {tacticalHistory.map((log, i) => (
                                  <div key={i} onClick={() => { if(googleMap) { googleMap.panTo({ lat: log.lat, lng: log.lng }); googleMap.setZoom(16); } }} className="flex justify-between items-center p-3 bg-white rounded-xl border-2 text-[9px] font-black shadow-sm cursor-pointer active:scale-95 transition-all">
                                      <div className="flex items-center gap-3">
                                          <div className="size-2 rounded-full bg-primary" />
                                          <span className="uppercase">{log.type}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-muted-foreground">
                                          <span className="flex items-center gap-1"><Waves className="size-3"/> {log.wind} ND</span>
                                          <span>{log.temp}°C</span>
                                          <span>{format(log.time, 'HH:mm')}</span>
                                      </div>
                                  </div>
                              ))}
                          </TabsContent>
                      </Tabs>
                  </AccordionContent>
              </AccordionItem>
          </Accordion>
      </Card>

      <Card className="border-2 shadow-sm bg-muted/5">
          <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Phone className="size-3" /> Annuaire Maritime NC</CardTitle></CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</p><p className="text-xs font-black">COSS Mer : 16</p><p className="text-xs font-black">SAMU Terre : 15</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</p><p className="text-xs font-black">Météo Marine : 36 67 36</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">Ports</p><p className="text-xs font-black">Port Moselle : 27 71 97</p></div>
          </CardContent>
      </Card>
    </div>
  );
}
