
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteField, Timestamp, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
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
  AlertCircle,
  Eraser,
  Wind
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
import { fetchWindyWeather } from '@/lib/windy-api';

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
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)', zIndex: 50 }}>
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
  const [tacticalHistory, setTacticalHistory] = useState<{ id: string, vesselName: string, label: string, time: string, lat: number, lng: number }[]>([]);
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

  const myVessel = useMemo(() => followedVessels?.find(v => v.id === sharingId), [followedVessels, sharingId]);

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
    const sourceVessels = mode === 'fleet' ? (fleetVessels || []) : (followedVessels || []);
    sourceVessels.forEach(v => {
        if (v.huntingMarkers) {
            v.huntingMarkers.forEach(m => {
                all.push({ ...m, vesselName: v.displayName || v.id });
            });
        }
    });
    return all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [followedVessels, fleetVessels, mode]);

  // Sync Tactical History
  useEffect(() => {
    setTacticalHistory(tacticalMarkers.map(m => ({
        id: m.id,
        vesselName: m.vesselName,
        label: m.label || 'SIGNAL',
        time: m.time,
        lat: m.lat,
        lng: m.lng
    })));
  }, [tacticalMarkers]);

  // --- 3. REFS & UTILS ---
  const watchIdRef = useRef<number | null>(null);
  const statusCycleRef = useRef<NodeJS.Timeout | null>(null);
  const lastAccuracyRef = useRef<number>(0);
  const activeAudiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const lastSyncTimeRef = useRef<number>(Date.now());
  const hasInitialisedRef = useRef<boolean>(false);
  const outOfBoundsCheckRef = useRef<boolean>(false);

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
            const duration = Math.floor(Math.abs(now.getTime() - lastEntry.startTime.getTime()) / 60000);
            return [{
                ...lastEntry,
                lastUpdateTime: now,
                pos: pos,
                durationMinutes: duration
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
        
        if (anchorPos) {
            updatePayload.anchorLocation = { latitude: anchorPos.lat, longitude: anchorPos.lng };
        } else if (data.anchorLocation === null) {
            updatePayload.anchorLocation = null;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
        lastSyncTimeRef.current = Date.now();
        setNextSyncSeconds(60);
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, fleetId, mooringRadius, anchorPos]);

  // Initial Prefs
  useEffect(() => {
    if (userProfile && !isSharing) {
        if (userProfile.vesselNickname) setVesselNickname(userProfile.vesselNickname);
        if (userProfile.lastVesselId) setCustomSharingId(userProfile.lastVesselId);
        if (userProfile.lastFleetId) setCustomFleetId(userProfile.lastFleetId);
        if (userProfile.mooringRadius) setMooringRadius(userProfile.mooringRadius);
        if (userProfile.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
        if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
        if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
        setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
        setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
    }
  }, [userProfile, isSharing]);

  // GPS Tracking
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      hasInitialisedRef.current = false;
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
        lastAccuracyRef.current = accuracy;
        if (isFollowing && map) map.panTo(newPos);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map]);

  // Watchdog Timer
  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
        setNextSyncSeconds(prev => {
            if (prev <= 1) {
                if (currentPos) {
                    updateVesselInFirestore({ 
                        location: { latitude: currentPos.lat, longitude: currentPos.lng }, 
                        accuracy: Math.round(lastAccuracyRef.current) 
                    });
                    
                    const statusLabel = vesselStatus === 'stabilizing' ? 'LANCEMENT EN COURS' : 
                                      vesselStatus === 'moving' ? 'MOUVEMENT' : 
                                      vesselStatus === 'stationary' ? 'AU MOUILLAGE' : 
                                      vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 'STATUT ACTIF';
                    updateLog(vesselNickname || 'MOI', statusLabel, currentPos);
                }
                return 60;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSharing, mode, currentPos, updateVesselInFirestore, vesselStatus, vesselNickname, updateLog]);

  // Drift Logic
  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        if (statusCycleRef.current) clearInterval(statusCycleRef.current);
        hasInitialisedRef.current = false;
        outOfBoundsCheckRef.current = false;
        return;
    }

    if (hasInitialisedRef.current) return;

    const startTrackingLoop = async () => {
        hasInitialisedRef.current = true;
        setVesselStatus('stabilizing');
        updateLog(vesselNickname || 'MOI', 'LANCEMENT EN COURS', currentPos || INITIAL_CENTER);
        
        await new Promise(r => setTimeout(r, 30000));
        
        if (!currentPos) { setVesselStatus('moving'); return; }

        let initialStatus: VesselStatus['status'] = 'moving';
        if (anchorPos) {
            const dist = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
            initialStatus = dist < mooringRadius ? 'stationary' : 'moving';
        } else {
            setAnchorPos(currentPos);
            initialStatus = 'stationary';
        }

        setVesselStatus(initialStatus);
        updateVesselInFirestore({ status: initialStatus });

        statusCycleRef.current = setInterval(() => {
            if (!currentPos || !anchorPos) return;
            
            const dist = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
            
            setVesselStatus(currentStatus => {
                if (['returning', 'landed', 'emergency'].includes(currentStatus)) return currentStatus;

                if (dist > 100) {
                    setAnchorPos(null);
                    outOfBoundsCheckRef.current = false;
                    updateVesselInFirestore({ status: 'moving', anchorLocation: null });
                    toast({ title: "REPRISE DU MOUVEMENT", description: "Ancre levée détectée (>100m)." });
                    return 'moving';
                }

                if (dist > mooringRadius) {
                    if (outOfBoundsCheckRef.current) {
                        updateVesselInFirestore({ status: 'drifting' });
                        return 'drifting';
                    } else {
                        outOfBoundsCheckRef.current = true;
                        return currentStatus;
                    }
                }

                outOfBoundsCheckRef.current = false;
                if (currentStatus !== 'stationary') {
                    updateVesselInFirestore({ status: 'stationary' });
                }
                return 'stationary';
            });
        }, 60000);
    };

    startTrackingLoop();

    return () => { if (statusCycleRef.current) clearInterval(statusCycleRef.current); };
  }, [isSharing, mode, vesselNickname, mooringRadius, anchorPos, currentPos, updateLog, updateVesselInFirestore, toast]);

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    if (vesselStatus === st) {
        setVesselStatus('moving');
        updateLog(vesselNickname || 'MOI', 'ERREUR INVOLONTAIRE', currentPos || INITIAL_CENTER);
        updateVesselInFirestore({ status: 'moving', isGhostMode: isGhostMode });
        toast({ title: "Mode AUTO rétabli" });
    } else {
        setVesselStatus(st);
        updateLog(vesselNickname || 'MOI', label, currentPos || INITIAL_CENTER);
        const updates: any = { status: st };
        if (st === 'emergency') updates.isGhostMode = false;
        updateVesselInFirestore(updates);
        toast({ title: label });
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
    toast({ title: `Signalement : ${typeId}` });
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
    const time = vessel?.lastActive ? ` à ${format(vessel.lastActive.toDate(), 'HH:mm')}` : "";
    const body = `[LB-NC] ${type} : ${name}. ${vesselSmsMessage || "Requiert assistance."}. Carte${accuracy}${time} : ${posUrl}`;
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
    hasInitialisedRef.current = false;
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleResetIdentity = async () => {
    if (!user || !firestore) return;
    try {
        if (isSharing) await handleStopSharing();
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, 'users', user.uid), {
            vesselNickname: deleteField(),
            lastVesselId: deleteField(),
            lastFleetId: deleteField(),
            mooringRadius: 20
        });
        if (sharingId) batch.delete(doc(firestore, 'vessels', sharingId));
        await batch.commit();
        setVesselNickname('');
        setCustomSharingId('');
        setCustomFleetId('');
        setMooringRadius(20);
        toast({ title: "Identité réinitialisée" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur reset" });
    }
  };

  const handleClearTactical = async () => {
    if (!firestore || !user || mode !== 'sender') return;
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: [] });
        toast({ title: "Signalements tactiques effacés" });
    } catch (e) {
        console.error(e);
    }
  };

  const getVesselIcon = (status: string) => {
    switch (status) {
        case 'moving': return { icon: Navigation, color: 'bg-blue-600', label: 'MOUV' };
        case 'stationary': return { icon: Anchor, color: 'bg-orange-500', label: 'MOUIL' };
        case 'drifting': return { icon: Anchor, color: 'bg-orange-500', label: 'DÉRIVE' };
        case 'returning': return { icon: Ship, color: 'bg-indigo-600', label: 'RETOUR' };
        case 'landed': return { icon: Home, color: 'bg-green-600', label: 'HOME' };
        case 'emergency': return { icon: ShieldAlert, color: 'bg-red-600', label: 'SOS' };
        case 'offline': return { icon: WifiOff, color: 'bg-red-600', label: 'OFF' };
        default: return { icon: Navigation, color: 'bg-slate-600', label: '???' };
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
                                <span className={cn("text-[10px] font-black uppercase tracking-widest text-white/80")}>
                                    {vesselStatus === 'stabilizing' ? 'LANCEMENT EN COURS...' :
                                     vesselStatus === 'moving' ? 'MOUVEMENT' : 
                                     vesselStatus === 'stationary' ? 'AU MOUILLAGE' : 
                                     vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 
                                     vesselStatus === 'returning' ? 'RETOUR MAISON' :
                                     vesselStatus === 'landed' ? 'À TERRE (HOME)' :
                                     vesselStatus === 'offline' ? 'SIGNAL PERDU' : 'ATTENTE GPS...'}
                                </span>
                            </div>
                            <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-black text-[9px] px-2 h-5 cursor-pointer" onClick={() => { if(currentPos) updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng } }); }}>
                                SYNC: {nextSyncSeconds}S
                            </Badge>
                        </div>
                    </div>

                    <div className="bg-muted/10 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><Zap className="size-3" /> Signalement Tactique</p>
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
                        <Button variant={vesselStatus === 'returning' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 gap-2" onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}>
                            <Navigation className="size-4" /> RETOUR MAISON
                        </Button>
                        <Button variant={vesselStatus === 'landed' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 gap-2" onClick={() => handleManualStatusToggle('landed', 'À TERRE (HOME)')}>
                            <Home className="size-4" /> HOME (À TERRE)
                        </Button>
                    </div>

                    <Button variant={vesselStatus === 'emergency' ? 'destructive' : 'secondary'} className="w-full h-14 font-black uppercase tracking-widest gap-3 border-2" onClick={() => handleManualStatusToggle('emergency', 'DEMANDE D\'ASSISTANCE')}>
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
                        <div className="pt-4 border-t border-dashed">
                            <Button variant="ghost" className="w-full h-12 font-black uppercase text-[10px] text-destructive gap-2 border border-destructive/10 bg-red-50/10" onClick={handleResetIdentity}>
                                <Eraser className="size-4" /> Réinitialiser mon identité (Vider IDs)
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {mode === 'receiver' && (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1 opacity-60 text-center block">Suivre le navire ID</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-14 border-2 uppercase tracking-[0.2em] flex-grow text-lg" />
                        <Button variant="default" className="h-14 w-14 shrink-0 shadow-lg" onClick={() => { if(vesselIdToFollow.trim()) { updateDoc(doc(firestore!, 'users', user!.uid), { savedVesselIds: arrayUnion(vesselIdToFollow.trim().toUpperCase()) }); setVesselIdToFollow(''); toast({ title: "Navire ajouté" }); } }}>
                            <Save className="size-6" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                        <Users className="size-3" /> Ma Flotte ({followedVessels?.length || 0})
                    </h3>
                    <div className="grid gap-2">
                        {savedVesselIds.map(id => {
                            const vessel = followedVessels?.find(v => v.id === id);
                            const lastUpdate = vessel?.lastActive?.toMillis() || 0;
                            const isOffline = (Date.now() - lastUpdate > 70000);
                            const isActive = vessel?.isSharing === true;
                            
                            return (
                                <div key={id} className={cn("p-4 border-2 rounded-2xl flex items-center justify-between transition-all shadow-sm", 
                                    isActive ? (isOffline ? "border-red-200 bg-red-50/10 animate-pulse" : "border-primary/20 bg-primary/5") : "bg-muted/5 opacity-60")}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn("p-2.5 rounded-xl shadow-sm", isActive ? (isOffline ? "bg-red-600 text-white" : "bg-primary text-white") : "bg-muted text-muted-foreground")}>
                                            {isActive ? (isOffline ? <WifiOff className="size-5" /> : <Navigation className="size-5" />) : <WifiOff className="size-5" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-sm uppercase tracking-tight truncate">{vessel?.displayName || id}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("text-[9px] font-black uppercase", isActive ? (isOffline ? "text-red-600" : "text-green-600") : "text-muted-foreground")}>
                                                    {isActive ? (isOffline ? 'SIGNAL PERDU' : 'EN LIGNE') : 'DÉCONNECTÉ'}
                                                </span>
                                                {isActive && vessel?.batteryLevel !== undefined && (
                                                    <div className="flex items-center gap-1 opacity-60 scale-75">
                                                        <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                                                        <span className="text-[10px] font-black">{vessel.batteryLevel}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isActive && vessel && (
                                            <div className="flex gap-1 mr-1">
                                                <Button size="icon" variant="ghost" className="h-9 w-9 border-2 border-red-100 text-red-600" onClick={() => window.location.href = `tel:16`}><Phone className="size-4" /></Button>
                                                <Button size="icon" variant="ghost" className="h-9 w-9 border-2 border-primary/20 text-primary" onClick={() => sendEmergencySms('MAYDAY', vessel)}><MessageSquare className="size-4" /></Button>
                                            </div>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/40 hover:text-destructive border-2" onClick={() => handleRemoveSavedVessel(id)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="receiver-sounds" className="border-none">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 border-2 rounded-xl">
                            <Settings className="size-4 text-primary" />
                            <span className="text-[10px] font-black uppercase">Notifications & Sons</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                            <div className="p-4 border-2 rounded-2xl bg-slate-50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-black uppercase">Sons actifs</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Alertes de navigation</p>
                                    </div>
                                    <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => setVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                                </div>
                                <div className="space-y-3 pt-2 border-t border-dashed">
                                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Volume2 className="size-3" /> Volume</Label>
                                    <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} step={1} onValueChange={v => setVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
                                </div>
                                <Button onClick={handleSavePreferences} size="sm" className="w-full h-10 font-black uppercase text-[9px] tracking-widest gap-2">
                                    <Save className="size-3" /> Sauver les préférences
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
          )}

          {mode === 'fleet' && (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1 opacity-60 text-center block">ID Groupe (Flotte C)</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ID GROUPE EX: SUD-NC" value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="font-black text-center h-14 border-2 uppercase tracking-widest flex-grow" />
                        <Button variant="default" className="h-14 w-14 shrink-0 shadow-lg" onClick={() => { updateDoc(doc(firestore!, 'users', user!.uid), { lastFleetId: customFleetId.trim().toUpperCase() }); toast({ title: "ID Groupe mis à jour" }); }}>
                            <Save className="size-6" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                        <Users className="size-3" /> Membres du Groupe ({fleetVessels?.length || 0})
                    </h3>
                    <div className="grid gap-2">
                        {fleetVessels?.map(v => {
                            const isOffline = (Date.now() - (v.lastActive?.toMillis() || 0) > 70000);
                            const isMe = v.id === sharingId;
                            return (
                                <div key={v.id} className={cn("p-4 border-2 rounded-2xl flex items-center justify-between transition-all shadow-sm", 
                                    isOffline ? "border-red-200 bg-red-50/10 opacity-60" : "border-primary/20 bg-primary/5",
                                    isMe && "ring-2 ring-primary ring-offset-2")}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn("p-2.5 rounded-xl text-white shadow-sm", isOffline ? "bg-red-600" : "bg-slate-900")}>
                                            <Navigation className="size-5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-sm uppercase truncate">{v.displayName} {isMe && "(MOI)"}</span>
                                            <span className={cn("text-[9px] font-black uppercase", isOffline ? "text-red-600" : "text-green-600")}>
                                                {isOffline ? 'SIGNAL PERDU' : (v.status === 'emergency' ? 'EN DÉTRESSE !' : 'EN LIGNE')}
                                            </span>
                                        </div>
                                    </div>
                                    {v.location && (
                                        <Button variant="ghost" size="icon" className="h-10 w-10 border-2" onClick={() => { map?.panTo({ lat: v.location!.latitude, lng: v.location!.longitude }); map?.setZoom(15); }}>
                                            <MapPin className="size-4 text-primary" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                        {(!fleetVessels || fleetVessels.length === 0) && (
                            <div className="text-center py-10 border-2 border-dashed rounded-[2rem] opacity-30">
                                <Users className="size-8 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Aucun membre actif</p>
                            </div>
                        )}
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="fleet-sounds" className="border-none">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 border-2 border-blue-100 rounded-xl">
                            <Settings className="size-4 text-blue-600" />
                            <span className="text-[10px] font-black uppercase">Notifications Flotte</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <div className="p-4 border-2 rounded-2xl bg-blue-50/30 border-blue-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-black uppercase text-blue-800">Alertes audio</Label>
                                        <p className="text-[9px] font-bold text-blue-600/60">Sons lors des changements d'états</p>
                                    </div>
                                    <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => setVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                                </div>
                                <Button onClick={handleSavePreferences} size="sm" className="w-full h-10 font-black uppercase text-[9px] tracking-widest bg-blue-600 hover:bg-blue-700">
                                    Sauver réglages flotte
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
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
                {/* 🔵 COUCHE GEOFENCING : Cercles de mouillage fixes */}
                {followedVessels?.filter(v => v.isSharing && v.anchorLocation && (v.status === 'stationary' || v.status === 'drifting')).map(v => {
                    if (mode === 'fleet' && v.isGhostMode && v.status !== 'emergency' && v.id !== sharingId) return null;
                    return (
                        <React.Fragment key={`anchor-layer-${v.id}`}>
                            <Circle 
                                center={{ lat: v.anchorLocation!.latitude, lng: v.anchorLocation!.longitude }} 
                                radius={v.mooringRadius || 20} 
                                options={{ 
                                    fillColor: '#3b82f6', 
                                    fillOpacity: 0.15, 
                                    strokeColor: '#3b82f6', 
                                    strokeWeight: 1, 
                                    clickable: false 
                                }} 
                            />
                            <OverlayView position={{ lat: v.anchorLocation!.latitude, lng: v.anchorLocation!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-orange-500 z-10">
                                    <Anchor className="size-3 text-orange-500" />
                                </div>
                            </OverlayView>
                        </React.Fragment>
                    );
                })}

                {/* 🔴 COUCHE NAVIRES : Marqueurs dynamiques et Tooltips Météo */}
                {followedVessels?.filter(v => v.isSharing && v.location && v.id !== sharingId).map(vessel => {
                    const isOffline = (Date.now() - (vessel.lastActive?.toMillis() || 0) > 70000);
                    if (mode === 'fleet' && vessel.isGhostMode && vessel.status !== 'emergency') return null;
                    const statusInfo = getVesselIcon(isOffline ? 'offline' : vessel.status);
                    
                    return (
                        <OverlayView key={`marker-${vessel.id}`} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-20">
                                <div className={cn(
                                    "px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex flex-col items-center transition-all backdrop-blur-sm", 
                                    isOffline || vessel.status === 'emergency' || vessel.status === 'drifting' 
                                        ? statusInfo.color + " animate-pulse" 
                                        : "bg-slate-900/80 border-white/20"
                                )}>
                                    <div className="flex items-center gap-2">
                                        <span className="uppercase">{statusInfo.label}</span> | {vessel.displayName}
                                    </div>
                                    {/* 🌤️ TOOLTIP MÉTÉO WINDY */}
                                    {vessel.windSpeed !== undefined && !isOffline && (
                                        <div className="mt-0.5 border-t border-white/10 pt-0.5 flex items-center gap-2 text-[8px] font-bold text-blue-300">
                                            <span className="flex items-center gap-0.5">💨 {vessel.windSpeed}nd</span>
                                            <span className="flex items-center gap-0.5">🌊 {vessel.wavesHeight}m</span>
                                        </div>
                                    )}
                                </div>
                                <div className={cn(
                                    "p-2 rounded-full border-2 border-white shadow-xl transition-all", 
                                    vessel.status === 'emergency' ? "bg-red-600 scale-125" : statusInfo.color
                                )}>
                                    {React.createElement(statusInfo.icon, { className: "size-5 text-white" })}
                                </div>
                            </div>
                        </OverlayView>
                    );
                })}

                {/* 🟠 COUCHE TACTIQUE : Signalements de pêche */}
                {tacticalMarkers.map(m => (
                    <OverlayView key={`tactical-${m.id}`} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-10">
                            <div className="px-2 py-1 bg-white/90 backdrop-blur-md text-slate-900 rounded-lg text-[9px] font-black shadow-lg border border-slate-200 uppercase tracking-tighter">
                                {m.label}
                            </div>
                            <div className={cn(
                                "p-1.5 rounded-full shadow-lg border-2 border-white", 
                                m.label === 'SARDINES' ? "bg-emerald-500" : "bg-slate-900 text-white"
                            )}>
                                {m.label === 'SARDINES' ? <Waves className="size-3" /> : <Fish className="size-3" />}
                            </div>
                        </div>
                    </OverlayView>
                ))}

                {/* 🔵 POINT BLEU LOCAL (Always on top) */}
                {mode === 'sender' && currentPos && (
                    <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <PulsingDot />
                    </OverlayView>
                )}
          </GoogleMap>
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className={cn("shadow-lg h-10 w-10 p-0 border-2", isFollowing ? "bg-primary text-white border-primary" : "bg-background/90 backdrop-blur-md text-primary")}><Compass className={cn("size-5", isFollowing && "fill-white")} /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="grid grid-cols-2 gap-2">
                <Button variant="destructive" className="h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}>
                    <ShieldAlert className="size-5" /> MAYDAY
                </Button>
                <Button variant="secondary" className="h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}>
                    <AlertTriangle className="size-5 text-primary" /> PAN PAN
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-2">
                <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/5 overflow-hidden">
                    <AccordionItem value="history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">
                                <div className="flex items-center gap-2"><History className="size-3"/> Journal Technique</div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive border border-destructive/20" onClick={(e) => { e.stopPropagation(); setHistory([]); }}>
                                <Trash2 className="size-3 mr-1" /> Effacer
                            </Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide">
                            {history.length > 0 ? (
                                <div className="space-y-2 px-3">
                                    {history.map((h, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-2">
                                                <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                                <span className={cn("font-black uppercase", h.statusLabel.includes('DÉRIVE') ? 'text-orange-600' : h.statusLabel.includes('MOUVEMENT') ? 'text-blue-600' : 'text-slate-600')}>{h.statusLabel}</span>
                                              </div>
                                              <span className="text-[9px] font-bold opacity-40 uppercase">{format(h.time, 'HH:mm:ss')} • ACTIF {h.durationMinutes || 0} MIN</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>
                                              <MapPin className="size-3 text-primary" /> GPS
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 opacity-30 uppercase font-black text-[10px] tracking-widest italic">Aucun log technique</div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/5 overflow-hidden">
                    <AccordionItem value="tactical-logs" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">
                                <div className="flex items-center gap-2"><Settings className="size-3 text-blue-600"/> Journal Tactique</div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive border border-destructive/20" onClick={(e) => { e.stopPropagation(); handleClearTactical(); }}>
                                <Trash2 className="size-3 mr-1" /> Effacer
                            </Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide">
                            {tacticalHistory.length > 0 ? (
                                <div className="space-y-2 px-3">
                                    {tacticalHistory.map((h, i) => (
                                        <div key={h.id} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-black text-[8px] uppercase border-blue-200 text-blue-600">{h.label}</Badge>
                                                <span className="font-black text-slate-800 uppercase">{h.vesselName}</span>
                                              </div>
                                              <span className="text-[9px] font-bold opacity-40 uppercase">{format(new Date(h.time), 'HH:mm:ss')}</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { map?.panTo({ lat: h.lat, lng: h.lng }); map?.setZoom(17); }}>
                                              <MapPin className="size-3 text-primary" /> GPS
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 opacity-30 uppercase font-black text-[10px] tracking-widest italic">AUCUN SIGNALEMENT TACTIQUE</div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>
    </div>
  );
}
