
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, where, deleteDoc, getDoc } from 'firebase/firestore';
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
  WifiOff, 
  Expand, 
  Shrink, 
  Zap, 
  MapPin,
  X,
  Play,
  Volume2,
  Check,
  RefreshCw,
  Settings,
  Smartphone,
  Home,
  Compass,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  Users,
  Bird,
  Fish,
  Waves,
  Camera,
  ChevronDown,
  Bug,
  Trash2,
  History,
  Phone,
  Ship,
  AlertTriangle,
  Move
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)', zIndex: 100 }}>
      <div className="size-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative shadow-lg"></div>
    </div>
);

const BatteryStatusIcon = ({ level, charging }: { level: number; charging: boolean }) => {
  const props = { className: 'w-3 h-3' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 20) return <BatteryLow {...props} className="text-red-500" />;
  if (level < 60) return <BatteryMedium {...props} className="text-amber-500" />;
  return <BatteryFull {...props} className="text-green-500" />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  
  const [customSharingId, setCustomSharingId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'offline'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [nextSyncSeconds, setNextSyncSeconds] = useState(60);

  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  // Journaux
  const [technicalLog, setTechnicalLog] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: {lat: number, lng: number}, durationMins?: number }[]>([]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const watchIdRef = useRef<number | null>(null);
  const shouldPanOnNextFix = useRef<boolean>(false);
  const immobilityStartTime = useRef<number | null>(null);
  const driftStartTime = useRef<number | null>(null);

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

  const currentVesselData = useMemo(() => {
    return followedVessels?.find(v => v.id === sharingId);
  }, [followedVessels, sharingId]);

  const activeDuration = useMemo(() => {
    if (!currentVesselData?.statusChangedAt) return "ACTIF 0 MIN";
    const start = currentVesselData.statusChangedAt.toDate();
    const mins = Math.max(0, differenceInMinutes(new Date(), start));
    return `ACTIF ${mins} MIN`;
  }, [currentVesselData]);

  const tacticalMarkers = useMemo(() => {
    if (mode === 'sender') return currentVesselData?.huntingMarkers || [];
    return followedVessels?.flatMap(v => v.huntingMarkers || []) || [];
  }, [mode, currentVesselData, followedVessels]);

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
            mooringRadius: mooringRadius,
            ...batteryInfo,
            ...data 
        };
        
        if (data.status || data.isSharing === true) {
            updatePayload.statusChangedAt = serverTimestamp();
        }

        if (anchorPos && (vesselStatus === 'stationary' || vesselStatus === 'drifting')) {
            updatePayload.anchorLocation = { latitude: anchorPos.lat, longitude: anchorPos.lng };
        } else if (vesselStatus === 'moving') {
            updatePayload.anchorLocation = null;
        }

        // Logic Windy Cooldown (3h)
        const lastUpdate = currentVesselData?.lastWeatherUpdate?.toMillis?.() || 0;
        const now = Date.now();
        if (now - lastUpdate > 3 * 3600 * 1000 && currentPos) {
            try {
                const weather = await fetchWindyWeather(currentPos.lat, currentPos.lng);
                if (weather.success) {
                    updatePayload.windSpeed = weather.windSpeed;
                    updatePayload.windDir = weather.windDir;
                    updatePayload.wavesHeight = weather.wavesHeight;
                    updatePayload.lastWeatherUpdate = serverTimestamp();
                }
            } catch (e) {}
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true })
            .catch((err) => console.error(`[Tracker] Erreur Firestore:`, err));
        
        setNextSyncSeconds(60);
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, mooringRadius, anchorPos, vesselStatus, currentVesselData, currentPos]);

  const addToTechnicalLog = useCallback((label: string, pos: {lat: number, lng: number}) => {
    setTechnicalLog(prev => {
        const last = prev[0];
        if (last && last.statusLabel === label && last.vesselName === (vesselNickname || sharingId)) {
            const duration = Math.max(0, differenceInMinutes(new Date(), last.time));
            return [{ ...last, durationMins: duration }, ...prev.slice(1)];
        }
        return [{
            vesselName: vesselNickname || sharingId,
            statusLabel: label,
            time: new Date(),
            pos
        }, ...prev].slice(0, 50);
    });
  }, [vesselNickname, sharingId]);

  const handleClearTechnical = () => {
    setTechnicalLog([]);
    toast({ title: "Journal technique effacé" });
  };

  const handleClearTactical = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), {
            huntingMarkers: []
        });
        toast({ title: "Journal tactique effacé" });
    } catch (e) {
        console.error(e);
    }
  };

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    setMap(mapInstance);
  }, []);

  const handleRecenter = useCallback(() => {
    setIsFollowing(true);
    let target: { lat: number; lng: number } | null = null;
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
    }
  }, [mode, currentPos, followedVessels, map]);

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setCurrentPos(null); setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    const updates: any = { status: st, eventLabel: label };
    if (st === 'emergency') updates.isGhostMode = false;
    
    if (st === 'stationary' && currentPos) {
        setAnchorPos(currentPos);
        updates.anchorLocation = { latitude: currentPos.lat, longitude: currentPos.lng };
    }
    
    if (st === 'moving') {
        setAnchorPos(null);
        updates.anchorLocation = null;
        immobilityStartTime.current = null;
        driftStartTime.current = null;
    }

    updateVesselInFirestore(updates);
    addToTechnicalLog(label, currentPos || INITIAL_CENTER);
    toast({ title: label });
  };

  const handleResetIdentity = async () => {
    if (!user || !firestore) return;
    try {
        await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
        await updateDoc(doc(firestore, 'users', user.uid), {
            vesselNickname: null,
            lastVesselId: null,
            mooringRadius: 20
        });
        setVesselNickname('');
        setCustomSharingId('');
        setMooringRadius(20);
        toast({ title: "Identité réinitialisée" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { 
        navigator.geolocation.clearWatch(watchIdRef.current); 
        watchIdRef.current = null; 
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        
        if (accuracy > 500) { return; }

        setCurrentPos(newPos);

        if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
            if (!anchorPos) {
                setAnchorPos(newPos);
                updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving', accuracy: Math.round(accuracy) });
            } else {
                const distFromAnchor = getDistance(latitude, longitude, anchorPos.lat, anchorPos.lng);
                
                if (distFromAnchor > 100) {
                    setVesselStatus('moving');
                    setAnchorPos(null);
                    immobilityStartTime.current = null;
                    driftStartTime.current = null;
                    updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving', eventLabel: null, accuracy: Math.round(accuracy) });
                    addToTechnicalLog('EN MOUVEMENT', newPos);
                } else if (distFromAnchor > mooringRadius) {
                    if (!driftStartTime.current) driftStartTime.current = Date.now();
                    if (Date.now() - driftStartTime.current > 60000 && vesselStatus !== 'drifting') {
                        setVesselStatus('drifting');
                        updateVesselInFirestore({ location: { latitude, longitude }, status: 'drifting', eventLabel: 'À LA DÉRIVE !' });
                        addToTechnicalLog('À LA DÉRIVE !', newPos);
                    }
                } else {
                    driftStartTime.current = null;
                    if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
                    if (Date.now() - immobilityStartTime.current > 30000 && vesselStatus !== 'stationary') {
                        setVesselStatus('stationary');
                        updateVesselInFirestore({ location: { latitude, longitude }, status: 'stationary', eventLabel: 'AU MOUILLAGE' });
                        addToTechnicalLog('AU MOUILLAGE', newPos);
                    } else {
                        updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
                    }
                }
            }
        } else {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
        }

        if (isFollowing && map) map.panTo(newPos);
        if (shouldPanOnNextFix.current && map) {
            map.panTo(newPos);
            map.setZoom(16);
            shouldPanOnNextFix.current = false;
        }
      },
      (err) => console.error(`[Tracker] Erreur Géolocalisation:`, err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore, sharingId, mooringRadius, vesselStatus, anchorPos, addToTechnicalLog]);

  const getVesselIconInfo = (status: string) => {
    switch (status) {
        case 'moving': return { icon: Navigation, color: 'bg-blue-600', label: 'MOUV' };
        case 'stationary': return { icon: Anchor, color: 'bg-orange-500', label: 'MOUIL' };
        case 'drifting': return { icon: Anchor, color: 'bg-orange-600 animate-pulse', label: 'DÉRIVE' };
        case 'returning': return { icon: Ship, color: 'bg-indigo-600', label: 'RETOUR' };
        case 'landed': return { icon: Home, color: 'bg-green-600', label: 'HOME' };
        case 'emergency': return { icon: ShieldAlert, color: 'bg-red-600 animate-pulse', label: 'SOS' };
        case 'offline': return { icon: WifiOff, color: 'bg-red-600', label: 'OFF' };
        default: return { icon: Navigation, color: 'bg-slate-600', label: '???' };
    }
  };

  const handleAddTacticalMarker = (type: string) => {
    if (!currentPos || !firestore) return;
    const marker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: format(new Date(), 'HH:mm'),
        label: type
    };
    updateVesselInFirestore({ huntingMarkers: arrayUnion(marker) });
    toast({ title: `${type} signalé !` });
  };

  const sendEmergencySms = (type: 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Contact requis" }); return; }
    const pos = currentPos || INITIAL_CENTER;
    const body = `[LB-NC] ${type} : ${vesselNickname || sharingId}. ${vesselSmsMessage || "Assistance requise."}. Carte : https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

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
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden text-white transition-all", vesselStatus === 'landed' ? "bg-green-600" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300 text-yellow-300" /> PARTAGE ACTIF</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-2 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ml-2">
                                {vesselStatus === 'moving' ? <Move className="size-3" /> : vesselStatus === 'stationary' ? <Anchor className="size-3" /> : <Home className="size-3" />}
                                {vesselStatus === 'moving' ? 'EN MOUVEMENT' : vesselStatus === 'stationary' ? 'AU MOUILLAGE' : 'À TERRE'}
                            </div>
                            <span className="text-[9px] font-black uppercase opacity-60 ml-auto">{activeDuration}</span>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/10 rounded-2xl border-2 border-dashed space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}>
                                <Ship className="size-4 text-blue-600" /> RETOUR MAISON
                            </Button>
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => handleManualStatusToggle('landed', 'HOME (À TERRE)')}>
                                <Home className="size-4 text-green-600" /> HOME (À TERRE)
                            </Button>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/10 rounded-2xl border-2 border-dashed space-y-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-1 tracking-widest"><Zap className="size-3" /> SIGNALEMENT TACTIQUE</p>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { id: 'OISEAUX', icon: Bird, color: 'bg-blue-500', label: 'Oiseaux' },
                                { id: 'MARLIN', icon: Fish, color: 'bg-red-600', label: 'Marlin' },
                                { id: 'THON', icon: Fish, color: 'bg-slate-700', label: 'Thon' },
                                { id: 'TAZARD', icon: Fish, color: 'bg-cyan-600', label: 'Tazard' },
                                { id: 'WAHOO', icon: Fish, color: 'bg-blue-900', label: 'Wahoo' },
                                { id: 'BONITE', icon: Fish, color: 'bg-indigo-600', label: 'Bonite' },
                                { id: 'SARDINES', icon: Waves, color: 'bg-teal-500', label: 'Sardines' },
                                { id: 'PRISE', icon: Camera, color: 'bg-emerald-600', label: 'Prise' }
                            ].map(btn => (
                                <Button key={btn.id} variant="outline" className={cn("h-14 border-2 flex flex-col items-center justify-center p-0 gap-1", btn.color)} onClick={() => handleAddTacticalMarker(btn.id)}>
                                    <btn.icon className="size-4 text-white" />
                                    <span className="text-[7px] font-black uppercase text-white">{btn.label}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20 touch-manipulation" onClick={() => handleManualStatusToggle('emergency', 'DEMANDE D\'ASSISTANCE (SOS)')}>
                        <ShieldAlert className="size-6 animate-pulse" /> DEMANDE D'ASSISTANCE (SOS)
                    </Button>

                    <Accordion type="single" collapsible className="w-full space-y-2">
                        <AccordionItem value="identity" className="bg-muted/30 border rounded-lg">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 h-12">
                                <Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">IDENTITÉ & IDS</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4">
                                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60">Mon Surnom</Label><Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="h-11 border-2 font-bold uppercase" /></div>
                                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60">ID du navire</Label><Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="h-11 border-2 font-mono uppercase" /></div>
                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase">Rayon Mouillage</Label><Badge variant="outline" className="font-black bg-white">{mooringRadius}m</Badge></div>
                                    <Slider value={[mooringRadius]} min={10} max={200} step={10} onValueChange={v => setMooringRadius(v[0])} />
                                </div>
                                <Button variant="outline" className="w-full h-10 font-black uppercase text-[10px] border-destructive/20 text-destructive" onClick={handleResetIdentity}>RÉINITIALISER MON IDENTITÉ</Button>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="emergency" className="bg-orange-50/20 border-orange-100 border rounded-lg">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 h-12">
                                <Smartphone className="size-4 text-orange-600" /><span className="text-[10px] font-black uppercase">URGENCE (SMS)</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4">
                                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60">Contact à terre</Label><Input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="77 12 34" className="h-11 border-2 font-black text-lg" /></div>
                                <Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} placeholder="Message personnalisé..." className="border-2 min-h-[80px]" />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="test-bench" className="bg-purple-50/30 border-purple-100 border rounded-lg">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 h-12">
                                <Bug className="size-4 text-purple-600" /><span className="text-[10px] font-black uppercase">PONT DE TEST (ADMIN)</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" className="h-10 font-black text-[9px] border-2" onClick={() => handleManualStatusToggle('moving', 'EN MOUVEMENT')}>SIMULER MOUV</Button>
                                    <Button variant="outline" className="h-10 font-black text-[9px] border-2" onClick={() => handleManualStatusToggle('stationary', 'AU MOUILLAGE')}>SIMULER MOUIL</Button>
                                    <Button variant="outline" className="h-10 font-black text-[9px] border-2" onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}>SIMULER RETOUR</Button>
                                    <Button variant="outline" className="h-10 font-black text-[9px] border-2" onClick={() => handleManualStatusToggle('landed', 'HOME (À TERRE)')}>SIMULER HOME</Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
              )}
            </div>
          )}

          {(mode === 'receiver' || mode === 'fleet') && (
            <div className="space-y-4">
                {followedVessels?.filter(v => v.isSharing && v.location).map(v => (
                    <div key={v.id} className="p-4 border-2 rounded-2xl bg-card shadow-sm transition-all hover:border-primary/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", getVesselIconInfo(v.status).color)}><Navigation className="size-4 text-white" /></div>
                                <div className="flex flex-col"><span className="font-black uppercase text-xs">{v.displayName || v.id}</span><span className="text-[8px] font-black uppercase opacity-40">{v.status}</span></div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border-2 rounded-xl" onClick={() => { if(v.location) { map?.panTo({ lat: v.location.latitude, lng: v.location.longitude }); map?.setZoom(15); } }}><MapPin className="size-5" /></Button>
                        </div>
                    </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")} style={{ minHeight: isFullscreen ? '100dvh' : '450px' }}>
          {isLoaded ? (
            <GoogleMap 
              mapContainerStyle={{ width: '100%', height: '100%' }}
              defaultCenter={INITIAL_CENTER} 
              defaultZoom={10} 
              onLoad={onLoad} 
              onDragStart={() => setIsFollowing(false)} 
              options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
            >
                  {followedVessels?.filter(v => v.isSharing && v.location).map(vessel => {
                      const lastActiveMillis = vessel.lastActive?.toMillis?.() || Date.now();
                      const isOffline = (Date.now() - lastActiveMillis > 70000);
                      const statusInfo = getVesselIconInfo(isOffline ? 'offline' : vessel.status);
                      const isMe = vessel.id === sharingId;
                      const battery = vessel.batteryLevel ?? 100;
                      const isCharging = vessel.isCharging ?? false;
                      
                      return (
                          <React.Fragment key={`vessel-${vessel.id}`}>
                              {(vessel.status === 'stationary' || vessel.status === 'drifting') && vessel.anchorLocation && (
                                <>
                                    <Circle 
                                        center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} 
                                        radius={vessel.mooringRadius || 20} 
                                        options={{ fillColor: '#3b82f6', fillOpacity: 0.15, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 1 }} 
                                    />
                                    <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div style={{ transform: 'translate(-50%, -50%)' }} className="z-10"><Anchor className="size-8 text-orange-500 drop-shadow-md stroke-[2.5]" /></div>
                                    </OverlayView>
                                </>
                              )}
                              <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                  <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-50">
                                      {/* LABEL PRINCIPAL : NOM | STATUT */}
                                      <div className={cn(
                                          "px-2.5 py-1.5 backdrop-blur-md rounded-lg text-[10px] font-black shadow-xl border-2 whitespace-nowrap flex items-center gap-2", 
                                          isOffline ? "bg-red-600 text-white animate-pulse border-white/40" : "bg-white/95 text-slate-900 border-primary/20"
                                      )}>
                                          <span className="truncate max-w-[100px]">{vessel.displayName}</span>
                                          <span className={cn("border-l-2 pl-2", isOffline ? "text-white/60" : "text-primary/60")}>{statusInfo.label}</span>
                                      </div>

                                      {/* ICONES DE NAVIGATION / MOUVEMENT */}
                                      {isMe && mode === 'sender' ? <PulsingDot /> : (
                                          <div className={cn("p-2.5 rounded-full border-2 border-white shadow-2xl scale-110", statusInfo.color)}>
                                              {React.createElement(statusInfo.icon, { className: "size-6 text-white drop-shadow-sm" })}
                                          </div>
                                      )}

                                      {/* BULLES D'ÉTAT (BATTERIE & MÉTÉO) */}
                                      <div className="flex flex-col gap-1 mt-1">
                                          {/* BATTERIE BULLE */}
                                          {(isCharging || battery < 20) && (
                                              <div className={cn(
                                                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1.5 shadow-lg border-2",
                                                  isCharging ? "bg-blue-600 text-white border-blue-400" : "bg-red-600 text-white border-red-400 animate-pulse"
                                              )}>
                                                  <BatteryStatusIcon level={battery} charging={isCharging} />
                                                  <span>{isCharging ? 'EN CHARGE' : 'BATTERIE FAIBLE'} ({battery}%)</span>
                                              </div>
                                          )}

                                          {/* MÉTÉO WINDY BULLE */}
                                          {vessel.windSpeed !== undefined && (
                                              <div className="bg-slate-900/90 backdrop-blur-md text-white px-2 py-1 rounded-full text-[8px] font-black shadow-lg border border-white/20 flex items-center gap-2">
                                                  <div className="flex items-center gap-1"><Waves className="size-3 text-blue-400" /> {vessel.windSpeed}ND</div>
                                                  {vessel.wavesHeight !== undefined && (
                                                      <div className="border-l border-white/20 pl-2 flex items-center gap-1"><Waves className="size-3 text-cyan-400" /> {vessel.wavesHeight.toFixed(1)}m</div>
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </OverlayView>
                          </React.Fragment>
                      );
                  })}
            </GoogleMap>
          ) : <Skeleton className="h-full w-full" />}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className={cn("shadow-lg h-10 w-10 p-0 border-2", isFollowing ? "bg-primary text-white" : "bg-background/90 text-primary")}><Compass className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="grid grid-cols-2 gap-2">
                <Button variant="destructive" className="h-14 font-black uppercase rounded-xl shadow-lg gap-3" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5" /> MAYDAY</Button>
                <Button variant="secondary" className="h-14 font-black uppercase rounded-xl shadow-lg gap-3 border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}><RefreshCw className="size-5 text-primary" /> PAN PAN</Button>
            </div>

            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="tech-log" className="border rounded-xl px-3 bg-muted/5 mb-2">
                    <div className="flex items-center justify-between">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-3">JOURNAL TECHNIQUE</AccordionTrigger>
                        <Button variant="ghost" size="sm" onClick={handleClearTechnical} className="h-7 text-destructive text-[8px] font-black uppercase">Effacer</Button>
                    </div>
                    <AccordionContent className="pb-4 space-y-2">
                        {technicalLog.map((log, i) => (
                            <div key={i} className="p-2 bg-white border-2 rounded-lg text-[9px] flex justify-between items-center">
                                <div className="flex flex-col"><span className="font-black text-primary">{log.vesselName}</span><span className="font-bold opacity-60">{log.statusLabel} {log.durationMins ? `(${log.durationMins} min)` : ''}</span></div>
                                <span className="opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tactical-log" className="border rounded-xl px-3 bg-muted/5">
                    <div className="flex items-center justify-between">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-3">JOURNAL TACTIQUE</AccordionTrigger>
                        <Button variant="ghost" size="sm" onClick={handleClearTactical} className="h-7 text-destructive text-[8px] font-black uppercase">Effacer</Button>
                    </div>
                    <AccordionContent className="pb-4 space-y-2">
                        {tacticalMarkers.map((m, i) => (
                            <div key={i} className="p-2 bg-white border-2 rounded-lg text-[9px] flex justify-between items-center">
                                <Badge variant="outline" className="text-[8px] font-black uppercase">{m.label}</Badge>
                                <span className="font-bold opacity-60">À {m.time}</span>
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </Card>

      <Card className="border-2 bg-muted/10 shadow-none rounded-2xl">
        <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary"><Phone className="size-4" /> Annuaire Maritime NC</CardTitle></CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Urgences</h4><div className="space-y-2"><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">COSS NC (Mer)</span><a href="tel:16" className="text-sm font-black flex items-center gap-2">16</a></div></div></div>
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-1">Services</h4><div className="space-y-2"><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">Météo Marine</span><a href="tel:366736" className="text-sm font-black flex items-center gap-2">36 67 36</a></div></div></div>
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-indigo-600 border-b pb-1">Ports</h4><div className="space-y-2"><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">Port Autonome</span><a href="tel:255000" className="text-sm font-black flex items-center gap-2">25 50 00</a></div></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
