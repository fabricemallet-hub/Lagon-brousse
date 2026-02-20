
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
  Ghost,
  Users,
  Timer
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, WindDirection, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

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

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);

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

  // LOGS
  const [technicalLogs, setTechnicalLogs] = useState<{ 
    vesselName: string, 
    statusLabel: string, 
    time: Date, 
    pos: {lat: number, lng: number}, 
    batteryLevel?: number, 
    isCharging?: boolean,
    duration?: string,
    accuracy?: number
  }[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  const [selectedMarkerPhoto, setSelectedMarkerPhoto] = useState<string | null>(null);
  
  // AUDIO
  const [vesselPrefs, setVesselPrefs] = useState({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte' },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20,
    mooringRadius: 100
  });
  const [loopEnabled, setLoopEnabled] = useState<Record<string, boolean>>({});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAnyAudioPlaying, setIsAnyAudioPlaying] = useState(false);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);
  
  const shouldPanOnNextFix = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const lastUpdatePosRef = useRef<{ lat: number, lng: number } | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (mode === 'fleet' && fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true));
    }
    if (savedVesselIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', savedVesselIds.slice(0, 10)));
  }, [firestore, savedVesselIds, mode, fleetId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.filter(s => 
      !s.categories || s.categories.includes('Vessel') || s.categories.includes('General')
    ).map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (profile) {
        if (profile.vesselNickname) setVesselNickname(profile.vesselNickname);
        if (profile.lastVesselId) setCustomSharingId(profile.lastVesselId);
        if (profile.lastFleetId) setCustomFleetId(profile.lastFleetId);
        if (profile.isGhostMode !== undefined) setIsGhostMode(profile.isGhostMode);
        if (profile.vesselPrefs) setVesselPrefs(prev => ({ ...prev, ...profile.vesselPrefs }));
        if (profile.emergencyContact) setEmergencyContact(profile.emergencyContact);
        if (profile.vesselSmsMessage) setVesselSmsMessage(profile.vesselSmsMessage);
    }
  }, [profile]);

  // --- HANDLERS ---
  const stopAllAudio = () => {
    if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
    }
    setIsAnyAudioPlaying(false);
  };

  const handleStopSharing = useCallback(async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setIsInitializing(false);
    setStartTime(null);
    stopAllAudio();
    
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), { 
            isSharing: false, 
            lastActive: serverTimestamp(),
            statusChangedAt: serverTimestamp() 
        });
    } catch (e) {}

    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    setCurrentPos(null);
    setAnchorPos(null);
    lastSentStatusRef.current = null;
    toast({ title: "Partage arrêté" });
  }, [user, firestore, sharingId, toast]);

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

  const playVesselSound = useCallback((soundId: string, shouldLoop: boolean = false) => {
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      stopAllAudio();
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.loop = shouldLoop;
      audio.play().catch(() => {});
      activeAudioRef.current = audio;
      setIsAnyAudioPlaying(true);
    }
  }, [availableSounds, vesselPrefs.vesselVolume]);

  const handleTacticalReport = async (type: string, photo?: string) => {
    if (!user || !firestore || !currentPos || !isSharing) {
        toast({ variant: "destructive", title: "GPS requis" });
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
        await updateDoc(doc(firestore, 'vessels', sharingId), { 
            huntingMarkers: arrayUnion(marker) 
        });
        toast({ title: `Point ${type} épinglé !` });
    } catch (e) {}
  };

  const handleClearTactical = async () => {
    if (!user || !firestore || !isSharing) return;
    await updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: [] });
    toast({ title: "Carte nettoyée" });
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    if (st === 'moving') setAnchorPos(null);
    toast({ title: label || (st === 'returning' ? 'Retour Maison' : st === 'landed' ? 'À terre' : 'Mode Auto') });
  };

  const handleRecenter = () => {
    if (currentPos && googleMap) {
        googleMap.setZoom(18);
        googleMap.panTo(currentPos);
    } else {
        shouldPanOnNextFix.current = true;
        if (!isSharing) setIsSharing(true);
    }
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const handleSaveIdentity = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            vesselNickname,
            lastVesselId: customSharingId.toUpperCase(),
            lastFleetId: customFleetId.toUpperCase(),
            isGhostMode,
            vesselPrefs: { ...vesselPrefs, mooringRadius }
        });
        toast({ title: "Identité sauvegardée" });
    } catch (e) {}
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
        toast({ title: "Réglages SMS sauvegardés" });
    } catch (e) {}
  };

  // --- TRACKING CORE ---
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    setIsInitializing(true);
    setStartTime(new Date());
    lastUpdateTimeRef.current = Date.now();

    const startTrackingAfterDelay = setTimeout(() => {
        setIsInitializing(false);
    }, 30000);

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, Math.round((speed || 0) * 1.94384));
            
            setCurrentPos(newPos);
            setCurrentSpeed(knotSpeed);
            if (isFollowMode && googleMap) googleMap.panTo(newPos);

            if (isInitializing) return;

            const now = Date.now();
            const timeDiff = (now - lastUpdateTimeRef.current) / 1000;
            let distMoved = 0;
            if (lastUpdatePosRef.current) {
                distMoved = getDistance(newPos.lat, newPos.lng, lastUpdatePosRef.current.lat, lastUpdatePosRef.current.lng);
            }

            let nextStatus: VesselStatus['status'] = vesselStatus;
            let eventLabel: string | null = null;

            if (knotSpeed > 2 || distMoved > 100) {
                if (vesselStatus !== 'moving') {
                    nextStatus = 'moving';
                    eventLabel = 'EN MOUVEMENT';
                    setAnchorPos(null);
                }
            } else if (distMoved > 20 && distMoved <= 100 && timeDiff >= 60) {
                if (vesselStatus !== 'drifting') {
                    nextStatus = 'drifting';
                    eventLabel = 'À LA DÉRIVE !';
                    playVesselSound('alerte', loopEnabled['batterie']);
                }
            } else if (distMoved <= 20 && timeDiff >= 60) {
                if (vesselStatus !== 'stationary') {
                    nextStatus = 'stationary';
                    eventLabel = 'AU MOUILLAGE';
                }
            }

            if (nextStatus !== vesselStatus || eventLabel) {
                setVesselStatus(nextStatus);
                const durationMinutes = startTime ? differenceInMinutes(new Date(), startTime) : 0;
                const logEntry = {
                    vesselName: vesselNickname || 'Mon Navire',
                    statusLabel: eventLabel || nextStatus.toUpperCase(),
                    time: new Date(),
                    pos: newPos,
                    duration: `ACTIF ${durationMinutes} MIN`,
                    accuracy: Math.round(accuracy)
                };
                setTechnicalLogs(prev => [logEntry, ...prev].slice(0, 50));
                updateVesselInFirestore({ location: { latitude, longitude }, status: nextStatus, eventLabel, accuracy: Math.round(accuracy) });
            }

            if (timeDiff >= 60) {
                lastUpdatePosRef.current = newPos;
                lastUpdateTimeRef.current = now;
            }
        },
        () => toast({ variant: 'destructive', title: "GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        clearTimeout(startTrackingAfterDelay);
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, isInitializing, vesselStatus, startTime, playVesselSound, loopEnabled, toast, updateVesselInFirestore, vesselNickname, googleMap, isFollowMode]);

  const handleMooringToggle = () => {
    if (anchorPos) {
        setAnchorPos(null);
        setVesselStatus('moving');
        updateVesselInFirestore({ status: 'moving', anchorLocation: null, eventLabel: 'ANCRE LEVÉE' });
        toast({ title: "Ancre levée" });
    } else if (currentPos) {
        setAnchorPos(currentPos);
        setVesselStatus('stationary');
        updateVesselInFirestore({ status: 'stationary', anchorLocation: { latitude: currentPos.lat, longitude: currentPos.lng }, eventLabel: 'AU MOUILLAGE' });
        toast({ title: "Mouillage actif", description: `Rayon : ${mooringRadius}m` });
    }
  };

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    return `${nicknamePrefix}${customText} [MAYDAY/PAN PAN] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname]);

  const sendEmergencySms = (type: string) => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const body = `${vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : ""}${vesselSmsMessage || "Assistance requise."} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const filteredVessels = useMemo(() => {
    if (!followedVessels) return [];
    return followedVessels.filter(v => {
        if (v.id === sharingId) return true;
        if (v.isGhostMode && mode === 'fleet') return false;
        return true;
    });
  }, [followedVessels, sharingId, mode]);

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32 transition-all", vesselStatus === 'drifting' && "bg-red-500/10")}>
      
      {isAnyAudioPlaying && (
          <Button 
            variant="destructive" 
            className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] h-12 px-8 font-black uppercase shadow-2xl animate-bounce border-4 border-white"
            onClick={stopAllAudio}
          >
            <Volume2 className="size-5 mr-2" /> ARRÊTER LE SON
          </Button>
      )}

      <div className="flex bg-muted/30 p-1 rounded-xl border shadow-inner">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => setMode('fleet')}>Flotte (C)</Button>
      </div>

      <div className={cn("w-full text-white rounded-2xl p-4 shadow-xl border relative overflow-hidden transition-all", isInitializing ? "bg-orange-500" : vesselStatus === 'drifting' ? "bg-red-600 animate-pulse" : "bg-slate-900")}>
          <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4"><Navigation className="size-32" /></div>
          <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl", vesselStatus === 'drifting' ? "bg-white text-red-600" : "bg-primary text-white")}>
                      {vesselStatus === 'stationary' ? <Anchor className="size-6" /> : <Navigation className="size-6" />}
                  </div>
                  <div>
                      <div className="flex items-center gap-2">
                        {isSharing && <div className="size-2 rounded-full bg-green-400 animate-pulse" />}
                        <h2 className="text-[10px] font-black uppercase tracking-widest">{isInitializing ? 'INITIALISATION...' : vesselStatus === 'drifting' ? 'ALERTE DÉRIVE !' : vesselStatus === 'stationary' ? 'AU MOUILLAGE' : 'EN MOUVEMENT'}</h2>
                      </div>
                      <p className="text-2xl font-black tracking-tighter">{currentSpeed} <span className="text-xs opacity-60">KTS</span></p>
                  </div>
              </div>
              <div className="text-right">
                  <span className="text-[8px] font-black uppercase text-white/40">ID ACTIF</span>
                  <p className="text-sm font-mono font-black">{sharingId}</p>
              </div>
          </div>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-950", isFullscreen ? "fixed inset-0 z-[150] h-screen w-screen rounded-none" : "h-[500px]")}>
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
            {anchorPos && (
                <>
                    <OverlayView position={anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div className="p-1 bg-white rounded-full border-2 border-primary shadow-xl" style={{ transform: 'translate(-50%, -50%)' }}><Anchor className="size-4 text-primary" /></div>
                    </OverlayView>
                    <Circle center={anchorPos} radius={mooringRadius} options={{ fillColor: '#3b82f6', fillOpacity: 0.15, strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 2 }} />
                </>
            )}
            {filteredVessels.map(v => v.id !== sharingId && v.location && (
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
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}</Button>
            <Button onClick={handleRecenter} className="h-10 bg-primary text-white border-2 border-white/20 px-3 gap-2 shadow-xl font-black uppercase text-[9px]">RECENTRER <LocateFixed className="size-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
              <Card className="border-2 shadow-lg bg-muted/5">
                  <CardHeader className="p-4 border-b bg-muted/10 flex flex-row items-center justify-between">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Target className="size-4" /> Signalement Tactique</CardTitle>
                      <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black text-destructive" onClick={handleClearTactical}>EFFACER</Button>
                  </CardHeader>
                  <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleTacticalReport('OISEAUX')}><Bird className="size-4 text-orange-600" /> SIGNALER OISEAUX</Button>
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => photoInputRef.current?.click()}><Camera className="size-4 text-purple-600" /> SIGNALER PRISE</Button>
                          <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => handleTacticalReport('PRISE', ev.target?.result as string);
                                  reader.readAsDataURL(file);
                              }
                          }} />
                      </div>
                  </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button variant={vesselStatus === 'returning' ? 'default' : 'outline'} className="h-14 font-black uppercase text-xs border-2 gap-2" onClick={() => handleManualStatus('returning')}><Navigation className="size-4 text-blue-500" /> RETOUR MAISON</Button>
                  <Button variant={vesselStatus === 'landed' ? 'default' : 'outline'} className="h-14 font-black uppercase text-xs border-2 gap-2" onClick={() => handleManualStatus('landed')}><Home className="size-4 text-green-500" /> HOME (À TERRE)</Button>
              </div>

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
                                          <span className={cn("font-black", h.statusLabel.includes('ALERTE') ? 'text-red-600' : '')}>{h.statusLabel}</span>
                                          <span className="text-[8px] font-black text-blue-600">{h.duration}</span>
                                      </div>
                                      <div className="flex items-center gap-2 opacity-40">
                                          <span className="text-[8px] font-bold uppercase">{format(h.time, 'HH:mm:ss')}</span>
                                          <span className="text-[8px] font-bold uppercase">Acc: +/- {h.accuracy}m</span>
                                      </div>
                                  </div>
                                  <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => googleMap?.panTo(h.pos)}>GPS</Button>
                              </div>
                          ))}
                      </div>
                  </ScrollArea>
              </CardContent>
          </Card>
      </div>

      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="identity" className="border-none">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl border-2 border-dashed">
                  <Settings className="size-4 text-primary" />
                  <span className="text-[10px] font-black uppercase">Réglages Identité & Flotte</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-6">
                  <Card className="border-2 p-4 space-y-6 bg-card shadow-inner rounded-3xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Surnom du navire</Label>
                              <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="KOOLAPIK" className="font-black h-12 border-2 uppercase" />
                          </div>
                          <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID Navire (Récepteur B)</Label>
                              <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="NAV-XXXX" className="font-black h-12 border-2 uppercase" />
                          </div>
                          <div className="space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">ID Flotte C (Groupe)</Label>
                              <Input value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} placeholder="AMIS-NC" className="font-black h-12 border-2 uppercase border-blue-100" />
                          </div>
                          <div className="space-y-4 pt-2">
                              <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-black uppercase opacity-60">Rayon Mouillage (m)</Label>
                                  <Badge variant="outline" className="font-black">{mooringRadius}m</Badge>
                              </div>
                              <Slider value={[mooringRadius]} min={10} max={200} step={10} onValueChange={v => setMooringRadius(v[0])} />
                          </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                          <div className="flex items-center gap-3">
                              <Ghost className={cn("size-5", isGhostMode ? "text-primary" : "text-muted-foreground")} />
                              <div><p className="text-[10px] font-black uppercase">Mode Fantôme</p><p className="text-[8px] font-bold text-muted-foreground uppercase">Masqué pour Flotte C uniquement</p></div>
                          </div>
                          <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                      </div>

                      <Button onClick={handleSaveIdentity} className="w-full h-12 font-black uppercase tracking-widest shadow-lg gap-2"><Save className="size-4" /> Sauvegarder Profil</Button>
                  </Card>
              </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notifications" className="border-none mt-2">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl border-2 border-dashed">
                  <Volume2 className="size-4 text-primary" />
                  <span className="text-[10px] font-black uppercase">Notifications Sonores</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <Card className="border-2 p-4 space-y-6 bg-card shadow-inner rounded-3xl">
                      <div className="flex items-center justify-between">
                          <div className="space-y-0.5"><Label className="text-xs font-black uppercase">Sons Actifs</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Alertes audio en direct</p></div>
                          <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                      </div>

                      <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase opacity-60">Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
                          <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} step={1} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
                      </div>

                      <div className="grid gap-3 pt-2">
                          {['moving', 'stationary', 'offline'].map(key => (
                              <div key={key} className="flex items-center justify-between gap-4">
                                  <span className="text-[9px] font-black uppercase flex-1">{key === 'moving' ? 'MOUVEMENT' : key === 'stationary' ? 'MOUILLAGE' : 'SIGNAL PERDU'}</span>
                                  <Select value={vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds] || ''} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [key]: v } })}>
                                      <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-muted/30"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                      <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <div className="flex items-center gap-1">
                                      <button onClick={() => setLoopEnabled(prev => ({ ...prev, [key]: !prev[key] }))} className={cn("p-1.5 rounded-lg border-2", loopEnabled[key] ? "bg-primary text-white border-primary" : "bg-white border-slate-100")}><RefreshCw className={cn("size-3", loopEnabled[key] && "animate-spin")} /></button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playVesselSound(vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds] || 'sonar', loopEnabled[key])}><Play className="size-3" /></Button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      <Card className="border-2 border-orange-200 bg-orange-50/30">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] font-black uppercase text-orange-800 flex items-center gap-2"><Smartphone className="size-3" /> SMS d'Urgence</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
              <div className="p-3 bg-white border-2 border-dashed rounded-xl italic text-[10px] font-medium leading-relaxed text-slate-600">"{smsPreview}"</div>
              <Button variant="destructive" className="w-full h-12 font-black uppercase text-[10px] gap-2" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-4" /> ENVOYER MAYDAY</Button>
          </CardContent>
      </Card>

      <Dialog open={!!selectedMarkerPhoto} onOpenChange={(o) => !o && setSelectedMarkerPhoto(null)}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <div className="aspect-square w-full bg-black flex items-center justify-center">{selectedMarkerPhoto && <img src={selectedMarkerPhoto} className="w-full h-full object-contain" alt="" />}</div>
            <div className="p-4 bg-slate-50 flex justify-center border-t"><Button variant="outline" className="font-black uppercase text-[10px] border-2" onClick={() => setSelectedMarkerPhoto(null)}>Fermer</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
