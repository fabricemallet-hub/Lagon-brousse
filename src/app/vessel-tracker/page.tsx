
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
  arrayRemove,
  getDoc
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
  Layers,
  Camera,
  ImageIcon,
  Ghost
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, WindDirection, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  
  // IDENTIFICATION & IDS
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(100);
  
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [technicalLogs, setTechnicalLogs] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: {lat: number, lng: number}, batteryLevel?: number, isCharging?: boolean }[]>([]);
  
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [selectedMarkerPhoto, setSelectedMarkerPhoto] = useState<string | null>(null);
  
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);
  
  const shouldPanOnNextFix = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const immobilityStartTime = useRef<number | null>(null);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Si on a un ID de flotte, on suit tout le groupe
    if (fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true));
    }
    // Sinon on suit la liste habituelle
    if (savedVesselIds.length === 0) return null;
    const ids = [...savedVesselIds];
    if (isSharing && !ids.includes(sharingId)) ids.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing, fleetId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    const lat = currentPos?.lat.toFixed(6) || '-21.3';
    const lng = currentPos?.lng.toFixed(6) || '165.5';
    return `${nicknamePrefix}${customText} Position : https://www.google.com/maps?q=${lat},${lng}`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname, currentPos]);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (profile) {
        if (profile.vesselNickname) setVesselNickname(profile.vesselNickname);
        if (profile.lastVesselId) setCustomSharingId(profile.lastVesselId);
        if (profile.lastFleetId) setCustomFleetId(profile.lastFleetId);
        if (profile.isGhostMode !== undefined) setIsGhostMode(profile.isGhostMode);
        if (profile.vesselPrefs?.mooringRadius) setMooringRadius(profile.vesselPrefs.mooringRadius);
        if (profile.emergencyContact) setEmergencyContact(profile.emergencyContact);
        if (profile.vesselSmsMessage) setVesselSmsMessage(profile.vesselSmsMessage);
    }
  }, [profile]);

  // --- HANDLERS ---
  const handleStopSharing = useCallback(async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    try {
        await setDoc(doc(firestore, 'vessels', sharingId), { 
            isSharing: false, 
            lastActive: serverTimestamp(),
            statusChangedAt: serverTimestamp() 
        }, { merge: true });
    } catch (e) { console.warn("Stop Sharing Error", e); }

    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    setCurrentPos(null);
    setAnchorPos(null);
    lastSentStatusRef.current = null;
    toast({ title: "Partage arrêté" });
  }, [user, firestore, sharingId, toast]);

  const handleSaveSmsSettings = useCallback(async () => {
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
  }, [user, firestore, emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled, toast]);

  const handleSaveVesselIdentity = async (field: 'vessel' | 'fleet') => {
    if (!user || !firestore) return;
    const updates: any = {};
    if (field === 'vessel') updates.lastVesselId = customSharingId.trim().toUpperCase();
    if (field === 'fleet') updates.lastFleetId = customFleetId.trim().toUpperCase();
    updates.vesselNickname = vesselNickname;
    updates.isGhostMode = isGhostMode;
    updates.vesselPrefs = { ...(profile?.vesselPrefs || {}), mooringRadius };

    try {
        await updateDoc(doc(firestore, 'users', user.uid), updates);
        toast({ title: "Identité mise à jour" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur sauvegarde" }); }
  };

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const newStatus = data.status || vesselStatus;
    const statusChanged = lastSentStatusRef.current !== newStatus;

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
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            lastActive: serverTimestamp(),
            fleetId: fleetId || null,
            isGhostMode: isGhostMode,
            mooringRadius: mooringRadius,
            ...batteryInfo,
            ...data 
        };

        if (statusChanged || lastSentStatusRef.current === null || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
            lastSentStatusRef.current = newStatus;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, fleetId, isGhostMode, vesselNickname, vesselStatus, mooringRadius]);

  const handleTacticalReport = async (type: string, photo?: string) => {
    if (!user || !firestore || !currentPos || !isSharing) {
        toast({ variant: "destructive", title: "Action impossible", description: "Activez le GPS." });
        return;
    }

    const marker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date().toISOString(),
        label: type,
        photoUrl: photo || undefined
    };

    try {
        const vesselRef = doc(firestore, 'vessels', sharingId);
        await updateDoc(vesselRef, { huntingMarkers: arrayUnion(marker) });
        toast({ title: "Point épinglé !", description: `${type} à votre position.` });
    } catch (e) { toast({ variant: "destructive", title: "Erreur signalement" }); }
  };

  const handleClearTactical = async () => {
    if (!user || !firestore || !isSharing) return;
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: [] });
        toast({ title: "Carte nettoyée" });
    } catch (e) {}
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCapturingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await handleTacticalReport('PRISE', base64);
        setIsCapturingPhoto(false);
        if (photoInputRef.current) photoInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  // --- MAP LOGIC ---
  const loadLeafletAssets = useCallback(() => {
    return new Promise<void>((resolve) => {
        if ((window as any).L) return resolve();
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.css';
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
    const bootSequentially = async () => {
        try {
            await loadLeafletAssets();
            if (document.getElementById('windy-boot')) return;
            const s = document.createElement('script');
            s.id = 'windy-boot';
            s.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
            s.async = true;
            s.onload = () => {
                const check = () => {
                    if ((window as any).windyInit && (window as any).L) {
                        try {
                            (window as any).windyInit({
                                key: WINDY_KEY,
                                lat: currentPos?.lat || INITIAL_CENTER.lat,
                                lon: currentPos?.lng || INITIAL_CENTER.lng,
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
                        } catch (e) { console.warn("Windy Init Error", e); }
                    } else { setTimeout(check, 300); }
                };
                check();
            };
            document.head.appendChild(s);
        } catch (e) { console.warn("Boot Sequence Error", e); }
    };
    bootSequentially();
  }, [isWindyLoaded, loadLeafletAssets, currentPos]);

  const handleLayerChange = useCallback((layerId: string) => {
    if (!isWindyLoaded || !(window as any).W) return;
    requestAnimationFrame(() => {
        try {
            const store = (window as any).W.store;
            if (!store) return;
            if (layerId === 'gust') { store.set('overlay', 'wind'); store.set('product', 'gust'); }
            else { store.set('overlay', layerId); }
            setActiveOverlay(layerId);
        } catch (e) { console.warn("Layer Change Error", e); }
    });
  }, [isWindyLoaded]);

  // --- TRACKING CORE ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, Math.round((speed || 0) * 1.94384));
            
            setCurrentPos(newPos);
            setCurrentSpeed(knotSpeed);
            if (isFollowMode && googleMap) googleMap.panTo(newPos);

            // LOGIQUE DE SÉCURITÉ AUTOMATIQUE
            let nextStatus: VesselStatus['status'] = vesselStatus;
            let eventLabel: string | null = null;

            if (knotSpeed > 2) {
                nextStatus = 'moving';
                immobilityStartTime.current = null;
                if (vesselStatus !== 'moving') eventLabel = 'REPRISE DE ROUTE';
            } else if (anchorPos) {
                const distToAnchor = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
                if (distToAnchor > mooringRadius) {
                    nextStatus = 'drifting';
                    eventLabel = 'ALERTE DÉRIVE !';
                } else {
                    nextStatus = 'stationary';
                }
            }

            if (nextStatus !== vesselStatus) {
                setVesselStatus(nextStatus);
                if (nextStatus === 'drifting') toast({ variant: 'destructive', title: "ALERTE DÉRIVE", description: `Rayon de ${mooringRadius}m dépassé.` });
            }

            updateVesselInFirestore({ 
                location: { latitude, longitude }, 
                status: nextStatus, 
                eventLabel,
                anchorLocation: anchorPos ? { latitude: anchorPos.lat, longitude: anchorPos.lng } : null
            });
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, googleMap, isFollowMode, anchorPos, updateVesselInFirestore, toast, mooringRadius, vesselStatus]);

  const handleMooringToggle = () => {
    if (anchorPos) {
        setAnchorPos(null);
        setVesselStatus('moving');
        updateVesselInFirestore({ status: 'moving', anchorLocation: null, eventLabel: 'LEVÉE D\'ANCRE' });
        toast({ title: "Ancre levée" });
    } else if (currentPos) {
        setAnchorPos(currentPos);
        setVesselStatus('stationary');
        updateVesselInFirestore({ status: 'stationary', anchorLocation: { latitude: currentPos.lat, longitude: currentPos.lng }, eventLabel: 'MOUILLAGE ACTIVÉ' });
        toast({ title: "Point d'ancrage fixé", description: `Rayon de sécurité : ${mooringRadius}m` });
    } else {
        toast({ variant: "destructive", title: "GPS requis", description: "Activez le partage pour fixer l'ancre." });
    }
  };

  const handleRecenter = () => {
    if (currentPos && googleMap) {
        googleMap.setZoom(18);
        googleMap.panTo(currentPos);
    } else {
        shouldPanOnNextFix.current = true;
        if (!isSharing) { setIsSharing(true); toast({ title: "GPS Activé", description: "Recherche..." }); }
    }
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); } }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); } catch (err) {} }
  };

  const isLanded = vesselStatus === 'landed';
  const isDrifting = vesselStatus === 'drifting';

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32 transition-colors", isDrifting && "bg-red-500/10")}>
      <div className={cn("w-full text-white rounded-2xl p-4 shadow-xl border relative overflow-hidden transition-all", isDrifting ? "bg-red-600 animate-pulse border-red-400" : "bg-slate-900 border-white/10")}>
          <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4"><Navigation className="size-32" /></div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl shadow-lg", isDrifting ? "bg-white text-red-600" : "bg-primary text-white")}><Ship className="size-6" /></div>
                  <div className="min-w-0">
                      <h2 className={cn("text-[9px] font-black uppercase tracking-widest", isDrifting ? "text-white" : "text-primary")}>
                        {isDrifting ? "⚠️ ALERTE DÉRIVE ⚠️" : "MON BATEAU"}
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                          <p className="text-xl font-black tracking-tighter">{currentSpeed} <span className="text-[10px] opacity-60">Kts</span></p>
                          <div className="h-4 w-px bg-white/20" />
                          <p className="text-[10px] font-mono opacity-60 truncate">
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
                  <Badge variant="outline" className={cn("font-black text-[9px]", isDrifting ? "bg-white text-red-600 border-none" : "border-green-500/50 text-green-400")}>
                    {isDrifting ? "SOS" : "LIVE"}
                  </Badge>
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
                    options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy', backgroundColor: '#020617' }}
                >
                    {currentPos && (
                        <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" style={{ transform: 'translate(-50%, -50%)' }} />
                        </OverlayView>
                    )}
                    {anchorPos && (
                        <>
                            <OverlayView position={anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div className="p-1 bg-white rounded-full border-2 border-primary shadow-xl" style={{ transform: 'translate(-50%, -50%)' }}>
                                    <Anchor className="size-4 text-primary" />
                                </div>
                            </OverlayView>
                            <Circle
                                center={anchorPos}
                                radius={mooringRadius}
                                options={{
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.15,
                                    strokeColor: isDrifting ? '#ef4444' : '#3b82f6',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    clickable: false,
                                    zIndex: 1
                                }}
                            />
                        </>
                    )}
                    {followedVessels?.filter(v => v.isSharing && !v.isGhostMode).map(v => (
                        <React.Fragment key={v.id}>
                            {v.location && (
                                <OverlayView position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[9px] font-black shadow-lg border border-white/20 whitespace-nowrap">
                                            {v.displayName || v.id}
                                        </div>
                                        <div className="p-1.5 rounded-full bg-primary border-2 border-white shadow-xl"><Navigation className="size-4 text-white" /></div>
                                    </div>
                                </OverlayView>
                            )}
                            {v.anchorLocation && (
                                <Circle
                                    center={{ lat: v.anchorLocation.latitude, lng: v.anchorLocation.longitude }}
                                    radius={v.mooringRadius || 100}
                                    options={{ fillColor: '#3b82f6', fillOpacity: 0.1, strokeColor: '#3b82f6', strokeOpacity: 0.4, strokeWeight: 1 }}
                                />
                            )}
                            {v.huntingMarkers?.map(marker => (
                                <OverlayView key={marker.id} position={{ lat: marker.lat, lng: marker.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div 
                                        style={{ transform: 'translate(-50%, -50%)' }} 
                                        className="flex flex-col items-center group cursor-pointer"
                                        onClick={() => marker.photoUrl && setSelectedMarkerPhoto(marker.photoUrl)}
                                    >
                                        <div className="p-1 rounded-full bg-white border-2 border-slate-900 shadow-xl scale-75 group-hover:scale-100 transition-all">
                                            {marker.label === 'MARLIN' && <Fish className="size-4 text-blue-600" />}
                                            {marker.label === 'THON' && <Fish className="size-4 text-red-600" />}
                                            {marker.label === 'OISEAUX' && <Bird className="size-4 text-orange-600" />}
                                            {marker.label === 'SARDINES' && <Waves className="size-4 text-cyan-600" />}
                                            {marker.label === 'PRISE' && <Camera className="size-4 text-purple-600" />}
                                        </div>
                                        <Badge variant="outline" className="bg-slate-900/80 text-white text-[7px] border-none font-black h-3 px-1 mt-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                                            {marker.time ? format(new Date(marker.time), 'HH:mm') : '--:--'}
                                        </Badge>
                                    </div>
                                </OverlayView>
                            ))}
                        </React.Fragment>
                    ))}
                </GoogleMap>
            ) : <div className="flex h-full w-full items-center justify-center text-white font-black uppercase text-xs animate-pulse">Initialisation des systèmes...</div>}
        </div>

        <div 
            id="windy" 
            style={{ width: '100%', height: '100%' }}
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
                    if (nextStatus) { if (!isWindyLoaded) initWindy(); setViewMode('google'); }
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
                    if (nextMode === 'windy' && !isWindyLoaded) { 
                        requestAnimationFrame(() => initWindy());
                    }
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
            <Card className="border-2 shadow-lg bg-muted/5 relative overflow-hidden">
                <CardHeader className="p-4 border-b bg-muted/10 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Target className="size-4" /> Signalement Tactique
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black text-destructive" onClick={handleClearTactical}>EFFACER</Button>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                            { id: 'MARLIN', icon: Fish, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { id: 'THON', icon: Fish, color: 'text-red-600', bg: 'bg-red-50' },
                            { id: 'OISEAUX', icon: Bird, color: 'text-orange-600', bg: 'bg-orange-50' },
                            { id: 'SARDINES', icon: Waves, color: 'text-cyan-600', bg: 'bg-cyan-50' }
                        ].map(sig => (
                            <Button key={sig.id} variant="outline" className={cn("h-16 flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95", sig.bg)} onClick={() => handleTacticalReport(sig.id)}>
                                <sig.icon className={cn("size-5", sig.color)} />
                                <span className={cn("text-[8px] font-black uppercase", sig.color)}>{sig.id}</span>
                            </Button>
                        ))}
                        <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95 bg-purple-50" onClick={() => photoInputRef.current?.click()} disabled={isCapturingPhoto}>
                            <Camera className={cn("size-5 text-purple-600", isCapturingPhoto && "animate-spin")} />
                            <span className="text-[8px] font-black uppercase text-purple-600">{isCapturingPhoto ? '...' : 'PRISE'}</span>
                        </Button>
                        <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={handlePhotoCapture} />
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isSharing ? (
                    <Button variant="destructive" className="h-16 font-black uppercase shadow-xl rounded-2xl border-4 border-white/20 gap-3" onClick={handleStopSharing}>
                        <X className="size-6" /> STOP PARTAGE
                    </Button>
                ) : (
                    <Button className="h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3" onClick={() => setIsSharing(true)}>
                        <Navigation className="size-6" /> LANCER PARTAGE
                    </Button>
                )}
                
                <Button 
                    variant={anchorPos ? 'default' : 'outline'} 
                    className={cn("h-16 font-black uppercase rounded-2xl border-2 gap-3 shadow-lg", anchorPos ? "bg-blue-600 border-blue-400" : "bg-white border-blue-100 text-blue-600")} 
                    onClick={handleMooringToggle}
                >
                    <Anchor className={cn("size-6", anchorPos && "animate-pulse")} />
                    {anchorPos ? 'MOUILLAGE ACTIF' : 'MOUILLAGE'}
                </Button>
            </div>
        </div>

        <Card className="border-2 shadow-sm overflow-hidden h-full">
            <CardHeader className="p-4 border-b bg-muted/5 flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><HistoryIcon className="size-3" /> Journal technique</CardTitle>
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
                                        <span className={cn("font-black", h.statusLabel.includes('ALERTE') || h.statusLabel === 'SOS' ? 'text-red-600' : '')}>{h.statusLabel}</span>
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
          <AccordionItem value="identity-settings" className="border-none">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl border-2 border-dashed border-primary/10">
                  <Settings className="size-4 text-primary" />
                  <span className="text-[10px] font-black uppercase">Identité & IDs</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-6">
                  <Card className="border-2 border-dashed p-4 space-y-6 bg-card shadow-inner rounded-3xl">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                          <div className="flex items-center gap-3">
                              <Ghost className={cn("size-5", isGhostMode ? "text-primary" : "text-muted-foreground")} />
                              <div>
                                  <p className="text-[10px] font-black uppercase">Mode Fantôme</p>
                                  <p className="text-[8px] font-bold text-muted-foreground uppercase">Masquer ma position sur les cartes distantes</p>
                              </div>
                          </div>
                          <Switch checked={isGhostMode} onCheckedChange={(v) => { setIsGhostMode(v); handleSaveVesselIdentity('vessel'); }} />
                      </div>

                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label>
                          <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="KOOLAPIK" className="font-black text-center h-12 border-2 uppercase text-base" />
                      </div>

                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du navire (Partage individuel)</Label>
                          <div className="flex gap-2">
                              <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="TEST" className="font-black text-center h-12 border-2 uppercase text-base tracking-widest flex-1" />
                              <Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={() => handleSaveVesselIdentity('vessel')}><Save className="size-4" /></Button>
                          </div>
                      </div>

                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">ID Groupe Flotte C (Partage collectif)</Label>
                          <div className="flex gap-2">
                              <Input value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} placeholder="ABC" className="font-black text-center h-12 border-2 border-blue-100 bg-blue-50/30 uppercase text-base tracking-widest flex-1" />
                              <Button variant="outline" size="icon" className="h-12 w-12 border-2 border-blue-200 text-blue-600" onClick={() => handleSaveVesselIdentity('fleet')}><Save className="size-4" /></Button>
                          </div>
                      </div>

                      <div className="space-y-4 pt-2 border-t border-dashed">
                          <div className="flex justify-between items-center px-1">
                              <Label className="text-[9px] font-black uppercase opacity-60">Rayon de mouillage (m)</Label>
                              <Badge variant="outline" className="font-black h-6">{mooringRadius}m</Badge>
                          </div>
                          <Slider value={[mooringRadius]} min={10} max={500} step={10} onValueChange={v => setMooringRadius(v[0])} />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-dashed">
                          <p className="text-[9px] font-black uppercase text-muted-foreground ml-1">Historique des IDs</p>
                          <div className="space-y-2">
                              {customSharingId && (
                                  <div className="flex items-center justify-between p-3 bg-white border-2 rounded-xl text-[10px] font-black uppercase">
                                      <div className="flex items-center gap-2"><Navigation className="size-3 text-primary" /> {customSharingId}</div>
                                      <div className="flex gap-2"><RefreshCw className="size-3.5 opacity-40" /><X className="size-3.5 text-red-400" /></div>
                                  </div>
                              )}
                              {customFleetId && (
                                  <div className="flex items-center justify-between p-3 bg-white border-2 rounded-xl text-[10px] font-black uppercase border-blue-100">
                                      <div className="flex items-center gap-2"><Users className="size-3 text-blue-600" /> {customFleetId}</div>
                                      <div className="flex gap-2"><RefreshCw className="size-3.5 opacity-40" /><X className="size-3.5 text-red-400" /></div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </Card>
              </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sms-config" className="border-none mt-2">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50 border-2 border-orange-100 rounded-xl">
                <Smartphone className="size-4 text-orange-600" />
                <span className="text-[10px] font-black uppercase text-orange-800">SMS d'Urgence</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <div className="p-4 bg-white border-2 rounded-2xl space-y-4 shadow-inner">
                      <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Contact Terre</Label><Input placeholder="77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">Message SOS personnalisé</Label><Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="min-h-[80px] border-2" /></div>
                      <div className="p-3 bg-muted/30 rounded-xl border-2 border-dashed text-[10px] italic">Aperçu : {smsPreview}</div>
                      <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] gap-2 shadow-lg"><Save className="size-4" /> Sauver réglages SMS</Button>
                  </div>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      <Dialog open={!!selectedMarkerPhoto} onOpenChange={(o) => !o && setSelectedMarkerPhoto(null)}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-4 bg-slate-900 text-white shrink-0">
                <DialogTitle className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
                    <ImageIcon className="size-4 text-primary" /> Visualisation de la Prise
                </DialogTitle>
            </DialogHeader>
            <div className="aspect-square w-full bg-black flex items-center justify-center">
                {selectedMarkerPhoto && <img src={selectedMarkerPhoto} className="w-full h-full object-contain" alt="Capture tactique" />}
            </div>
            <div className="p-4 bg-slate-50 flex justify-center border-t">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2" onClick={() => setSelectedMarkerPhoto(null)}>Fermer</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
