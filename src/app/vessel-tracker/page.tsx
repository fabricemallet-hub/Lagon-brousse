
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
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull
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
import { format, differenceInMinutes } from 'date-fns';
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
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // --- 1. STATES ---
  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'stabilizing'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<{url: string, title: string} | null>(null);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: '', stationary: '', offline: '' },
    mooringRadius: 20,
    batteryThreshold: 20
  });

  const [customSharingId, setCustomSharingId] = useState('');
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  // --- 2. DATA FETCHING (AFTER STATES TO AVOID ReferenceError) ---
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || (savedVesselIds.length === 0 && !isSharing)) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
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
  const lastEvaluatedPos = useRef<google.maps.LatLngLiteral | null>(null);

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

  const updateLog = useCallback((vName: string, label: string, pos: google.maps.LatLngLiteral) => {
    setHistory(prev => {
        const now = new Date();
        const lastEntry = prev[0];

        if (lastEntry && lastEntry.vesselName === vName && lastEntry.statusLabel === label) {
            // Update existing entry
            const updated = {
                ...lastEntry,
                lastUpdateTime: now,
                pos: pos,
                durationMinutes: differenceInMinutes(now, lastEntry.startTime)
            };
            return [updated, ...prev.slice(1)];
        } else {
            // Create new entry
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
            lastActive: serverTimestamp(),
            ...batteryInfo,
            ...data 
        };

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname]);

  // --- 4. GPS TRACKING CORE ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
        lastContactTimeRef.current = Date.now();

        // Always update log/firestore with current pos if accuracy is decent
        if (accuracy < 100) {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy });
        }

        if (isFollowing && map) map.panTo(newPos);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore]);

  // --- 5. STABILIZATION & CYCLE LOGIC ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        if (statusCycleRef.current) clearInterval(statusCycleRef.current);
        return;
    }

    // 1. PHASE DE STABILISATION (10s)
    setVesselStatus('stabilizing');
    stabilizationPoints.current = [];
    
    // Capture first point immediately (if available) or wait for it
    const startStabilization = async () => {
        // Wait 1s to ensure a first fix
        await new Promise(r => setTimeout(r, 1000));
        if (currentPos) stabilizationPoints.current[0] = currentPos;

        // Wait 9s
        await new Promise(r => setTimeout(r, 9000));
        if (currentPos) {
            const p1 = stabilizationPoints.current[0];
            const p2 = currentPos;
            
            if (p1 && p2) {
                const dist = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
                const isStationary = dist < (vesselPrefs.mooringRadius || 20);
                
                const initialStatus = isStationary ? 'stationary' : 'moving';
                setVesselStatus(initialStatus);
                if (isStationary) setAnchorPos(p1);
                
                const label = isStationary ? 'AU MOUILLAGE' : 'EN MOUVEMENT';
                updateLog(vesselNickname || 'MOI', label, p2);
                updateVesselInFirestore({ status: initialStatus as any, anchorLocation: isStationary ? { latitude: p1.lat, longitude: p1.lng } : null });
            } else {
                // Fallback to moving if we didn't get points
                setVesselStatus('moving');
            }
        } else {
            setVesselStatus('moving');
        }

        // 2. LANCEMENT DU CYCLE (30s)
        statusCycleRef.current = setInterval(() => {
            if (!currentPos) return;
            
            setVesselStatus(currentStatus => {
                const distFromLast = lastEvaluatedPos.current ? getDistance(currentPos.lat, currentPos.lng, lastEvaluatedPos.current.lat, lastEvaluatedPos.current.lng) : 0;
                lastEvaluatedPos.current = currentPos;

                let nextStatus = currentStatus;
                let eventLabel = '';

                // Logic for drift / raise anchor
                if (currentStatus === 'stationary' && anchorPos) {
                    const distFromAnchor = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
                    if (distFromAnchor > 100) {
                        nextStatus = 'moving';
                        setAnchorPos(null);
                        eventLabel = 'EN MOUVEMENT (ANCRE LEVÉE)';
                    } else if (distFromAnchor > (vesselPrefs.mooringRadius || 20)) {
                        nextStatus = 'drifting';
                        eventLabel = 'À LA DÉRIVE !';
                    }
                } else if (currentStatus === 'drifting' && anchorPos) {
                    const distFromAnchor = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
                    if (distFromAnchor > 100) {
                        nextStatus = 'moving';
                        setAnchorPos(null);
                        eventLabel = 'EN MOUVEMENT';
                    } else if (distFromAnchor < (vesselPrefs.mooringRadius || 20)) {
                        nextStatus = 'stationary';
                        eventLabel = 'AU MOUILLAGE (STABILISÉ)';
                    }
                }

                // Log update
                const displayLabel = eventLabel || (nextStatus === 'moving' ? 'EN MOUVEMENT' : nextStatus === 'stationary' ? 'AU MOUILLAGE' : 'DÉRIVE');
                updateLog(vesselNickname || 'MOI', displayLabel, currentPos);
                updateVesselInFirestore({ status: nextStatus as any, eventLabel: eventLabel || null });

                return nextStatus;
            });
        }, 30000);
    };

    startStabilization();

    return () => { if (statusCycleRef.current) clearInterval(statusCycleRef.current); };
  }, [isSharing, mode, vesselNickname]);

  // 6. SIGNAL LOSS DETECTION
  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;

    const interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastActive = now - lastContactTimeRef.current;

        if (timeSinceLastActive > 60000 && vesselStatus !== 'offline') {
            setVesselStatus('offline');
            updateLog(vesselNickname || 'MOI', 'SIGNAL PERDU', currentPos || INITIAL_CENTER);
            updateVesselInFirestore({ status: 'offline' });
        }
    }, 10000);

    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, currentPos, vesselNickname, updateVesselInFirestore]);

  // --- 7. HANDLERS ---
  const handleSaveVesselAction = async () => {
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
                        vesselStatus === 'drifting' ? "bg-orange-600 animate-bounce" :
                        vesselStatus === 'stabilizing' ? "bg-slate-600 animate-pulse" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest">
                                {vesselStatus === 'stabilizing' ? 'Initialisation...' : 'Partage Actif'}
                            </p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                                {vesselStatus === 'moving' ? 'En mouvement' : 
                                 vesselStatus === 'stationary' ? 'Au mouillage' : 
                                 vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 
                                 vesselStatus === 'stabilizing' ? 'STABILISATION GPS (10s)...' : 'SIGNAL PERDU'}
                            </span>
                        </div>
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
                            <div className="flex gap-2"><Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase" /><Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={handleSaveVesselAction}><Save className="size-4" /></Button></div>
                        </div>
                        <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] border-2 gap-2" onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-primary")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" /><Button variant="outline" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVesselAction} disabled={!vesselIdToFollow.trim()}><Save className="size-4" /></Button></div></div>
              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Ma Flotte</Label>
                <div className="grid gap-2">
                    {savedVesselIds.map(id => {
                        const v = followedVessels?.find(v => v.id === id);
                        const isActive = v?.isSharing === true;
                        return (
                            <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm", isActive ? "border-primary/20 bg-primary/5" : "opacity-60")}>
                                <div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}</div><div className="flex flex-col"><span className="font-black text-xs">{v?.displayName || id}</span><span className="text-[8px] font-bold uppercase opacity-60">{isActive ? (v?.status === 'stationary' ? 'Mouillage' : v?.status === 'drifting' ? 'DÉRIVE !' : 'En ligne') : 'Déconnecté'}</span></div></div>
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
            options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
          >
                {followedVessels?.filter(v => v.isSharing && (mode === 'receiver' || !v.isGhostMode || v.status === 'emergency' || v.id === sharingId)).map(vessel => (
                    <React.Fragment key={vessel.id}>
                        {(vessel.status === 'stationary' || vessel.status === 'drifting') && vessel.anchorLocation && (
                            <>
                                <Circle 
                                    center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }}
                                    radius={vesselPrefs.mooringRadius || 20}
                                    options={{ fillColor: '#3b82f6', fillOpacity: 0.2, strokeColor: '#3b82f6', strokeWidth: 1 }}
                                />
                                <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1 bg-orange-500 rounded-full border-2 border-white shadow-lg">
                                        <Anchor className="size-3 text-white" />
                                    </div>
                                </OverlayView>
                            </>
                        )}
                        <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className={cn("px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2", 
                                    vessel.status === 'offline' ? "bg-red-600 animate-pulse" : 
                                    vessel.status === 'drifting' ? "bg-orange-600 animate-bounce" : "bg-slate-900/90")}>
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
                ))}
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
                {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl text-[10px] border border-dashed animate-in fade-in slide-in-from-left-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                <Badge variant="outline" className={cn("text-[8px] font-black h-4", h.statusLabel.includes('DÉRIVE') && "border-orange-500 text-orange-600 bg-orange-50")}>
                                    {h.statusLabel} {h.durationMinutes > 0 && `• depuis ${h.durationMinutes} min`}
                                </Badge>
                            </div>
                            <span className="font-bold opacity-60 flex items-center gap-1.5"><Clock className="size-2.5" /> {format(h.startTime, 'HH:mm')} ({h.pos.lat.toFixed(4)}, {h.pos.lng.toFixed(4)})</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-[8px] font-black uppercase border-2 bg-white" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                    </div>
                ))}
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
