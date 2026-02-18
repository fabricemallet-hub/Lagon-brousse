'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteField, Timestamp, getDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Home,
  Compass,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Users,
  Search,
  Bird,
  Fish,
  Waves,
  Camera,
  MessageSquare,
  Phone,
  Ship,
  AlertCircle,
  Eraser
} from 'lucide-react';
import { cn, getDistance, getRegionalNow } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { fetchWindyWeather } from '@/lib/windy-api';
import { useLocation } from '@/context/location-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    { id: 'THON', label: 'THON', icon: Fish, color: 'bg-red-600 text-white border-red-50' },
    { id: 'TAZARD', label: 'TAZARD', icon: Fish, color: 'bg-slate-600 text-white border-slate-500' },
    { id: 'WAHOO', label: 'WAHOO', icon: Fish, color: 'bg-cyan-600 text-white border-cyan-500' },
    { id: 'BONITE', label: 'BONITE', icon: Fish, color: 'bg-blue-600 text-white border-blue-500' },
    { id: 'SARDINES', label: 'SARDINES', icon: Waves, color: 'bg-emerald-500 text-white border-emerald-400' },
];

type HistoryEntry = {
  vesselName: string;
  statusLabel: string;
  time: Date;
  pos: google.maps.LatLngLiteral;
  durationMinutes: number;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();
  const { selectedRegion } = useLocation();

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'stabilizing' | 'offline'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
    batteryThreshold: 20
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);

  const watchIdRef = useRef<number | null>(null);
  const lastFixTimestampRef = useRef<number>(Date.now());
  const lastSentPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const isInitialisedRef = useRef<boolean>(false);
  const driftConfirmationRef = useRef<boolean>(false);
  const activeAudiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const shouldPanOnNextFix = useRef<boolean>(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
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

  const handleRecenter = useCallback(() => {
    setIsFollowing(true);
    let target = null;
    if (mode === 'sender' && currentPos) {
      target = currentPos;
    } else if (mode === 'receiver' || mode === 'fleet') {
      const activeVessel = followedVessels?.find(v => v.isSharing && v.location);
      if (activeVessel?.location) {
        target = { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude };
      }
    }
    if (target && map) {
      map.panTo(target);
      map.setZoom(15);
    } else {
      shouldPanOnNextFix.current = true;
      if (mode === 'sender' && !isSharing) setIsSharing(true);
    }
  }, [mode, currentPos, followedVessels, map, isSharing]);

  const updateLog = useCallback((vName: string, label: string, pos: google.maps.LatLngLiteral) => {
    setHistory(prev => {
        const now = new Date();
        const lastEntry = prev[0];
        if (lastEntry && lastEntry.vesselName === vName && lastEntry.statusLabel === label) {
            const duration = Math.floor(Math.abs(now.getTime() - lastEntry.time.getTime()) / 60000);
            return [{ ...lastEntry, pos, durationMinutes: duration }, ...prev.slice(1)];
        }
        return [{ vesselName: vName, statusLabel: label, time: now, pos, durationMinutes: 0 }, ...prev].slice(0, 50);
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

        const currentVesselDoc = followedVessels?.find(v => v.id === sharingId);
        const lastWeatherUpdate = currentVesselDoc?.lastWeatherUpdate;
        const now = Date.now();
        const threeHours = 3 * 60 * 60 * 1000;
        
        let weatherData = {};
        if (data.location && (!lastWeatherUpdate || (now - (lastWeatherUpdate.toMillis?.() || 0) > threeHours))) {
            const windy = await fetchWindyWeather(data.location.latitude, data.location.longitude);
            if (windy.success) {
                weatherData = {
                    windSpeed: windy.windSpeed,
                    windDir: windy.windDir,
                    wavesHeight: windy.wavesHeight,
                    lastWeatherUpdate: serverTimestamp()
                };
            }
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
            ...weatherData,
            ...data 
        };
        
        if (anchorPos && vesselStatus !== 'moving') {
            updatePayload.anchorLocation = { latitude: anchorPos.lat, longitude: anchorPos.lng };
        } else if (data.status === 'moving' || vesselStatus === 'moving') {
            updatePayload.anchorLocation = null;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
        setNextSyncSeconds(60);
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, fleetId, mooringRadius, anchorPos, vesselStatus, followedVessels]);

  const getVesselIconInfo = (status: string) => {
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

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    setCurrentPos(null); setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayRemove(id) });
    toast({ title: "Retiré" });
  };

  const handleResetIdentity = async () => {
    if (!user || !firestore) return;
    if (isSharing) await handleStopSharing();
    await updateDoc(doc(firestore, 'users', user.uid), { vesselNickname: deleteField(), lastVesselId: deleteField(), lastFleetId: deleteField(), mooringRadius: 20 });
    setVesselNickname(''); setCustomSharingId(''); setCustomFleetId(''); setMooringRadius(20);
    toast({ title: "Identité réinitialisée" });
  };

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    updateLog(vesselNickname || 'MOI', label, currentPos || INITIAL_CENTER);
    
    const updates: any = { status: st, eventLabel: label };
    if (st === 'emergency') updates.isGhostMode = false;
    
    if (st === 'stationary' && currentPos) {
        setAnchorPos(currentPos);
        updates.anchorLocation = { latitude: currentPos.lat, longitude: anchorPos?.lng || currentPos.lng };
    }
    
    if (st === 'moving') {
        setAnchorPos(null);
        updates.anchorLocation = null;
    }

    updateVesselInFirestore(updates);
    toast({ title: label });
  };

  const sendEmergencySms = (type: 'MAYDAY' | 'PAN PAN', vessel?: VesselStatus) => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Contact requis" }); return; }
    const pos = vessel?.location ? { lat: vessel.location.latitude, lng: vessel.location.longitude } : (currentPos || INITIAL_CENTER);
    const posUrl = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const name = vessel?.displayName || vesselNickname || sharingId;
    const body = `[LB-NC] ${type} : ${name}. ${vesselSmsMessage || "Assistance requise."}. Carte : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleTacticalSignal = async (typeId: string) => {
    if (!user || !firestore || !currentPos) return;
    const marker: HuntingMarker = { id: Math.random().toString(36).substring(7), lat: currentPos.lat, lng: currentPos.lng, time: new Date().toISOString(), label: typeId };
    await updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: arrayUnion(marker) });
    playVesselSound(vesselPrefs.notifySounds.tactical || 'sonar');
    toast({ title: `Signalement : ${typeId}` });
  };

  const tacticalMarkers = useMemo(() => {
    const all: (HuntingMarker & { vesselName: string })[] = [];
    const sourceVessels = mode === 'fleet' ? (fleetVessels || []) : (followedVessels || []);
    sourceVessels.forEach(v => {
        if (v.huntingMarkers) v.huntingMarkers.forEach(m => all.push({ ...m, vesselName: v.displayName || v.id }));
    });
    return all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [followedVessels, fleetVessels, mode]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        if (accuracy > 10) return;

        const lastSent = lastSentPosRef.current;
        const distMoved = lastSent ? getDistance(latitude, longitude, lastSent.lat, lastSent.lng) : 100;

        setCurrentPos(newPos);
        lastFixTimestampRef.current = Date.now();

        if (distMoved >= 10) {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
            lastSentPosRef.current = newPos;
        }

        if (isFollowing && map) map.panTo(newPos);
        if (shouldPanOnNextFix.current && map) {
            map.panTo(newPos);
            map.setZoom(16);
            shouldPanOnNextFix.current = false;
        }
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
        const timeSinceLastFix = Date.now() - lastFixTimestampRef.current;
        if (timeSinceLastFix > 60000 && vesselStatus !== 'offline') {
            setVesselStatus('offline');
            updateVesselInFirestore({ status: 'offline' });
            toast({ variant: 'destructive', title: 'SIGNAL PERDU' });
        }
        setNextSyncSeconds(prev => prev <= 1 ? 60 : prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, updateVesselInFirestore, toast]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender') { isInitialisedRef.current = false; return; }
    if (isInitialisedRef.current) return;

    const startDetection = async () => {
        isInitialisedRef.current = true;
        setVesselStatus('stabilizing');
        updateLog(vesselNickname || 'MOI', 'LANCEMENT EN COURS', currentPos || INITIAL_CENTER);
        await new Promise(r => setTimeout(r, 30000));
        if (!currentPos) { setVesselStatus('moving'); return; }
        const initialStatus = 'stationary';
        setAnchorPos(currentPos);
        setVesselStatus(initialStatus);
        updateVesselInFirestore({ status: initialStatus, anchorLocation: { latitude: currentPos.lat, longitude: currentPos.lng } });

        const interval = setInterval(() => {
            if (!currentPos || !anchorPos) return;
            const d = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
            setVesselStatus(curr => {
                if (['returning', 'landed', 'emergency', 'offline'].includes(curr)) return curr;
                if (d > 100) { setAnchorPos(null); driftConfirmationRef.current = false; updateVesselInFirestore({ status: 'moving', anchorLocation: null }); return 'moving'; }
                if (d > mooringRadius) {
                    if (driftConfirmationRef.current) { updateVesselInFirestore({ status: 'drifting' }); return 'drifting'; }
                    else { driftConfirmationRef.current = true; return curr; }
                }
                driftConfirmationRef.current = false;
                if (curr !== 'stationary') updateVesselInFirestore({ status: 'stationary' });
                return 'stationary';
            });
        }, 60000);
        return () => clearInterval(interval);
    };
    startDetection();
  }, [isSharing, mode, currentPos, anchorPos, mooringRadius, vesselNickname, updateVesselInFirestore, updateLog]);

  if (isProfileLoading) return <Skeleton className="h-96 w-full" />;

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
                    <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Lancer le partage</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                    <Switch checked={isSharing} onCheckedChange={val => { if(val) setIsSharing(true); else handleStopSharing(); }} />
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white transition-colors duration-500", 
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
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                                {vesselStatus === 'stabilizing' ? 'LANCEMENT EN COURS...' :
                                 vesselStatus === 'moving' ? 'MOUVEMENT' : 
                                 vesselStatus === 'stationary' ? 'AU MOUILLAGE' : 
                                 vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 
                                 vesselStatus === 'returning' ? 'RETOUR MAISON' :
                                 vesselStatus === 'landed' ? 'À TERRE (HOME)' :
                                 vesselStatus === 'offline' ? 'SIGNAL PERDU' : 'ATTENTE GPS...'}
                            </span>
                            <Badge variant="outline" className="bg-white/10 text-white text-[9px] px-2 h-5 cursor-pointer" onClick={() => { if(currentPos) updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng } }); }}>
                                SYNC: {nextSyncSeconds}S
                            </Badge>
                        </div>
                    </div>

                    <div className="bg-muted/10 p-4 rounded-2xl border-2 border-dashed space-y-3">
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
                            <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file || !currentPos) return;
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                    const marker: HuntingMarker = { id: Math.random().toString(36).substring(7), lat: currentPos.lat, lng: currentPos.lng, time: new Date().toISOString(), label: 'PRISE', photoUrl: ev.target?.result as string };
                                    await updateDoc(doc(firestore!, 'vessels', sharingId), { huntingMarkers: arrayUnion(marker) });
                                    playVesselSound('sonar'); toast({ title: "Photo partagée !" });
                                };
                                reader.readAsDataURL(file);
                            }} />
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

                    <Button variant="destructive" className="w-full h-14 font-black uppercase opacity-90 gap-3" onClick={handleStopSharing}>
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
                                <Eraser className="size-4" /> RÉINITIALISER MON IDENTITÉ
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {isSharing && (
                    <AccordionItem value="debug-test" className="border-none mt-2">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-slate-100/50 rounded-xl border border-slate-200">
                            <Zap className="size-4 text-slate-600" />
                            <span className="text-[10px] font-black uppercase text-slate-600">Pont de Test Manuel (Debug)</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-3 px-1">
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase border-2" onClick={() => handleManualStatusToggle('stationary', 'DEBUG: FORCE MOUILLAGE')}>Force Mouillage</Button>
                                <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase border-2" onClick={() => handleManualStatusToggle('drifting', 'DEBUG: FORCE DÉRIVE')}>Force Dérive</Button>
                                <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase border-2" onClick={() => handleManualStatusToggle('offline', 'DEBUG: FORCE SIGNAL PERDU')}>Force Signal Perdu</Button>
                                <Button variant="outline" size="sm" className="h-10 text-[9px] font-black uppercase border-2" onClick={() => handleManualStatusToggle('moving', 'DEBUG: FORCE MOUVEMENT')}>Force Mouvement</Button>
                            </div>
                            <p className="text-[8px] font-bold text-muted-foreground text-center uppercase italic px-4 leading-tight">Outils réservés aux tests de réaction de la carte et du récepteur sans déplacement réel.</p>
                        </AccordionContent>
                    </AccordionItem>
                )}
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
                        <Users className="size-3" /> Ma Flotte ({followedVessels?.filter(v => v.id !== sharingId).length || 0})
                    </h3>
                    <div className="grid gap-2">
                        {savedVesselIds.map(id => {
                            const vessel = followedVessels?.find(v => v.id === id);
                            const isActive = vessel?.isSharing === true;
                            const isOffline = (Date.now() - (vessel?.lastActive?.toMillis?.() || 0) > 70000);
                            
                            return (
                                <div key={id} className={cn("p-4 border-2 rounded-2xl flex items-center justify-between transition-all shadow-sm", 
                                    isActive ? (isOffline ? "border-red-200 bg-red-50/10 animate-pulse" : "border-primary/20 bg-primary/5") : "bg-muted/5 opacity-60")}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn("p-2.5 rounded-xl shadow-sm", isActive ? (isOffline ? "bg-red-600 text-white" : "bg-primary text-white") : "bg-muted text-muted-foreground")}>
                                            {isActive ? (isOffline ? <WifiOff className="size-5" /> : <Navigation className="size-5" />) : <WifiOff className="size-5" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-sm uppercase tracking-tight truncate">{vessel?.displayName || id} {vessel?.isGhostMode && <span className="text-[8px] opacity-40 ml-1">(FANTÔME)</span>}</span>
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
            </div>
          )}

          {mode === 'fleet' && (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1 opacity-60 text-center block">ID Groupe (Flotte C)</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ID GROUPE SUD-NC" value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="font-black text-center h-14 border-2 uppercase tracking-widest flex-grow" />
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
                            if (v.isGhostMode && v.id !== sharingId && v.status !== 'emergency') return null;
                            const isOffline = (Date.now() - (v.lastActive?.toMillis?.() || 0) > 70000);
                            const isMe = v.id === sharingId;
                            return (
                                <div key={v.id} className={cn("p-4 border-2 rounded-2xl flex items-center justify-between transition-all shadow-sm", 
                                    isOffline ? "border-red-200 bg-red-50/10 opacity-60" : "border-primary/20 bg-primary/5",
                                    isMe && "ring-2 ring-primary ring-offset-2")}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn("p-2.5 rounded-xl text-white shadow-sm", isOffline ? "bg-red-600" : "bg-slate-900")}>
                                            {isMe ? <Navigation className="size-5" /> : <Navigation className="size-5" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-sm uppercase truncate">{v.displayName} {isMe && "(MOI)"}</span>
                                            <span className={cn("text-[9px] font-black uppercase", isOffline ? "text-red-600" : "text-green-600")}>
                                                {isOffline ? 'SIGNAL PERDU' : (v.status === 'emergency' ? 'SOS !' : 'EN LIGNE')}
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
                    </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")}>
          {isLoaded ? (
            <GoogleMap 
              key={isFullscreen ? 'map-fullscreen' : 'map-standard'}
              mapContainerClassName="w-full h-full" 
              defaultCenter={INITIAL_CENTER} 
              defaultZoom={10} 
              onLoad={setMap} 
              onDragStart={() => setIsFollowing(false)} 
              options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
            >
                  {(mode === 'sender' || mode === 'receiver' || mode === 'fleet') && followedVessels?.filter(v => v.isSharing && v.anchorLocation && (v.status === 'stationary' || v.status === 'drifting')).map(v => {
                      if (mode === 'fleet' && v.isGhostMode && v.status !== 'emergency' && v.id !== sharingId) return null;
                      return (
                          <React.Fragment key={`anchor-layer-${v.id}`}>
                              <Circle 
                                  center={{ lat: v.anchorLocation!.latitude, lng: v.anchorLocation!.longitude }} 
                                  radius={v.mooringRadius || 20} 
                                  options={{ fillColor: '#3b82f6', fillOpacity: 0.15, strokeColor: '#3b82f6', strokeWeight: 1, clickable: false }} 
                              />
                              <OverlayView position={{ lat: v.anchorLocation!.latitude, lng: v.anchorLocation!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                  <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-orange-500 z-10">
                                      <Anchor className="size-3 text-orange-500" />
                                  </div>
                              </OverlayView>
                          </React.Fragment>
                      );
                  })}

                  {followedVessels?.filter(v => v.isSharing && v.location && v.id !== sharingId).map(vessel => {
                      const isOffline = (Date.now() - (vessel.lastActive?.toMillis?.() || 0) > 70000);
                      if (mode === 'fleet' && vessel.isGhostMode && vessel.status !== 'emergency') return null;
                      const statusInfo = getVesselIconInfo(isOffline ? 'offline' : vessel.status);
                      
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
                                      {vessel.windSpeed !== undefined && !isOffline && (
                                          <div className="mt-0.5 border-t border-white/10 pt-0.5 flex items-center gap-2 text-[8px] font-bold text-blue-300">
                                              <span className="flex items-center gap-0.5">💨 {vessel.windSpeed}nd</span>
                                              <span className="flex items-center gap-0.5">🌊 {vessel.wavesHeight}m</span>
                                          </div>
                                      )}
                                  </div>
                                  <div className={cn("p-2 rounded-full border-2 border-white shadow-xl transition-all", vessel.status === 'emergency' ? "bg-red-600 scale-125" : statusInfo.color)}>
                                      {React.createElement(statusInfo.icon, { className: "size-5 text-white" })}
                                  </div>
                              </div>
                          </OverlayView>
                      );
                  })}

                  {tacticalMarkers.map(m => (
                      <OverlayView key={`tactical-${m.id}`} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                          <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-10">
                              <div className="px-2 py-1 bg-white/90 backdrop-blur-md text-slate-900 rounded-lg text-[9px] font-black shadow-lg border border-slate-200 uppercase tracking-tighter">{m.label}</div>
                              <div className={cn("p-1.5 rounded-full shadow-lg border-2 border-white", m.label === 'SARDINES' ? "bg-emerald-500" : "bg-slate-900 text-white")}>
                                  {m.label === 'SARDINES' ? <Waves className="size-3" /> : <Fish className="size-3" />}
                              </div>
                          </div>
                      </OverlayView>
                  ))}

                  {mode === 'sender' && currentPos && (
                      <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                          <PulsingDot />
                      </OverlayView>
                  )}
            </GoogleMap>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-slate-100 text-muted-foreground gap-4">
                <AlertCircle className="size-12 opacity-20" />
                <p className="text-xs font-black uppercase">Vérification de la clé Maps...</p>
            </div>
          )}
          
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
                                    {history.map((h, i) => {
                                        const isValidDate = h.time instanceof Date && !isNaN(h.time.getTime());
                                        return (
                                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                                <div className="flex flex-col gap-0.5">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                                    <span className={cn("font-black uppercase", h.statusLabel.includes('DÉRIVE') ? 'text-orange-600' : h.statusLabel.includes('MOUVEMENT') ? 'text-blue-600' : 'text-slate-600')}>{h.statusLabel}</span>
                                                  </div>
                                                  <span className="text-[9px] font-bold opacity-40 uppercase">
                                                    {isValidDate ? format(h.time, 'HH:mm:ss') : '...'} • ACTIF {h.durationMinutes || 0} MIN
                                                  </span>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>
                                                  <MapPin className="size-3 text-primary" /> GPS
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 opacity-30 uppercase font-black text-[10px] tracking-widest italic">Aucun log technique</div>
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
