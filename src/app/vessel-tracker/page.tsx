
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where } from 'firebase/firestore';
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
  VolumeX,
  Home,
  Compass,
  Clock,
  Ruler,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
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
  if (charging) return <BatteryCharging className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull className={cn(props.className, "text-green-600")} />;
};

const BatteryFull = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>;
const BatteryMedium = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/></svg>;
const BatteryLow = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/></svg>;
const BatteryCharging = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><path d="M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1"/><path d="m11 7-3 5h4l-3 5"/></svg>;

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="size-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
);

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // 1. DATA FETCHING
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const [customSharingId, setCustomSharingId] = useState('');
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const queryIds = [...savedVesselIds];
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds]);
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

  // 2. STATES
  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [mapZoom, setMapZoom] = useState<number>(10);
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [stabilizationStep, setStabilizationStep] = useState<0 | 1 | 2>(0); // 0: idle, 1: point A, 2: stable
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [history, setHistory] = useState<{ statusLabel: string, vesselName: string, startTime: number, lastUpdateTime: number, pos: google.maps.LatLngLiteral }[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<{url: string, title: string} | null>(null);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: '', stationary: '', offline: '' },
    mooringRadius: 20,
    batteryThreshold: 20
  });

  // REFS FOR TRACKING LOGIC
  const watchIdRef = useRef<number | null>(null);
  const lastSignalTimeRef = useRef<number>(Date.now());
  const lastActiveStatusRef = useRef<VesselStatus['status']>('moving');
  const lastPrecisionRef = useRef<number>(0);
  const firstStabilizationPointRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastStatusUpdateRef = useRef<number>(Date.now());

  // 3. FUNCTIONS
  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const playVesselSound = useCallback((soundId: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

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
            lastActive: serverTimestamp(),
            anchorLocation: anchorPos ? { latitude: anchorPos.lat, longitude: anchorPos.lng } : null,
            ...batteryInfo,
            ...data 
        };

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, anchorPos]);

  const addToHistory = useCallback((label: string, pos: google.maps.LatLngLiteral) => {
    const name = vesselNickname || user?.displayName || 'Capitaine';
    const now = Date.now();

    setHistory(prev => {
        const last = prev[0];
        if (last && last.statusLabel === label && last.vesselName === name) {
            // Mise à jour de la même ligne
            return [{ ...last, lastUpdateTime: now, pos }, ...prev.slice(1)];
        }
        // Nouvelle ligne
        return [{ statusLabel: label, vesselName: name, startTime: now, lastUpdateTime: now, pos }, ...prev].slice(0, 50);
    });
  }, [vesselNickname, user]);

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st !== 'offline') lastActiveStatusRef.current = st;
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    if (currentPos) addToHistory(label || st.toUpperCase(), currentPos);
  };

  // GPS TRACKING
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    // START STABILIZATION
    setStabilizationStep(1);
    toast({ title: "Stabilisation GPS (10s)..." });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
        lastSignalTimeRef.current = Date.now();
        lastPrecisionRef.current = accuracy;

        if (stabilizationStep === 1 && !firstStabilizationPointRef.current) {
            firstStabilizationPointRef.current = newPos;
            // Wait 9 seconds for second point
            setTimeout(() => {
                setStabilizationStep(2);
            }, 9000);
        }

        if (isFollowing && map) map.panTo(newPos);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, toast]);

  // CORE LOGIC: Stabilisation, 30s Check, Signal Lost
  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;

    const interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastSignal = now - lastSignalTimeRef.current;
        const precision = lastPrecisionRef.current;

        // 1. SIGNAL LOST DETECTION
        const signalLostTimeout = precision > 100 ? 10000 : 60000;
        if (timeSinceLastSignal > signalLostTimeout && vesselStatus !== 'offline') {
            setVesselStatus('offline');
            updateVesselInFirestore({ status: 'offline', eventLabel: 'SIGNAL PERDU' });
            if (currentPos) addToHistory('SIGNAL PERDU', currentPos);
            return;
        }

        // 2. SIGNAL RECOVERY
        if (vesselStatus === 'offline' && precision < 20) {
            const resumeStatus = lastActiveStatusRef.current;
            setVesselStatus(resumeStatus);
            updateVesselInFirestore({ status: resumeStatus, eventLabel: 'SIGNAL RETROUVÉ' });
            if (currentPos) addToHistory('SIGNAL RETROUVÉ', currentPos);
            return;
        }

        // 3. STABILIZATION & PERIODIC CHECK (Every 30s)
        if (now - lastStatusUpdateRef.current > 30000 || (stabilizationStep === 2 && firstStabilizationPointRef.current)) {
            if (!currentPos) return;

            // First compare for stabilization
            if (stabilizationStep === 2 && firstStabilizationPointRef.current) {
                const dist = getDistance(currentPos.lat, currentPos.lng, firstStabilizationPointRef.current.lat, firstStabilizationPointRef.current.lng);
                const initialStatus = dist <= (vesselPrefs.mooringRadius || 20) ? 'stationary' : 'moving';
                
                setVesselStatus(initialStatus);
                lastActiveStatusRef.current = initialStatus;
                if (initialStatus === 'stationary') setAnchorPos(currentPos);
                
                updateVesselInFirestore({ status: initialStatus, isSharing: true });
                addToHistory(initialStatus === 'stationary' ? 'AU MOUILLAGE' : 'EN MOUVEMENT', currentPos);
                
                firstStabilizationPointRef.current = null;
                setStabilizationStep(0);
                lastStatusUpdateRef.current = now;
                return;
            }

            // Regular 30s check
            if (vesselStatus === 'stationary' || vesselStatus === 'drifting') {
                if (!anchorPos) return;
                const distFromAnchor = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
                
                if (distFromAnchor > 100) {
                    setVesselStatus('moving');
                    lastActiveStatusRef.current = 'moving';
                    setAnchorPos(null);
                    updateVesselInFirestore({ status: 'moving', anchorLocation: null });
                    addToHistory('EN MOUVEMENT', currentPos);
                } else if (distFromAnchor > (vesselPrefs.mooringRadius || 20)) {
                    if (vesselStatus !== 'drifting') {
                        setVesselStatus('drifting');
                        updateVesselInFirestore({ status: 'drifting' });
                        addToHistory('À LA DÉRIVE', currentPos);
                    } else {
                        // Update same line
                        updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng } });
                        addToHistory('À LA DÉRIVE', currentPos);
                    }
                } else {
                    // Still at anchor, update position on same history line
                    updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng } });
                    addToHistory('AU MOUILLAGE', currentPos);
                }
            } else if (vesselStatus === 'moving') {
                // Update position on same history line
                updateVesselInFirestore({ location: { latitude: currentPos.lat, longitude: currentPos.lng } });
                addToHistory('EN MOUVEMENT', currentPos);
            }

            lastStatusUpdateRef.current = now;
        }
    }, 5000);

    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, anchorPos, currentPos, stabilizationStep, vesselPrefs.mooringRadius, updateVesselInFirestore, addToHistory]);

  const handleStopSharing = async () => {
    setIsSharing(false);
    updateVesselInFirestore({ isSharing: false, status: 'offline' });
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    setStabilizationStep(0);
    firstStabilizationPointRef.current = null;
    toast({ title: "Partage arrêté" });
  };

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: vesselIdToFollow.trim() ? arrayUnion(vesselIdToFollow.trim().toUpperCase()) : savedVesselIds,
            lastVesselId: cleanId
        });
        if (vesselIdToFollow) setVesselIdToFollow('');
        toast({ title: "Enregistré" });
    } catch (e) {}
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayRemove(id) });
        toast({ title: "Retiré" });
    } catch (e) {}
  };

  const handleRecenter = () => {
    if (currentPos && map) {
        map.panTo(currentPos);
        map.setZoom(15);
        setIsFollowing(true);
    }
  };

  if (isProfileLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>

        <CardContent className="p-4 space-y-4">
          {mode === 'sender' ? (
            <div className="space-y-6">
              {isSharing ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white", 
                        vesselStatus === 'offline' ? "bg-red-600 animate-pulse" : 
                        vesselStatus === 'drifting' ? "bg-orange-500 animate-bounce" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest">Partage Actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                                {stabilizationStep > 0 ? "STABILISATION (10s)..." : 
                                 vesselStatus === 'moving' ? 'En mouvement' : 
                                 vesselStatus === 'stationary' ? 'Au mouillage' : 
                                 vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 'SIGNAL PERDU'}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-12 font-black uppercase text-[10px] border-2" onClick={() => handleManualStatus('stationary', 'MOUILLAGE MANUEL')}><Anchor className="size-4 mr-2" /> Mouillage</Button>
                        <Button variant="outline" className="h-12 font-black uppercase text-[10px] border-2" onClick={() => handleManualStatus('moving', 'REPRISE MOUVEMENT')}><Move className="size-4 mr-2" /> Mouvement</Button>
                    </div>
                    <Button variant="destructive" className="w-full h-14 font-black uppercase shadow-lg gap-2" onClick={handleStopSharing}><X className="size-5" /> Arrêter le partage</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5">
                    <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                    <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                </div>
              )}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Réglages Identité</span></AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="p-4 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-between">
                            <div className="space-y-0.5"><Label className="text-xs font-black uppercase flex items-center gap-2"><Ghost className="size-4" /> Mode Fantôme</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Masquer pour la Flotte uniquement</p></div>
                            <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                        </div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom du navire</Label><Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold h-12 border-2" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID Personnalisé</Label>
                            <div className="flex gap-2"><Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase" /><Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={handleSaveVessel}><Save className="size-4" /></Button></div>
                        </div>
                        <div className="space-y-3 p-4 bg-blue-50/50 rounded-2xl border-2 border-blue-100">
                            <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between">Rayon de mouillage <span>{vesselPrefs.mooringRadius}m</span></Label>
                            <Slider value={[vesselPrefs.mooringRadius || 20]} min={10} max={200} step={5} onValueChange={v => setVesselPrefs({ ...vesselPrefs, mooringRadius: v[0] })} />
                        </div>
                        <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] border-2 gap-2" onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-primary")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" /><Button variant="outline" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Save className="size-4" /></Button></div></div>
              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Ma Flotte</Label>
                <div className="grid gap-2">
                    {savedVesselIds.map(id => {
                        const v = followedVessels?.find(v => v.id === id);
                        const isActive = v?.isSharing === true;
                        return (
                            <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm", isActive ? "border-primary/20 bg-primary/5" : "opacity-60")}>
                                <div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}</div><div className="flex flex-col"><span className="font-black text-xs">{v?.displayName || id}</span><span className="text-[8px] font-bold uppercase opacity-60">{isActive ? (v?.status === 'stationary' ? 'Mouillage' : v?.status === 'drifting' ? 'DÉRIVE' : 'En ligne') : 'Déconnecté'}</span></div></div>
                                <div className="flex items-center gap-2">{isActive && <BatteryIconComp level={v?.batteryLevel} charging={v?.isCharging} />}<Button variant="ghost" size="icon" className="size-8 text-destructive/40" onClick={() => handleRemoveSavedVessel(id)}><Trash2 className="size-3" /></Button></div>
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
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[350px]")}>
          <GoogleMap 
            mapContainerClassName="w-full h-full" 
            defaultCenter={INITIAL_CENTER} 
            defaultZoom={10} 
            onLoad={setMap} 
            onDragStart={() => setIsFollowing(false)}
            onZoomChanged={() => map && setMapZoom(map.getZoom() || 10)}
            options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
          >
                {followedVessels?.filter(v => v.isSharing && (mode === 'receiver' || !v.isGhostMode || v.status === 'emergency' || v.id === sharingId)).map(vessel => {
                    const isAnchored = vessel.status === 'stationary' || vessel.status === 'drifting';
                    return (
                        <React.Fragment key={vessel.id}>
                            {isAnchored && vessel.anchorLocation && (
                                <>
                                    <Circle 
                                        center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }}
                                        radius={vessel.mooringRadius || 20}
                                        options={{ fillColor: '#3b82f6', fillOpacity: 0.1, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 2, clickable: false }}
                                    />
                                    <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1 bg-orange-500 rounded-full border-2 border-white shadow-lg z-0">
                                            <Anchor className="size-3 text-white" />
                                        </div>
                                    </OverlayView>
                                </>
                            )}
                            <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 relative z-10">
                                    <div className={cn("px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2", 
                                        vessel.status === 'drifting' ? "bg-orange-600 animate-bounce" : 
                                        vessel.status === 'offline' ? "bg-red-600" : "bg-slate-900/90")}>
                                        {vessel.displayName || vessel.id}
                                        <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-2.5" />
                                    </div>
                                    <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                                        vessel.status === 'stationary' ? "bg-amber-600" : 
                                        vessel.status === 'drifting' ? "bg-orange-600" : "bg-blue-600")}>
                                        {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                                    </div>
                                </div>
                            </OverlayView>
                        </React.Fragment>
                    );
                })}
                {mode === 'sender' && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><PulsingDot /></OverlayView>}
          </GoogleMap>
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className={cn("shadow-lg h-10 w-10 p-0 border-2", isFollowing ? "bg-primary text-white border-primary" : "bg-background/90 backdrop-blur-md text-primary")}>
                <Compass className={cn("size-5", isFollowing && "fill-white")} />
            </Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>
        
        <div className="p-4 bg-card border-t flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest"><History className="size-3"/> Journal Technique</div>
                <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-destructive" onClick={() => setHistory([])}>Effacer</Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                {history.map((h, i) => {
                    const durationMin = Math.floor((h.lastUpdateTime - h.startTime) / 60000);
                    return (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl text-[10px] border border-dashed animate-in fade-in slide-in-from-left-2">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                    <Badge variant="outline" className="text-[8px] font-black border-primary/20 h-4">{h.statusLabel}</Badge>
                                </div>
                                <span className="font-bold opacity-60 flex items-center gap-1.5">
                                    <Clock className="size-2.5" /> depuis {durationMin} min • {format(h.lastUpdateTime, 'HH:mm:ss')}
                                </span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 px-3 text-[8px] font-black uppercase border-2 bg-white" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                        </div>
                    );
                })}
                {history.length === 0 && <p className="text-center py-8 text-[10px] font-black uppercase opacity-20 italic">Aucun événement enregistré</p>}
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
              <DialogDescription className="text-white/40 text-[10px] uppercase font-bold">Photo tactique épinglée</DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
