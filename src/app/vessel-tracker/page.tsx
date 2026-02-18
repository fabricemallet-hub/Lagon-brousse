'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteField } from 'firebase/firestore';
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
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { fetchWindyWeather } from '@/lib/windy-api';
import { useLocation } from '@/context/location-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    setCurrentPos(null); setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    updateLog(vesselNickname || 'MOI', label, currentPos || INITIAL_CENTER);
    
    const updates: any = { status: st, eventLabel: label };
    if (st === 'emergency') updates.isGhostMode = false;
    
    if (st === 'stationary' && currentPos) {
        setAnchorPos(currentPos);
        updates.anchorLocation = { latitude: currentPos.lat, longitude: currentPos.lng };
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

  if (isProfileLoading) return <Skeleton className="h-96 w-full" />;

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

  const tacticalMarkers = mode === 'fleet' ? 
    (fleetVessels?.flatMap(v => v.huntingMarkers?.map(m => ({ ...m, vesselName: v.displayName || v.id })) || []) || []) : 
    (followedVessels?.flatMap(v => v.huntingMarkers?.map(m => ({ ...m, vesselName: v.displayName || v.id })) || []) || []);

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
                            <Badge variant="outline" className="bg-white/10 text-white text-[9px] px-2 h-5 cursor-pointer">SYNC: {nextSyncSeconds}S</Badge>
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

                    <Button variant="destructive" className="w-full h-14 font-black uppercase opacity-90 gap-3" onClick={handleStopSharing}>
                        <X className="size-6" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              )}
            </div>
          )}

          {(mode === 'receiver' || mode === 'fleet') && (
            <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Navires suivis</p>
                <div className="grid gap-2">
                    {(mode === 'receiver' ? followedVessels : fleetVessels)?.map(v => (
                        <div key={v.id} className="p-3 border-2 rounded-xl flex items-center justify-between bg-card">
                            <div className="flex items-center gap-3">
                                <Navigation className="size-4 text-primary" />
                                <span className="font-black uppercase text-xs">{v.displayName || v.id}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { map?.panTo({ lat: v.location!.latitude, lng: v.location!.longitude }); map?.setZoom(15); }}><MapPin className="size-4 text-primary" /></Button>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")}>
          {isLoaded ? (
            <GoogleMap 
              mapContainerClassName="w-full h-full" 
              defaultCenter={INITIAL_CENTER} 
              defaultZoom={10} 
              onLoad={setMap} 
              onDragStart={() => setIsFollowing(false)} 
              options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
            >
                  {followedVessels?.filter(v => v.isSharing && v.location).map(vessel => {
                      const isOffline = (Date.now() - (vessel.lastActive?.toMillis?.() || 0) > 70000);
                      const statusInfo = getVesselIconInfo(isOffline ? 'offline' : vessel.status);
                      
                      return (
                          <OverlayView key={`marker-${vessel.id}`} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                              <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-20">
                                  <div className="px-2 py-1 bg-slate-900/80 backdrop-blur-sm text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap">
                                      {vessel.displayName}
                                  </div>
                                  <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", statusInfo.color)}>
                                      {React.createElement(statusInfo.icon, { className: "size-5 text-white" })}
                                  </div>
                              </div>
                          </OverlayView>
                      );
                  })}

                  {tacticalMarkers.map(m => (
                      <OverlayView key={`tactical-${m.id}`} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                          <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-10">
                              <div className="p-1.5 rounded-full shadow-lg border-2 border-white bg-slate-900 text-white">
                                  <Fish className="size-3" />
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
                <p className="text-xs font-black uppercase">Service Google Maps en attente...</p>
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

            <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/5 overflow-hidden">
                <AccordionItem value="history" className="border-none">
                    <div className="flex items-center justify-between px-3 h-12">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">
                            <div className="flex items-center gap-2"><History className="size-3"/> Journal Technique</div>
                        </AccordionTrigger>
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
                                                <span className="font-black uppercase">{h.statusLabel}</span>
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
      </Card>
    </div>
  );
}
