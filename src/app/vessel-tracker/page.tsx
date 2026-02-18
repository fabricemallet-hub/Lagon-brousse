
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteField, Timestamp } from 'firebase/firestore';
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
  MessageSquare,
  Phone,
  Ship,
  Timer,
  AlertCircle
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
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
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative shadow-lg"></div>
    </div>
);

const TACTICAL_OPTIONS = [
    { id: 'OISEAUX', label: 'OISEAUX', icon: Bird, color: 'bg-white text-blue-600 border-blue-200' },
    { id: 'MARLIN', label: 'MARLIN', icon: Fish, color: 'bg-indigo-900 text-white border-indigo-800' },
    { id: 'THON', label: 'THON', icon: Fish, color: 'bg-red-600 text-white border-red-500' },
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
  
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'stabilizing' | 'offline'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [history, setHistory] = useState<{ vesselName: string, statusLabel: string, startTime: Date, lastUpdateTime: Date, pos: google.maps.LatLngLiteral, durationMinutes: number }[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [nextSyncSeconds, setNextSyncSeconds] = useState(60);

  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  const [vesselPrefs, setVesselPrefs] = useState<any>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, assistance: true, tactical: true, battery: true },
    notifySounds: { moving: '', stationary: '', offline: '', assistance: '', tactical: '', battery: '' },
    notifyLoops: { moving: false, stationary: false, offline: false, assistance: true, tactical: true, battery: false },
    mooringRadius: 20,
    batteryThreshold: 20,
    isWatchEnabled: false,
    watchDuration: 60,
    watchSound: ''
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
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const fleetVesselsQuery = useMemoFirebase(() => {
    if (!firestore || !fleetId) return null;
    return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId));
  }, [firestore, fleetId]);
  const { data: fleetVessels } = useCollection<VesselStatus>(fleetVesselsQuery);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  const tacticalMarkers = useMemo(() => {
    const all: (HuntingMarker & { vesselName: string })[] = [];
    followedVessels?.forEach(v => {
        if (v.huntingMarkers) {
            v.huntingMarkers.forEach(m => {
                all.push({ ...m, vesselName: v.displayName || v.id });
            });
        }
    });
    return all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [followedVessels]);

  // --- 3. REFS & UTILS ---
  const watchIdRef = useRef<number | null>(null);
  const stabilizationPoints = useRef<google.maps.LatLngLiteral[]>([]);
  const lastContactTimeRef = useRef<number>(Date.now());
  const statusCycleRef = useRef<NodeJS.Timeout | null>(null);
  const lastAccuracyRef = useRef<number>(0);
  const activeAudiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const lastSyncTimeRef = useRef<number>(Date.now());

  const playVesselSound = useCallback((soundId: string, eventKey?: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    if (eventKey && activeAudiosRef.current[eventKey]) {
        activeAudiosRef.current[eventKey].pause();
        delete activeAudiosRef.current[eventKey];
    }
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      const shouldLoop = eventKey ? vesselPrefs.notifyLoops?.[eventKey] : false;
      if (shouldLoop) { audio.loop = true; activeAudiosRef.current[eventKey!] = audio; }
      audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, vesselPrefs.notifyLoops, availableSounds]);

  const updateLog = useCallback((vName: string, label: string, pos: google.maps.LatLngLiteral) => {
    setHistory(prev => {
        const now = new Date();
        const lastEntry = prev[0];
        if (lastEntry && lastEntry.vesselName === vName && lastEntry.statusLabel === label) {
            return [{
                ...lastEntry,
                lastUpdateTime: now,
                pos: pos,
                durationMinutes: Math.floor(Math.abs(now.getTime() - lastEntry.startTime.getTime()) / 60000)
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
            anchorLocation: anchorPos ? { latitude: anchorPos.lat, longitude: anchorPos.lng } : null,
            ...batteryInfo,
            ...data 
        };
        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
        lastSyncTimeRef.current = Date.now();
        setNextSyncSeconds(60);
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, fleetId, mooringRadius, anchorPos]);

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
        lastAccuracyRef.current = accuracy;
        lastContactTimeRef.current = Date.now();
        
        if (accuracy < 100 && Date.now() - lastSyncTimeRef.current > 60000) {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
        }
        if (isFollowing && map) map.panTo(newPos);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore]);

  // Sync Countdown Timer
  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
        setNextSyncSeconds(prev => {
            if (prev <= 1) {
                if (currentPos) updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng }, accuracy: Math.round(lastAccuracyRef.current) });
                return 60;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSharing, mode, currentPos, updateVesselInFirestore]);

  // --- 5. STABILIZATION & DRIFT LOGIC (30s Cycle) ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        if (statusCycleRef.current) clearInterval(statusCycleRef.current);
        return;
    }
    const startStabilization = async () => {
        setVesselStatus('stabilizing');
        updateLog(vesselNickname || 'MOI', 'LANCEMENT EN COURS (30s)', currentPos || INITIAL_CENTER);
        stabilizationPoints.current = [];
        await new Promise(r => setTimeout(r, 1000));
        if (currentPos) stabilizationPoints.current[0] = currentPos;
        await new Promise(r => setTimeout(r, 29000));
        
        if (currentPos) {
            const p1 = stabilizationPoints.current[0];
            const p2 = currentPos;
            if (p1 && p2) {
                const dist = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
                const isStationary = dist < mooringRadius;
                const initialStatus = isStationary ? 'stationary' : 'moving';
                setVesselStatus(initialStatus);
                if (isStationary) setAnchorPos(p1);
                const label = isStationary ? 'AU MOUILLAGE' : 'MOUVEMENT';
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
                // Manual overrides keep priority
                if (['returning', 'landed', 'emergency'].includes(currentStatus)) return currentStatus;

                let nextStatus = currentStatus;
                let eventLabel = '';
                
                if ((currentStatus === 'stationary' || currentStatus === 'drifting') && anchorPos) {
                    const distFromAnchor = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
                    
                    // IF SAILED AWAY > 100m -> Raise anchor auto
                    if (distFromAnchor > 100) { 
                        nextStatus = 'moving'; 
                        setAnchorPos(null); 
                        eventLabel = 'EN MOUVEMENT'; 
                    } 
                    // IF DRIFTED OUTSIDE RADIUS -> Alert
                    else if (distFromAnchor > mooringRadius) { 
                        nextStatus = 'drifting'; 
                        eventLabel = 'À LA DÉRIVE !'; 
                    }
                    // IF BACK INSIDE RADIUS -> Stationary
                    else {
                        nextStatus = 'stationary';
                        eventLabel = 'AU MOUILLAGE';
                    }
                } else if (currentStatus === 'moving') {
                    // Detect if stopped (we use a simple check here since cycle is 30s)
                    if (!anchorPos) setAnchorPos(currentPos);
                    const dist = getDistance(currentPos.lat, currentPos.lng, anchorPos!.lat, anchorPos!.lng);
                    if (dist < mooringRadius) { 
                        nextStatus = 'stationary'; 
                        eventLabel = 'AU MOUILLAGE'; 
                    } else {
                        setAnchorPos(currentPos); // Move anchor reference while moving
                    }
                }
                
                const displayLabel = eventLabel || (nextStatus === 'moving' ? 'MOUVEMENT' : nextStatus === 'stationary' ? 'AU MOUILLAGE' : 'DÉRIVE');
                updateLog(vesselNickname || 'MOI', displayLabel, currentPos);
                updateVesselInFirestore({ status: nextStatus as any, eventLabel: eventLabel || null });
                return nextStatus;
            });
        }, 30000);
    };
    startStabilization();
    return () => { if (statusCycleRef.current) clearInterval(statusCycleRef.current); };
  }, [isSharing, mode, vesselNickname, mooringRadius, anchorPos, currentPos, updateLog, updateVesselInFirestore]);

  // --- 6. WATCHDOG SIGNAL (70s) ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const watchdog = setInterval(() => {
        const now = Date.now();
        const diffSec = (now - lastContactTimeRef.current) / 1000;
        
        if (vesselStatus !== 'offline' && vesselStatus !== 'stabilizing') {
            if (diffSec > 70) {
                setVesselStatus('offline');
                updateLog(vesselNickname || 'MOI', 'SIGNAL PERDU (70s)', currentPos || INITIAL_CENTER);
                updateVesselInFirestore({ status: 'offline' });
            }
        }
    }, 10000);
    return () => clearInterval(watchdog);
  }, [isSharing, mode, vesselStatus, currentPos, vesselNickname, updateLog, updateVesselInFirestore]);

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    if (vesselStatus === st) {
        setVesselStatus('moving');
        updateLog(vesselNickname || 'MOI', 'ERREUR INVOLONTAIRE (REPRISE AUTO)', currentPos || INITIAL_CENTER);
        updateVesselInFirestore({ status: 'moving', isGhostMode: isGhostMode });
        toast({ title: "Mode AUTO rétabli", description: "Journal : ERREUR INVOLONTAIRE" });
    } else {
        setVesselStatus(st);
        updateLog(vesselNickname || 'MOI', label, currentPos || INITIAL_CENTER);
        const updates: any = { status: st };
        if (st === 'emergency') updates.isGhostMode = false;
        updateVesselInFirestore(updates);
        toast({ title: `Statut : ${label}` });
    }
  };

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
    playVesselSound(vesselPrefs.notifySounds.tactical || 'sonar');
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
        playVesselSound(vesselPrefs.notifySounds.tactical || 'sonar');
        toast({ title: "Photo partagée !" });
    };
    reader.readAsDataURL(file);
  };

  const sendEmergencySms = (type: 'MAYDAY' | 'PAN PAN', vessel?: VesselStatus) => {
    const targetContact = emergencyContact;
    if (!targetContact) { toast({ variant: "destructive", title: "Contact requis" }); return; }
    
    const pos = vessel?.location ? { lat: vessel.location.latitude, lng: vessel.location.longitude } : (currentPos || INITIAL_CENTER);
    const posUrl = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const name = vessel?.displayName || vesselNickname || sharingId;
    const accuracy = vessel?.accuracy ? ` (+/- ${vessel.accuracy}m)` : "";
    const lastUpdate = vessel?.lastActive ? ` (MàJ: ${format(vessel.lastActive.toDate(), 'HH:mm')})` : "";
    
    const body = `[LB-NC] ${type} : ${name}${accuracy}. ${vesselSmsMessage || "Requiert assistance."}${lastUpdate}. Carte : ${posUrl}`;
    window.location.href = `sms:${targetContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleRecenter = () => {
    if (currentPos && map) {
        map.panTo(currentPos);
        map.setZoom(15);
        setIsFollowing(true);
    }
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    Object.values(activeAudiosRef.current).forEach(a => a.pause());
    activeAudiosRef.current = {};
    toast({ title: "Partage arrêté" });
  };

  const handleClearTactical = async () => {
    if (!user || !firestore || !isSharing) return;
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), {
            huntingMarkers: deleteField()
        });
        toast({ title: "Journal Tactique effacé" });
    } catch (e) {
        console.error(e);
    }
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
        toast({ title: "Réglages SMS sauvés" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: cleanId ? arrayUnion(cleanId) : savedVesselIds,
            lastVesselId: cleanId || customSharingId,
            vesselNickname: vesselNickname
        });
        if (vesselIdToFollow) setVesselIdToFollow('');
        toast({ title: "ID enregistré" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur sauvegarde" });
    }
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayRemove(id)
        });
        toast({ title: "Navire retiré de la liste" });
    } catch (e) {
        console.error(e);
    }
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
                    <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white", 
                        vesselStatus === 'offline' ? "bg-red-600 animate-pulse" : 
                        vesselStatus === 'emergency' ? "bg-red-600" :
                        vesselStatus === 'drifting' ? "bg-orange-500 border-orange-400" :
                        vesselStatus === 'landed' ? "bg-green-600" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                                <span className={cn("text-[10px] font-black uppercase tracking-widest text-white/80", vesselStatus === 'drifting' && "animate-pulse text-white")}>
                                    {vesselStatus === 'stabilizing' ? 'LANCEMENT EN COURS...' :
                                     vesselStatus === 'moving' ? 'MOUVEMENT' : 
                                     vesselStatus === 'stationary' ? 'AU MOUILLAGE' : 
                                     vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 
                                     vesselStatus === 'returning' ? 'RETOUR MAISON' :
                                     vesselStatus === 'landed' ? 'À TERRE (HOME)' :
                                     vesselStatus === 'offline' ? 'SIGNAL PERDU' : 'ATTENTE GPS...'}
                                </span>
                            </div>
                            <Badge 
                                variant="outline" 
                                className="bg-white/10 border-white/20 text-white font-black text-[9px] px-2 h-5 cursor-pointer active:scale-95 transition-transform"
                                onClick={() => { if(currentPos) updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng } }); }}
                            >
                                SYNC: {nextSyncSeconds}S
                            </Badge>
                        </div>
                    </div>

                    <div className="bg-muted/10 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><Zap className="size-3" /> Signalement Tactique</p>
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

                    <div className="grid grid-cols-2 gap-2">
                        <Button 
                            variant={vesselStatus === 'returning' ? 'default' : 'outline'} 
                            className="h-14 font-black uppercase text-[10px] border-2 gap-2" 
                            onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}
                        >
                            <Navigation className="size-4" /> RETOUR MAISON
                        </Button>
                        <Button 
                            variant={vesselStatus === 'landed' ? 'default' : 'outline'} 
                            className="h-14 font-black uppercase text-[10px] border-2 gap-2" 
                            onClick={() => handleManualStatusToggle('landed', 'À TERRE (HOME)')}
                        >
                            <Home className="size-4" /> HOME (À TERRE)
                        </Button>
                    </div>

                    <Button 
                        variant={vesselStatus === 'emergency' ? 'destructive' : 'secondary'} 
                        className="w-full h-14 font-black uppercase tracking-widest gap-3 border-2" 
                        onClick={() => handleManualStatusToggle('emergency', 'DEMANDE D\'ASSISTANCE')}
                    >
                        <ShieldAlert className="size-6" /> DEMANDE D'ASSISTANCE
                    </Button>

                    <Button variant="destructive" className="w-full h-14 font-black uppercase tracking-tight opacity-90 gap-3" onClick={handleStopSharing}>
                        <X className="size-6" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              )}

              <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl border">
                        <Settings className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Identité & IDs</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="p-4 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-black uppercase flex items-center gap-2"><Ghost className="size-4" /> Mode Fantôme</Label>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Masquer ma position pour la Flotte (C)</p>
                            </div>
                            <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom du navire</Label>
                            <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-black text-center h-12 border-2" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID Navire (Individuel)</Label>
                            <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID Groupe Flotte C (Collectif)</Label>
                            <Input value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[9px] font-black uppercase opacity-60">Rayon de mouillage (M)</Label>
                                <Badge variant="outline" className="font-black bg-white">{mooringRadius}m</Badge>
                            </div>
                            <Slider value={[mooringRadius]} min={10} max={200} step={5} onValueChange={v => setMooringRadius(v[0])} />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sms-settings" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 rounded-xl border border-orange-100">
                        <Smartphone className="size-4 text-orange-600" />
                        <span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                            <div className="flex items-center justify-between border-b border-dashed pb-3 mb-2">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-black uppercase text-orange-800">Service d'Urgence</Label>
                                    <p className="text-[9px] font-bold text-orange-600/60 uppercase">Activer le contact SMS</p>
                                </div>
                                <Switch checked={isEmergencyEnabled} onCheckedChange={setIsEmergencyEnabled} />
                            </div>
                            <div className={cn("space-y-4", !isEmergencyEnabled && "opacity-40 pointer-events-none")}>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Numéro d'urgence (Terre)</Label>
                                    <Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Message personnalisé</Label>
                                    <Textarea placeholder="Ex: Problème moteur, demande assistance." value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="border-2 font-medium min-h-[80px]" />
                                </div>
                            </div>
                            <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] tracking-widest gap-2 shadow-md">
                                <Save className="size-4" /> Enregistrer réglages SMS
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="notifications-sounds" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl border">
                        <Volume2 className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Notifications & Sons</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-1 px-2">
                                <div className="space-y-0.5">
                                    <h4 className="text-xs font-black uppercase text-slate-800">Alertes Audio Globales</h4>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Activation du module sonore</p>
                                </div>
                                <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                            </div>

                            <div className={cn("space-y-6 transition-opacity", !vesselPrefs.isNotifyEnabled && "opacity-40 pointer-events-none")}>
                                <div className="space-y-3 px-1">
                                    <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-2">
                                        <Volume2 className="size-3" /> Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)
                                    </Label>
                                    <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} step={1} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
                                </div>

                                <Card className="border-2 border-orange-100 bg-orange-50/20 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-4 flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <h4 className="text-xs font-black uppercase text-orange-800">Veille Stratégique</h4>
                                                <p className="text-[8px] font-bold text-orange-600/60 uppercase">Alarme si immobile trop longtemps</p>
                                            </div>
                                            <Switch checked={vesselPrefs.isWatchEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isWatchEnabled: v })} />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[9px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label>
                                                <Badge variant="outline" className="font-black bg-white h-6 px-2 text-[10px]">{Math.floor(vesselPrefs.watchDuration / 60)}h</Badge>
                                            </div>
                                            <Slider value={[vesselPrefs.watchDuration]} min={60} max={1440} step={60} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} />
                                        </div>
                                    </div>
                                </Card>

                                <div className="space-y-4 pt-4 border-t border-dashed">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Réglages sons individuels</p>
                                    <div className="flex flex-col gap-3">
                                        {[
                                            { key: 'moving', label: 'MOUVEMENT', icon: Navigation },
                                            { key: 'stationary', label: 'MOUILLAGE', icon: Anchor },
                                            { key: 'offline', label: 'SIGNAL PERDU', icon: WifiOff },
                                            { key: 'assistance', label: 'ASSISTANCE', icon: ShieldAlert },
                                            { key: 'tactical', label: 'SIGNALEMENT TACTIQUE', icon: Zap },
                                            { key: 'battery', label: 'BATTERIE FAIBLE', icon: BatteryLow },
                                        ].map(item => (
                                            <div key={item.key} className="p-3 bg-white rounded-xl border-2 flex flex-col gap-3 shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <item.icon className="size-4 text-primary opacity-60" />
                                                        <span className="text-[10px] font-black uppercase">{item.label}</span>
                                                    </div>
                                                    <Switch checked={vesselPrefs.notifySettings[item.key]} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, notifySettings: { ...vesselPrefs.notifySettings, [item.key]: v } })} className="scale-75" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Select value={vesselPrefs.notifySounds[item.key]} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [item.key]: v } })}>
                                                        <SelectTrigger className="h-9 text-[10px] font-black uppercase flex-1 bg-muted/30 border-none shadow-inner">
                                                            <SelectValue placeholder="SÉLECTIONNER UN SON..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[10px] font-black uppercase">{s.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[8px] font-black uppercase opacity-40">Boucle</span>
                                                        <Switch checked={vesselPrefs.notifyLoops?.[item.key]} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, notifyLoops: { ...vesselPrefs.notifyLoops, [item.key]: v } })} className="scale-50" />
                                                        <Button variant="outline" size="icon" className="h-9 w-9 border-2" onClick={() => playVesselSound(vesselPrefs.notifySounds[item.key])}><Play className="size-4" /></Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {(mode === 'receiver' || mode === 'fleet') && (
            <div className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                        {mode === 'receiver' ? 'Suivre le navire ID' : 'ID Groupe Flotte C'}
                    </Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder={mode === 'receiver' ? 'ID EX: BATEAU-1' : 'ID GROUPE EX: SUD-NC'} 
                            value={mode === 'receiver' ? vesselIdToFollow : customFleetId} 
                            onChange={e => mode === 'receiver' ? setVesselIdToFollow(e.target.value.toUpperCase()) : setCustomFleetId(e.target.value.toUpperCase())} 
                            className="font-black text-center h-16 border-2 uppercase tracking-[0.2em] text-lg bg-muted/5 flex-1 shadow-inner" 
                        />
                        <Button variant="outline" className="h-16 w-16 border-2 shrink-0 shadow-sm" onClick={handleSaveVessel}>
                            <Save className="size-6 text-slate-400" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                        {mode === 'receiver' ? `Ma Flotte (${savedVesselIds.length})` : `Membres du groupe (${fleetVessels?.filter(v => v.fleetId === fleetId && v.isSharing).length || 0})`}
                    </Label>
                    <div className="grid gap-3">
                        {(mode === 'receiver' ? savedVesselIds : fleetVessels?.filter(v => v.fleetId === fleetId && v.isSharing && (!v.isGhostMode || v.userId === user?.uid || v.status === 'emergency')) || []).map(item => {
                            const v = typeof item === 'string' ? followedVessels?.find(v => v.id === item) : item as VesselStatus;
                            const id = typeof item === 'string' ? item : v!.id;
                            
                            const isOffline = !v || !v.isSharing || (Date.now() - (v.lastActive?.toMillis() || 0) > 70000);
                            
                            return (
                                <Card key={id} className={cn("overflow-hidden border-2 shadow-sm transition-all", isOffline ? "bg-red-50 border-red-200 animate-pulse" : "bg-white")}>
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={cn("size-12 rounded-xl flex items-center justify-center shrink-0 border-2", isOffline ? "bg-red-100 border-red-300 text-red-600" : "bg-primary/5 border-primary/20 text-primary")}>
                                                {isOffline ? <WifiOff className="size-6" /> : <Navigation className="size-6" />}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm uppercase truncate text-slate-800">{v?.displayName || id}</span>
                                                    {v?.isGhostMode && <Badge variant="outline" className="text-[7px] h-3.5 px-1 font-black uppercase bg-slate-50">FANTÔME</Badge>}
                                                </div>
                                                <span className={cn("text-[9px] font-black uppercase tracking-widest", isOffline ? "text-red-600" : "text-green-600")}>
                                                    {isOffline ? 'SIGNAL PERDU' : (v?.status === 'stationary' ? 'AU MOUILLAGE' : 'MOUVEMENT')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <BatteryIconComp level={v?.batteryLevel} charging={v?.isCharging} />
                                            {mode === 'receiver' && <Button variant="ghost" size="icon" className="size-10 text-destructive/20 hover:text-destructive rounded-xl" onClick={() => handleRemoveSavedVessel(id)}><Trash2 className="size-5" /></Button>}
                                        </div>
                                    </div>
                                    {v && v.isSharing && mode === 'receiver' && (
                                        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                                            <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase border-2 gap-2 shadow-sm" onClick={() => { if(v) sendEmergencySms('MAYDAY', v); }}>
                                                <ShieldAlert className="size-4 text-red-600" /> APPEL SECOURS
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase border-2 gap-2 shadow-sm" onClick={() => { if(v) sendEmergencySms('PAN PAN', v); }}>
                                                <Smartphone className="size-4 text-primary" /> ENVOI SMS
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")}>
          <GoogleMap 
            mapContainerClassName="w-full h-full" 
            defaultCenter={INITIAL_CENTER} 
            defaultZoom={10} 
            onLoad={setMap} 
            onDragStart={() => setIsFollowing(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
          >
                {/* 1. LOCAL MOORING FIX (Captain A View) */}
                {(vesselStatus === 'stationary' || vesselStatus === 'drifting') && anchorPos && (
                    <>
                        <Circle 
                            center={anchorPos} 
                            radius={mooringRadius} 
                            options={{ fillColor: '#3b82f6', fillOpacity: 0.15, strokeColor: '#3b82f6', strokeWidth: 1 }} 
                        />
                        <OverlayView position={anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-lg border-2 border-orange-500">
                                <Anchor className="size-4 text-orange-500" />
                            </div>
                        </OverlayView>
                    </>
                )}

                {/* 2. FLEET & FOLLOWED VESSELS */}
                {followedVessels?.filter(v => v.isSharing && v.location && v.id !== sharingId).map(vessel => {
                    const isOffline = (Date.now() - (vessel.lastActive?.toMillis() || 0) > 70000);
                    const isSOS = vessel.status === 'emergency';
                    const isDrifting = vessel.status === 'drifting';
                    
                    // Filter ghosts for Fleet mode unless SOS
                    if (mode === 'fleet' && vessel.isGhostMode && !isSOS) return null;

                    const statusInfo = isOffline ? { label: 'OFF', color: 'bg-red-600', icon: WifiOff } : 
                                      isSOS ? { label: 'SOS', color: 'bg-red-600', icon: ShieldAlert } : 
                                      isDrifting ? { label: 'DÉRIVE', color: 'bg-orange-500', icon: AlertTriangle } :
                                      vessel.status === 'stationary' ? { label: 'MOUIL', color: 'bg-orange-500', icon: Anchor } : 
                                      vessel.status === 'returning' ? { label: 'RETOUR', color: 'bg-indigo-600', icon: Ship } : 
                                      vessel.status === 'landed' ? { label: 'HOME', color: 'bg-green-600', icon: Home } : 
                                      { label: 'MOUV', color: 'bg-blue-600', icon: Navigation };
                    
                    return (
                        <React.Fragment key={vessel.id}>
                            {/* Remote Mooring Circle & Anchor */}
                            {(vessel.status === 'stationary' || isDrifting) && vessel.anchorLocation && (
                                <>
                                    <Circle 
                                        center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} 
                                        radius={vessel.mooringRadius || 20} 
                                        options={{ fillColor: '#3b82f6', fillOpacity: 0.15, strokeColor: '#3b82f6', strokeWidth: 1 }} 
                                    />
                                    <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-lg border-2 border-orange-500">
                                            <Anchor className="size-3 text-orange-500" />
                                        </div>
                                    </OverlayView>
                                </>
                            )}
                            <OverlayView position={{ lat: vessel.location.latitude, lng: vessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                    <div className={cn(
                                        "px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2 transition-all", 
                                        isOffline || isSOS || isDrifting ? statusInfo.color + " animate-pulse" : "bg-slate-900/90"
                                    )}>
                                        <span className="uppercase">{statusInfo.label}</span> | {vessel.displayName || vessel.id}
                                        {vessel.accuracy && <span className="opacity-40 text-[8px]">+/-{vessel.accuracy}m</span>}
                                    </div>
                                    <div className={cn(
                                        "p-2 rounded-full border-2 border-white shadow-xl transition-all", 
                                        isSOS ? "bg-red-600 scale-125" : statusInfo.color
                                    )}>
                                        {React.createElement(statusInfo.icon, { className: "size-5 text-white" })}
                                    </div>
                                </div>
                            </OverlayView>
                        </React.Fragment>
                    );
                })}

                {/* Tacticals Layer */}
                {tacticalMarkers.map(m => (
                    <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                            <div className="px-2 py-1 bg-white/90 backdrop-blur-md text-black rounded-lg text-[9px] font-black shadow-lg border border-slate-200 uppercase tracking-tighter">
                                {m.label}
                            </div>
                            <div className={cn("p-1.5 rounded-full shadow-lg border-2 border-white", m.label === 'SARDINES' ? "bg-emerald-500" : "bg-slate-900 text-white")}>
                                {m.label === 'SARDINES' ? <Waves className="size-3" /> : <Fish className="size-3" />}
                            </div>
                        </div>
                    </OverlayView>
                ))}

                {/* 3. CAPTAIN'S OWN LIVE DOT (Always on top) */}
                {mode === 'sender' && currentPos && (
                    <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <PulsingDot />
                    </OverlayView>
                )}
          </GoogleMap>
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button 
                onClick={handleRecenter} 
                className={cn("shadow-lg h-10 w-10 p-0 border-2", isFollowing ? "bg-primary text-white border-primary" : "bg-background/90 backdrop-blur-md text-primary")}
            >
                <Compass className={cn("size-5", isFollowing && "fill-white")} />
            </Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
          </div>
        </div>
        
        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}>
                    <ShieldAlert className="size-5" /> MAYDAY
                </Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}>
                    <AlertTriangle className="size-5 text-primary" /> PAN PAN
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-2">
                <Accordion type="single" collapsible className="w-full space-y-2">
                    <AccordionItem value="history" className="border-2 rounded-xl bg-muted/5 overflow-hidden px-3">
                        <div className="flex items-center justify-between h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">
                                <div className="flex items-center gap-2"><History className="size-3"/> Journal Technique</div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={() => setHistory([])}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                        </div>
                        <AccordionContent className="space-y-2 pb-4 pt-2">
                            {history.length > 0 ? history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                            <Badge variant="outline" className="text-[8px] font-black h-4 uppercase">
                                                {h.statusLabel} {h.durationMinutes > 0 ? `• ${h.durationMinutes} min` : '• inst.'}
                                            </Badge>
                                        </div>
                                        <span className="font-bold opacity-40 flex items-center gap-1.5"><Clock className="size-2.5" /> {format(h.startTime, 'HH:mm')}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                                </div>
                            )) : <div className="text-center py-8 opacity-20 text-[10px] uppercase font-black">AUCUN ÉVÉNEMENT</div>}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="tactical-history" className="border-2 rounded-xl bg-muted/5 overflow-hidden px-3">
                        <div className="flex items-center justify-between h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">
                                <div className="flex items-center gap-2"><Zap className="size-3"/> Journal Tactique</div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearTactical} disabled={!isSharing}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                        </div>
                        <AccordionContent className="space-y-2 pb-4 pt-2">
                            {tacticalMarkers.length > 0 ? tacticalMarkers.map((m, i) => (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-primary uppercase">{m.vesselName}</span>
                                            <Badge variant={m.label === 'PRISE' ? 'default' : 'secondary'} className={cn("text-[8px] font-black h-4 uppercase", m.label === 'PRISE' && "bg-emerald-600")}>
                                                {m.label}
                                            </Badge>
                                        </div>
                                        <span className="font-bold opacity-40 flex items-center gap-1.5"><Clock className="size-2.5" /> {format(new Date(m.time), 'HH:mm')}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3" onClick={() => { map?.panTo({ lat: m.lat, lng: m.lng }); map?.setZoom(17); }}>GPS</Button>
                                </div>
                            )) : <div className="text-center py-8 opacity-20 text-[10px] uppercase font-black">AUCUN SIGNALEMENT TACTIQUE</div>}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>

      <Card className="border-2 bg-muted/10 shadow-none">
        <CardHeader className="p-4 pb-2 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Phone className="size-4 text-primary" /> Annuaire Maritime NC
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Urgences</h4>
            <div className="space-y-2">
              <div className="flex flex-col"><span className="text-[9px] font-bold text-muted-foreground uppercase">COSS NC (Mer)</span><a href="tel:16" className="text-sm font-black flex items-center gap-2"><Phone className="size-3" /> 16</a></div>
              <div className="flex flex-col"><span className="text-[9px] font-bold text-muted-foreground uppercase">SAMU (Terre)</span><a href="tel:15" className="text-sm font-black flex items-center gap-2"><Phone className="size-3" /> 15</a></div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-1">Services</h4>
            <div className="flex flex-col"><span className="text-[9px] font-bold text-muted-foreground uppercase">Météo Marine</span><a href="tel:366736" className="text-sm font-black flex items-center gap-2"><Phone className="size-3" /> 36 67 36</a></div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-indigo-600 border-b pb-1">Ports & Marinas</h4>
            <div className="flex flex-col"><span className="text-[9px] font-bold text-muted-foreground uppercase">Port Autonome (VHF 12)</span><a href="tel:255000" className="text-sm font-black flex items-center gap-2"><Phone className="size-3" /> 25 50 00</a></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
