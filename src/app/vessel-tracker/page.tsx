
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, getDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  History,
  MapPin,
  X,
  Play,
  Volume2,
  Check,
  Trash2,
  RefreshCw,
  Settings,
  Smartphone,
  Ghost,
  VolumeX,
  Home,
  Compass,
  Clock,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Eye,
  EyeOff,
  ChevronUp,
  Users,
  Search,
  Bird,
  Fish,
  Waves,
  Camera,
  MessageSquare
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="size-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
);

type LogEntry = {
    vesselName: string;
    statusLabel: string;
    startTime: Date;
    lastUpdateTime: Date;
    pos: google.maps.LatLngLiteral;
    durationMinutes: number;
    batteryLevel?: number;
    isCharging?: boolean;
};

const TACTICAL_OPTIONS = [
    { id: 'OISEAUX', label: 'OISEAUX', icon: Bird, color: 'bg-white text-blue-600 border-blue-200' },
    { id: 'MARLIN', label: 'MARLIN', icon: Fish, color: 'bg-indigo-900 text-white border-indigo-800' },
    { id: 'THON', label: 'THON', icon: Array.isArray(Fish) ? Fish[0] : Fish, color: 'bg-red-600 text-white border-red-500' },
    { id: 'TAZARD', label: 'TAZARD', icon: Fish, color: 'bg-slate-600 text-white border-slate-500' },
    { id: 'WAHOO', label: 'WAHOO', icon: Fish, color: 'bg-cyan-600 text-white border-cyan-500' },
    { id: 'BONITE', label: 'BONITE', icon: Fish, color: 'bg-blue-600 text-white border-blue-500' },
    { id: 'SARDINES', label: 'SARDINES', icon: Waves, color: 'bg-emerald-500 text-white border-emerald-400' },
];

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // --- 1. STATES ---
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [mapZoom, setMapZoom] = useState(10);
  
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'stabilizing'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<{url: string, title: string} | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: '', stationary: '', offline: '' },
    mooringRadius: 20,
    batteryThreshold: 20
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);

  // --- 2. DATA FETCHING ---
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselIdHistory = userProfile?.vesselIdHistory || [];
  const fleetIdHistory = userProfile?.fleetIdHistory || [];

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const queryIds = [...savedVesselIds];
    if (mode === 'fleet' && fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId));
    }
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing, mode, fleetId]);
  
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

  // --- 3. REFS & UTILS ---
  const watchIdRef = useRef<number | null>(null);
  const stabilizationPoints = useRef<google.maps.LatLngLiteral[]>([]);
  const lastContactTimeRef = useRef<number>(Date.now());
  const statusCycleRef = useRef<NodeJS.Timeout | null>(null);
  const currentAccuracyRef = useRef<number>(0);

  const playVesselSound = useCallback((soundId: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

  const updateLog = useCallback((vName: string, label: string, pos: google.maps.LatLngLiteral) => {
    setHistory(prev => {
        const now = new Date();
        const lastEntry = prev[0];
        if (lastEntry && lastEntry.vesselName === vName && lastEntry.statusLabel === label) {
            return [{
                ...lastEntry,
                lastUpdateTime: now,
                pos: pos,
                durationMinutes: Math.max(0, differenceInMinutes(now, lastEntry.startTime))
            }, ...prev.slice(1)];
        } else {
            return [{
                vesselName: vName,
                statusLabel: label,
                startTime: now,
                lastUpdateTime: now,
                pos: pos,
                durationMinutes: 0
            }, ...prev].slice(0, 50);
        }
    });
  }, []);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    const update = async () => {
        let batteryInfo: any = {};
        if ('getBattery' in navigator) {
            try {
                const b: any = await (navigator as any).getBattery();
                batteryInfo.batteryLevel = Math.round(b.level * 100);
                batteryInfo.isCharging = b.charging;
            } catch (e) {}
        }
        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            isGhostMode: data.isGhostMode !== undefined ? data.isGhostMode : isGhostMode,
            fleetId: fleetId || null,
            lastActive: serverTimestamp(),
            mooringRadius: mooringRadius,
            ...batteryInfo,
            ...data 
        };
        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, fleetId, mooringRadius]);

  // --- 4. GPS TRACKING CORE ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    setSessionStartTime(new Date());
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
        currentAccuracyRef.current = accuracy;
        lastContactTimeRef.current = Date.now();
        if (vesselStatus === 'offline' && accuracy < 20) {
            setVesselStatus('moving'); 
            updateLog(vesselNickname || 'MOI', 'REPRISE SIGNAL (OK)', newPos);
        }
        if (accuracy < 100) updateVesselInFirestore({ location: { latitude, longitude }, accuracy });
        if (isFollowing && map) map.panTo(newPos);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore, vesselStatus, vesselNickname, updateLog]);

  // --- 5. STABILIZATION & CYCLE LOGIC ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        if (statusCycleRef.current) clearInterval(statusCycleRef.current);
        return;
    }
    const startStabilization = async () => {
        setVesselStatus('stabilizing');
        stabilizationPoints.current = [];
        await new Promise(r => setTimeout(r, 1000));
        if (currentPos) stabilizationPoints.current[0] = currentPos;
        await new Promise(r => setTimeout(r, 9000));
        if (currentPos) {
            const p1 = stabilizationPoints.current[0];
            const p2 = currentPos;
            if (p1 && p2) {
                const dist = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
                const isStationary = dist < mooringRadius;
                const initialStatus = isStationary ? 'stationary' : 'moving';
                setVesselStatus(initialStatus);
                if (isStationary) setAnchorPos(p1);
                const label = isStationary ? 'AU MOUILLAGE' : 'EN MOUVEMENT';
                updateLog(vesselNickname || 'MOI', label, p2);
                updateVesselInFirestore({ 
                    status: initialStatus as any, 
                    anchorLocation: isStationary ? { latitude: p1.lat, longitude: p1.lng } : null 
                });
            } else { setVesselStatus('moving'); }
        } else { setVesselStatus('moving'); }

        statusCycleRef.current = setInterval(() => {
            if (!currentPos) return;
            setVesselStatus(currentStatus => {
                let nextStatus = currentStatus;
                let eventLabel = '';
                if (currentStatus === 'stationary' && anchorPos) {
                    const distFromAnchor = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
                    if (distFromAnchor > 100) { nextStatus = 'moving'; setAnchorPos(null); eventLabel = 'EN MOUVEMENT (ANCRE LEVÉE)'; } 
                    else if (distFromAnchor > mooringRadius) { nextStatus = 'drifting'; eventLabel = 'À LA DÉRIVE !'; }
                } else if (currentStatus === 'drifting' && anchorPos) {
                    const distFromAnchor = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
                    if (distFromAnchor > 100) { nextStatus = 'moving'; setAnchorPos(null); eventLabel = 'EN MOUVEMENT'; } 
                    else if (distFromAnchor < mooringRadius) { nextStatus = 'stationary'; eventLabel = 'AU MOUILLAGE (STABILISÉ)'; }
                }
                const displayLabel = eventLabel || (nextStatus === 'moving' ? 'EN MOUVEMENT' : nextStatus === 'stationary' ? 'AU MOUILLAGE' : 'DÉRIVE');
                updateLog(vesselNickname || 'MOI', displayLabel, currentPos);
                updateVesselInFirestore({ status: nextStatus as any, eventLabel: eventLabel || null });
                return nextStatus;
            });
        }, 30000);
    };
    startStabilization();
    return () => { if (statusCycleRef.current) clearInterval(statusCycleRef.current); };
  }, [isSharing, mode, vesselNickname, mooringRadius, anchorPos, currentPos, updateLog, updateVesselInFirestore]);

  // 6. TACTICAL & SIGNAL HELPERS
  const handleTacticalSignal = async (typeId: string) => {
    if (!user || !firestore || !currentPos) return;
    const marker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date().toISOString(),
        label: typeId
    };
    await updateDoc(doc(firestore, 'vessels', sharingId), {
        huntingMarkers: arrayUnion(marker)
    });
    playVesselSound('sonar');
    toast({ title: `Signalement : ${typeId}`, description: "Épinglé sur la carte." });
  };

  const handleCapturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPos) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const marker: HuntingMarker = {
            id: Math.random().toString(36).substring(7),
            lat: currentPos.lat,
            lng: currentPos.lng,
            time: new Date().toISOString(),
            label: 'PRISE',
            photoUrl: base64
        };
        await updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: arrayUnion(marker) });
        toast({ title: "Photo partagée !" });
    };
    reader.readAsDataURL(file);
  };

  const handleManualStatus = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label });
    updateLog(vesselNickname || 'MOI', label, currentPos || INITIAL_CENTER);
    toast({ title: label });
  };

  const handleEmergency = async () => {
    setIsGhostMode(false);
    setVesselStatus('emergency');
    updateVesselInFirestore({ status: 'emergency', isGhostMode: false, eventLabel: 'DEMANDE D\'ASSISTANCE' });
    updateLog(vesselNickname || 'MOI', '🚨 DEMANDE D\'ASSISTANCE 🚨', currentPos || INITIAL_CENTER);
    toast({ variant: 'destructive', title: "ALERTE ENVOYÉE", description: "Votre position est désormais visible par tous." });
  };

  const activeMinutes = useMemo(() => {
    if (!sessionStartTime) return 0;
    return Math.max(0, differenceInMinutes(new Date(), sessionStartTime));
  }, [sessionStartTime, currentPos]);

  const handleSaveId = async (type: 'vessel' | 'fleet') => {
    if (!user || !firestore) return;
    const value = (type === 'vessel' ? customSharingId : customFleetId).trim().toUpperCase();
    if (!value) return;
    const userRef = doc(firestore, 'users', user.uid);
    if (type === 'vessel') await updateDoc(userRef, { lastVesselId: value, vesselIdHistory: arrayUnion(value) });
    else await updateDoc(userRef, { lastFleetId: value, fleetIdHistory: arrayUnion(value) });
    toast({ title: "ID Enregistré" });
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null); setAnchorPos(null); setSessionStartTime(null);
    toast({ title: "Partage arrêté" });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('fleet')}>Flotte (C)</Button>
        </div>

        <CardContent className="p-4 space-y-4">
          {mode === 'sender' && (
            <div className="space-y-6">
              {!isSharing ? (
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                    <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                    <Switch checked={isSharing} onCheckedChange={(v) => { if (v) setIsSharing(true); }} />
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white transition-all duration-500", 
                        vesselStatus === 'emergency' ? "bg-red-600 animate-pulse" : 
                        vesselStatus === 'drifting' ? "bg-orange-600" :
                        vesselStatus === 'landed' ? "bg-green-600" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                                {vesselStatus === 'moving' ? 'En mouvement' : 
                                 vesselStatus === 'stationary' ? 'Au mouillage' : 
                                 vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 
                                 vesselStatus === 'returning' ? 'RETOUR MAISON' :
                                 vesselStatus === 'landed' ? 'À TERRE' :
                                 vesselStatus === 'emergency' ? 'URGENCE' : 'STABILISATION...'}
                            </span>
                            <span className="text-[10px] font-black uppercase ml-auto bg-black/20 px-2 py-1 rounded">ACTIF {activeMinutes} MIN</span>
                        </div>
                    </div>

                    <div className="bg-muted/10 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><Move className="size-3" /> Signalisation Manuelle</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-12 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleManualStatus('returning', 'RETOUR MAISON')}><Navigation className="size-4 text-blue-600" /> Retour Maison</Button>
                            <Button variant="outline" className="h-12 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleManualStatus('landed', 'HOME (À TERRE)')}><Home className="size-4 text-green-600" /> Home (À terre)</Button>
                        </div>
                    </div>

                    <div className="bg-muted/10 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><Zap className="size-3" /> Signalement Tactique (Flotte)</p>
                        <div className="grid grid-cols-4 gap-2">
                            {TACTICAL_OPTIONS.map(opt => (
                                <Button key={opt.id} className={cn("h-12 flex flex-col items-center justify-center p-1 border-2", opt.color)} onClick={() => handleTacticalSignal(opt.id)}>
                                    <opt.icon className="size-4 mb-0.5" />
                                    <span className="text-[7px] font-black">{opt.label}</span>
                                </Button>
                            ))}
                            <Button className="h-12 flex flex-col items-center justify-center p-1 bg-emerald-600 text-white border-emerald-500" onClick={() => photoInputRef.current?.click()}>
                                <Camera className="size-4 mb-0.5" />
                                <span className="text-[7px] font-black">PRISE</span>
                            </Button>
                            <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={handleCapturePhoto} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Button variant="destructive" className="w-full h-14 font-black uppercase tracking-tight shadow-xl gap-3 border-2 border-white/20" onClick={handleEmergency}>
                            <ShieldAlert className="size-6" /> DEMANDE D'ASSISTANCE
                        </Button>
                        <Button variant="destructive" className="w-full h-14 font-black uppercase tracking-tight opacity-90 gap-3" onClick={handleStopSharing}>
                            <X className="size-6" /> Arrêter le partage / Quitter
                        </Button>
                    </div>
                </div>
              )}

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl border">
                        <Settings className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Identité & IDs</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="p-4 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-black uppercase flex items-center gap-2"><Ghost className="size-4" /> Mode Fantôme</Label>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Masquer ma position sur les cartes distantes</p>
                            </div>
                            <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Surnom du navire</Label>
                            <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-black text-center h-12 border-2 uppercase" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID Navire (Individuel)</Label>
                            <div className="flex gap-2">
                                <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" />
                                <Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={() => handleSaveId('vessel')}><Save className="size-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID Groupe Flotte C (Collectif)</Label>
                            <div className="flex gap-2">
                                <Input value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" />
                                <Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={() => handleSaveId('fleet')}><Save className="size-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[9px] font-black uppercase opacity-60">Rayon de mouillage (M)</Label>
                                <Badge variant="outline" className="font-black bg-white">{mooringRadius}m</Badge>
                            </div>
                            <Slider value={[mooringRadius]} min={10} max={100} step={5} onValueChange={v => setMooringRadius(v[0])} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {mode === 'receiver' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label>
                <div className="flex gap-2">
                    <Input placeholder="ID EX: BATEAU-1" value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" />
                    <Button variant="outline" className="h-12 w-12 border-2 shrink-0" onClick={() => { if(vesselIdToFollow) { updateDoc(doc(firestore!, 'users', user!.uid), { savedVesselIds: arrayUnion(vesselIdToFollow.trim().toUpperCase()) }); setVesselIdToFollow(''); } }}><Plus className="size-4" /></Button>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Ma Flotte Suivie</Label>
                <div className="grid gap-2">
                    {savedVesselIds.map(id => {
                        const v = followedVessels?.find(v => v.id === id);
                        const isActive = v?.isSharing === true;
                        return (
                            <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm", isActive ? "border-primary/20 bg-primary/5" : "opacity-60")}>
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                        {isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-xs">{v?.displayName || id}</span>
                                        <span className="text-[8px] font-bold uppercase opacity-60">{isActive ? (v?.status === 'stationary' ? 'Mouillage' : v?.status === 'drifting' ? 'DÉRIVE !' : 'En ligne') : 'Déconnecté'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isActive && <BatteryIconComp level={v?.batteryLevel} charging={v?.isCharging} />}
                                    <Button variant="ghost" size="icon" className="size-8 text-destructive/40" onClick={() => handleRemoveSavedVessel(id)}><Trash2 className="size-3" /></Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            </div>
          )}

          {mode === 'fleet' && (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Groupe Flotte à rejoindre</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ID EX: CLUB-PECHE" value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" />
                        <Button variant="outline" className="h-12 w-12 border-2 shrink-0" onClick={() => handleSaveId('fleet')}><Check className="size-4" /></Button>
                    </div>
                </div>
                {fleetId && (
                    <div className="space-y-3">
                        <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Membres de la Flotte : {fleetId}</Label>
                        <div className="grid gap-2">
                            {followedVessels?.filter(v => v.fleetId === fleetId && v.isSharing && (!v.isGhostMode || v.userId === user?.uid || v.status === 'emergency')).map(v => (
                                <div key={v.id} className="flex items-center justify-between p-3 border-2 border-blue-100 rounded-xl bg-blue-50/10 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-600 text-white rounded-lg"><Navigation className="size-4" /></div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase">{v.displayName || v.id}</span>
                                            <span className="text-[8px] font-bold uppercase opacity-60">{v.status === 'stationary' ? 'Mouillage' : 'En route'}</span>
                                        </div>
                                    </div>
                                    <BatteryIconComp level={v.batteryLevel} charging={v.isCharging} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[350px]")}>
          <GoogleMap 
            mapContainerClassName="w-full h-full" 
            defaultCenter={INITIAL_CENTER} 
            defaultZoom={10} 
            onLoad={setMap} 
            onZoomChanged={() => map && setMapZoom(map.getZoom() || 10)}
            onDragStart={() => setIsFollowing(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
          >
                {followedVessels?.filter(v => v.isSharing && (mode === 'receiver' || mode === 'fleet' || v.id === sharingId)).map(vessel => {
                    const isMe = vessel.id === sharingId;
                    if (mode === 'fleet' && vessel.isGhostMode && !isMe && vessel.status !== 'emergency') return null;
                    return (
                        <React.Fragment key={vessel.id}>
                            {(vessel.status === 'stationary' || vessel.status === 'drifting') && vessel.anchorLocation && (
                                <>
                                    <Circle center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} radius={vessel.mooringRadius || 20} options={{ fillColor: '#3b82f6', fillOpacity: 0.2, strokeColor: '#3b82f6', strokeWidth: 1 }} />
                                    <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1 bg-orange-500 rounded-full border-2 border-white shadow-lg"><Anchor className="size-3 text-white" /></div>
                                    </OverlayView>
                                </>
                            )}
                            <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                    <div className={cn("px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2", 
                                        vessel.status === 'offline' ? "bg-red-600 animate-pulse" : 
                                        vessel.status === 'emergency' ? "bg-red-600" :
                                        vessel.status === 'drifting' ? "bg-orange-600" : "bg-slate-900/90")}>
                                        {vessel.displayName || vessel.id}
                                        <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-2.5" />
                                    </div>
                                    <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                                        vessel.status === 'stationary' ? "bg-amber-600" : 
                                        vessel.status === 'emergency' ? "bg-red-600" : "bg-blue-600")}>
                                        {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                                    </div>
                                </div>
                            </OverlayView>
                            {vessel.huntingMarkers?.map(m => (
                                <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center cursor-pointer group" onClick={() => m.photoUrl && setFullscreenImage({ url: m.photoUrl, title: m.label || 'PRISE' })}>
                                        <div className="px-2 py-1 bg-white/90 border rounded text-[8px] font-black uppercase shadow-lg mb-1">{m.label}</div>
                                        <div className="p-1.5 bg-white rounded-full border-2 border-primary shadow-xl">
                                            {m.label === 'SARDINES' ? <Waves className="size-3 text-emerald-600" /> : m.label === 'PRISE' ? <Camera className="size-3 text-emerald-600" /> : m.label === 'OISEAUX' ? <Bird className="size-3 text-blue-600" /> : <Fish className="size-3 text-indigo-600" />}
                                        </div>
                                    </div>
                                </OverlayView>
                            ))}
                        </React.Fragment>
                    );
                })}
                {mode === 'sender' && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><PulsingDot /></OverlayView>}
          </GoogleMap>
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className={cn("shadow-lg h-10 w-10 p-0 border-2", isFollowing ? "bg-primary text-white border-primary" : "bg-background/90 backdrop-blur-md text-primary")}><Compass className={cn("size-5", isFollowing && "fill-white")} /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>
        
        <div className="p-4 bg-card border-t flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest"><History className="size-3"/> Journal Technique</div>
                <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-destructive" onClick={() => setHistory([])}>Effacer</Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl text-[10px] border border-dashed animate-in fade-in slide-in-from-left-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                <Badge variant="outline" className={cn("text-[8px] font-black h-4", h.statusLabel.includes('DÉRIVE') && "border-orange-500 text-orange-600 bg-orange-50")}>
                                    {h.statusLabel} {h.durationMinutes > 0 && `• ${h.durationMinutes} min`}
                                </Badge>
                            </div>
                            <span className="font-bold opacity-60 flex items-center gap-1.5"><Clock className="size-2.5" /> {format(h.time, 'HH:mm')} ({h.pos.lat.toFixed(4)}, {h.pos.lng.toFixed(4)})</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-[8px] font-black uppercase border-2 bg-white" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                    </div>
                ))}
            </div>
        </div>
      </Card>

      <Dialog open={!!fullscreenImage} onOpenChange={(o) => !o && setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] w-full p-0 bg-black border-none rounded-3xl overflow-hidden shadow-2xl z-[200]">
          <div className="relative w-full h-[80vh] flex flex-col">
            <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 z-[210] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md shadow-lg"><X className="size-6" /></button>
            <div className="flex-1 w-full relative flex items-center justify-center">
              {fullscreenImage && <img src={fullscreenImage.url} className="max-w-full max-h-full object-contain" alt="" />}
            </div>
            <DialogHeader className="p-6 shrink-0 text-center">
              <DialogTitle className="text-white font-black uppercase tracking-tighter text-xl">{fullscreenImage?.title}</DialogTitle>
              <DialogDescription className="text-white/40 text-[10px] uppercase font-bold">Photo tactique partagée</DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
