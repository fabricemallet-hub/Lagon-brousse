
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, where, deleteDoc } from 'firebase/firestore';
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
  Trash2,
  History,
  Phone,
  Ship,
  AlertTriangle,
  Move,
  Wind,
  WifiOff,
  Eye,
  EyeOff
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
    <div className="absolute z-[100]" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="size-6 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-6 rounded-full bg-blue-500 border-4 border-white relative shadow-2xl"></div>
    </div>
);

const BatteryStatusIcon = ({ level, charging, size = 4 }: { level: number; charging: boolean, size?: number | string }) => {
  const props = { className: `size-${size}` };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 20) return <BatteryLow {...props} className="text-red-600" />;
  if (level < 60) return <BatteryMedium {...props} className="text-orange-500" />;
  return <BatteryFull {...props} className="text-green-600" />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  
  const [customSharingId, setCustomSharingId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'offline'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const currentPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const anchorPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const statusRef = useRef<VesselStatus['status'] | 'offline'>('moving');
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const driftStartTime = useRef<number | null>(null);
  const lastWeatherUpdateRef = useRef<number>(0);

  const [technicalLog, setTechnicalLog] = useState<{ label: string, startTime: Date, lastUpdate: Date, duration: number }[]>([]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

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

  useEffect(() => {
    if (userProfile && !isSharing) {
        if (userProfile.vesselNickname) setVesselNickname(userProfile.vesselNickname);
        if (userProfile.lastVesselId) setCustomSharingId(userProfile.lastVesselId);
        if (userProfile.mooringRadius) setMooringRadius(userProfile.mooringRadius);
    }
  }, [userProfile, isSharing]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || !sharingId) return;
    
    let batteryInfo: any = {};
    if ('getBattery' in navigator) {
        try {
            const b: any = await (navigator as any).getBattery();
            batteryInfo.batteryLevel = Math.round(b.level * 100);
            batteryInfo.isCharging = b.charging;
        } catch (e) {}
    }

    const pos = currentPosRef.current;
    const updatePayload: any = { 
        id: sharingId,
        userId: user.uid, 
        displayName: vesselNickname || user.displayName || 'Capitaine', 
        isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
        lastActive: serverTimestamp(),
        mooringRadius: mooringRadius,
        ...batteryInfo,
        ...data 
    };
    
    if (data.status || data.isSharing === true) {
        updatePayload.statusChangedAt = serverTimestamp();
    }

    if (anchorPosRef.current && (statusRef.current === 'stationary' || statusRef.current === 'drifting')) {
        updatePayload.anchorLocation = { latitude: anchorPosRef.current.lat, longitude: anchorPosRef.current.lng };
    } else if (statusRef.current === 'moving') {
        updatePayload.anchorLocation = null;
    }

    const now = Date.now();
    if ((now - lastWeatherUpdateRef.current > 3 * 3600 * 1000) && pos) {
        try {
            const weather = await fetchWindyWeather(pos.lat, pos.lng);
            if (weather.success) {
                updatePayload.windSpeed = weather.windSpeed;
                updatePayload.windDir = weather.windDir;
                updatePayload.wavesHeight = weather.wavesHeight;
                updatePayload.lastWeatherUpdate = serverTimestamp();
                lastWeatherUpdateRef.current = now;
            }
        } catch (e) {}
    }

    await setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true });
    
    updateDoc(doc(firestore, 'users', user.uid), {
        vesselNickname: vesselNickname || user.displayName,
        lastVesselId: sharingId,
        mooringRadius: mooringRadius
    });
  }, [user, firestore, sharingId, vesselNickname, isSharing, mooringRadius]);

  const addToTechnicalLog = useCallback((label: string) => {
    setTechnicalLog(prev => {
        if (prev.length > 0 && prev[0].label === label) {
            const last = prev[0];
            const now = new Date();
            const duration = differenceInMinutes(now, last.startTime);
            const updated = { ...last, lastUpdate: now, duration };
            return [updated, ...prev.slice(1)];
        }
        return [{ label, startTime: new Date(), lastUpdate: new Date(), duration: 0 }, ...prev].slice(0, 50);
    });
  }, []);

  const handleResetIdentity = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            vesselNickname: null,
            lastVesselId: null,
            mooringRadius: 20
        });
        setVesselNickname('');
        setCustomSharingId('');
        setMooringRadius(20);
        toast({ title: "Identité réinitialisée" });
    } catch (e) {}
  };

  const handleClearTactical = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: [] });
        toast({ title: "Journal tactique effacé" });
    } catch (e) {
        console.error(e);
    }
  };

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
    }
  }, [mode, currentPos, followedVessels, map]);

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    setCurrentPos(null); 
    setAnchorPos(null);
    anchorPosRef.current = null;
    currentPosRef.current = null;
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    statusRef.current = st;
    const updates: any = { status: st, eventLabel: label };
    
    if (st === 'stationary' && currentPosRef.current) {
        setAnchorPos(currentPosRef.current);
        anchorPosRef.current = currentPosRef.current;
    }
    
    if (st === 'moving') {
        setAnchorPos(null);
        anchorPosRef.current = null;
        immobilityStartTime.current = null;
        driftStartTime.current = null;
    }

    updateVesselInFirestore(updates);
    addToTechnicalLog(label);
    toast({ title: label });
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        
        if (accuracy > 500) return;

        currentPosRef.current = newPos;
        setCurrentPos(newPos);

        const currentStatus = statusRef.current;

        if (currentStatus !== 'returning' && currentStatus !== 'landed' && currentStatus !== 'emergency') {
            if (!anchorPosRef.current) {
                anchorPosRef.current = newPos;
                setAnchorPos(newPos);
                updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving', accuracy: Math.round(accuracy) });
                addToTechnicalLog("EN MOUVEMENT");
            } else {
                const distFromAnchor = getDistance(latitude, longitude, anchorPosRef.current.lat, anchorPosRef.current.lng);
                
                if (distFromAnchor > 100) {
                    statusRef.current = 'moving';
                    setVesselStatus('moving');
                    anchorPosRef.current = null;
                    setAnchorPos(null);
                    updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving', eventLabel: null, accuracy: Math.round(accuracy) });
                    addToTechnicalLog("EN MOUVEMENT");
                } else if (distFromAnchor > mooringRadius) {
                    if (!driftStartTime.current) driftStartTime.current = Date.now();
                    if (Date.now() - driftStartTime.current > 60000 && statusRef.current !== 'drifting') {
                        statusRef.current = 'drifting';
                        setVesselStatus('drifting');
                        updateVesselInFirestore({ location: { latitude, longitude }, status: 'drifting', eventLabel: 'À LA DÉRIVE !' });
                        addToTechnicalLog("À LA DÉRIVE !");
                    }
                } else {
                    driftStartTime.current = null;
                    if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
                    if (Date.now() - immobilityStartTime.current > 30000 && statusRef.current !== 'stationary') {
                        statusRef.current = 'stationary';
                        setVesselStatus('stationary');
                        updateVesselInFirestore({ location: { latitude, longitude }, status: 'stationary', eventLabel: 'AU MOUILLAGE' });
                        addToTechnicalLog("AU MOUILLAGE");
                    } else {
                        updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
                    }
                }
            }
        } else {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
        }
      },
      (err) => console.error(`[Tracker] Erreur GPS:`, err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, sharingId, mooringRadius, updateVesselInFirestore, addToTechnicalLog]);

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
    const contact = userProfile?.emergencyContact;
    if (!contact) { toast({ variant: "destructive", title: "Contact requis", description: "Réglez votre contact dans Profil." }); return; }
    const pos = currentPos || INITIAL_CENTER;
    const body = `[LB-NC] ${type} : ${vesselNickname || sharingId}. Carte : https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    window.location.href = `sms:${contact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
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

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}>
                            <Navigation className="size-4 text-blue-600" /> Retour Maison
                        </Button>
                        <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatusToggle('landed', 'HOME (À TERRE)')}>
                            <Home className="size-4 text-green-600" /> Home (À terre)
                        </Button>
                    </div>

                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20 touch-manipulation" onClick={() => handleManualStatusToggle('emergency', 'DEMANDE D\'ASSISTANCE (SOS)')}>
                        <ShieldAlert className="size-6 animate-pulse" /> DEMANDE D'ASSISTANCE (SOS)
                    </Button>
                </div>
              )}

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                        <Settings className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Identité & IDs</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Surnom du capitaine</Label>
                            <Input placeholder="EX: CAPITAINE NEMO" value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold h-12 border-2 uppercase" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID du navire (Partage)</Label>
                            <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                        </div>
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[10px] font-black uppercase opacity-60">Rayon de mouillage</Label>
                                <Badge variant="outline" className="font-black h-6">{mooringRadius}m</Badge>
                            </div>
                            <Slider value={[mooringRadius]} min={10} max={200} step={10} onValueChange={v => setMooringRadius(v[0])} />
                        </div>
                        <Button variant="ghost" className="w-full h-10 text-[9px] font-black uppercase text-destructive border-2 border-destructive/10" onClick={handleResetIdentity}>
                            <Trash2 className="size-3 mr-2" /> Réinitialiser mon identité
                        </Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="test-pont" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-slate-100 rounded-xl">
                        <Zap className="size-4 text-slate-600" />
                        <span className="text-[10px] font-black uppercase">Pont de Test (Admin)</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="h-10 text-[8px] font-black uppercase" onClick={() => handleManualStatusToggle('moving', 'TEST: MOUVEMENT')}>SIMUL MOUV</Button>
                            <Button variant="outline" size="sm" className="h-10 text-[8px] font-black uppercase" onClick={() => handleManualStatusToggle('stationary', 'TEST: MOUILLAGE')}>SIMUL MOUIL</Button>
                        </div>
                        <Button variant="outline" size="sm" className="w-full h-10 text-[8px] font-black uppercase border-dashed" onClick={() => updateVesselInFirestore({})}>Forcer Sync Firestore</Button>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {(mode === 'receiver' || mode === 'fleet') && (
            <div className="space-y-4">
                {followedVessels?.filter(v => v.isSharing && v.location).map(v => (
                    <div key={v.id} className="p-4 border-2 rounded-2xl bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", getVesselIconInfo(v.status).color)}><Navigation className="size-4 text-white" /></div>
                                <div className="flex flex-col"><span className="font-black uppercase text-xs">{v.displayName || v.id}</span><span className="text-[8px] font-black uppercase opacity-40">{v.status}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <BatteryStatusIcon level={v.batteryLevel || 100} charging={v.isCharging || false} size={4} />
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border-2 rounded-xl" onClick={() => { if(v.location) { map?.panTo({ lat: v.location.latitude, lng: v.location.longitude }); map?.setZoom(15); } }}><MapPin className="size-5" /></Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")}>
          {isLoaded ? (
            <GoogleMap 
              mapContainerStyle={{ width: '100%', height: '100%' }}
              defaultCenter={INITIAL_CENTER} 
              defaultZoom={10} 
              onLoad={(m) => setMap(m)} 
              options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
            >
                  {followedVessels?.filter(v => v.isSharing && v.location).map(vessel => {
                      const lastActiveMillis = vessel.lastActive?.toMillis?.() || Date.now();
                      const isOffline = (Date.now() - lastActiveMillis > 75000);
                      const statusInfo = getVesselIconInfo(isOffline ? 'offline' : vessel.status);
                      const isMe = vessel.id === sharingId;
                      const battery = vessel.batteryLevel ?? 100;
                      const isCharging = vessel.isCharging ?? false;
                      
                      return (
                          <React.Fragment key={`vessel-${vessel.id}`}>
                              {/* ANCRE FIXE ET CERCLE */}
                              {(vessel.status === 'stationary' || vessel.status === 'drifting') && vessel.anchorLocation && (
                                <>
                                    <Circle 
                                        center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} 
                                        radius={vessel.mooringRadius || 20} 
                                        options={{ fillColor: '#3b82f6', fillOpacity: 0.15, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 1 }} 
                                    />
                                    <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div style={{ transform: 'translate(-50%, -50%)' }} className="z-10">
                                            <Anchor className="size-14 text-orange-500 drop-shadow-2xl stroke-[3] scale-150" />
                                        </div>
                                    </OverlayView>
                                </>
                              )}

                              {/* NAVIRE MOBILE - NOUVEAU RENDU V3 (CONFORME PHOTO) */}
                              <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                  <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-50">
                                      {/* BADGE NOM | STATUT (HAUT) */}
                                      <div className={cn(
                                          "px-3 py-2 backdrop-blur-md rounded-lg text-[11px] font-black shadow-2xl border-2 flex items-center gap-2 mb-1", 
                                          isOffline ? "bg-red-600 text-white border-white/40" : "bg-white/95 text-slate-900 border-primary/20"
                                      )}>
                                          <span className="truncate max-w-[120px]">{vessel.displayName}</span>
                                          <span className={cn("border-l-2 pl-2", isOffline ? "text-white/60" : "text-primary/60")}>{statusInfo.label}</span>
                                      </div>

                                      {/* ICÔNE CENTRALE MASSIVE (MILIEU) */}
                                      <div className="relative">
                                          {isMe && mode === 'sender' && <PulsingDot />}
                                          <div className={cn("p-4 rounded-full border-4 border-white shadow-2xl", statusInfo.color)}>
                                              {React.createElement(statusInfo.icon, { className: "size-9 text-white drop-shadow-sm" })}
                                          </div>
                                      </div>

                                      {/* ÉTAGES DE BULLES D'ÉTAT (BAS) */}
                                      <div className="flex flex-col items-center gap-1 mt-2">
                                          {/* BULLE BATTERIE */}
                                          <div className={cn(
                                              "px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-2 shadow-xl border-2 bg-white",
                                              battery < 20 ? "text-red-600 border-red-200" : (battery < 60 ? "text-orange-600 border-orange-100" : "text-slate-700 border-slate-100")
                                          )}>
                                              <BatteryStatusIcon level={battery} charging={isCharging} size={3.5} />
                                              <span>{battery}%</span>
                                          </div>

                                          {/* BULLES D'ALERTE DYNAMIQUE */}
                                          {isCharging && <Badge className="bg-blue-600 text-white text-[8px] font-black shadow-lg border-2 border-white/30">⚡ EN CHARGE</Badge>}
                                          {battery < 20 && !isCharging && <Badge className="bg-red-600 text-white text-[8px] font-black shadow-lg animate-pulse border-2 border-white/30">⚠️ BATTERIE FAIBLE</Badge>}

                                          {/* BULLE MÉTÉO WINDY (LIGNES CONTRASTÉES) */}
                                          {vessel.windSpeed !== undefined && (
                                              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-2xl text-[9px] font-black shadow-2xl border border-white/20 flex items-center gap-3">
                                                  <div className="flex items-center gap-1.5"><Wind className="size-3 text-blue-400" /> {vessel.windSpeed} ND</div>
                                                  <div className="border-l border-white/20 pl-2 flex items-center gap-1.5"><Waves className="size-3 text-cyan-400" /> {vessel.wavesHeight?.toFixed(1)}m</div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </OverlayView>

                              {/* MARQUEURS TACTIQUES */}
                              {vessel.huntingMarkers?.map(m => (
                                <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center">
                                        <div className="px-2 py-1 bg-white/95 backdrop-blur-md rounded border-2 border-primary/20 shadow-xl mb-1 text-[9px] font-black uppercase">
                                            {m.label}
                                        </div>
                                        <div className="p-1.5 rounded-full bg-primary shadow-lg border-2 border-white text-white">
                                            {m.label === 'OISEAUX' ? <Bird className="size-3" /> : <Fish className="size-3" />}
                                        </div>
                                    </div>
                                </OverlayView>
                              ))}
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

            <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="tech-log" className="border rounded-xl px-3 bg-muted/5">
                    <div className="flex items-center justify-between">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-3">JOURNAL TECHNIQUE</AccordionTrigger>
                        <Button variant="ghost" size="sm" onClick={() => setTechnicalLog([])} className="h-7 text-destructive text-[8px] font-black uppercase">Effacer</Button>
                    </div>
                    <AccordionContent className="pb-4 space-y-2">
                        {technicalLog.map((l, i) => (
                            <div key={i} className="p-3 bg-white border-2 rounded-xl text-[10px] flex justify-between items-center shadow-sm">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-black text-primary uppercase">{l.label}</span>
                                    <span className="text-[8px] font-bold opacity-40 uppercase">Début: {format(l.startTime, 'HH:mm')} • Vu à: {format(l.lastUpdate, 'HH:mm')}</span>
                                </div>
                                <Badge variant="outline" className="text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/10">
                                    {l.duration > 0 ? `${l.duration} min` : 'À l\'instant'}
                                </Badge>
                            </div>
                        ))}
                        {technicalLog.length === 0 && <p className="text-center text-[9px] font-bold opacity-30 uppercase italic py-4">Aucun événement</p>}
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tactical-log" className="border rounded-xl px-3 bg-muted/5">
                    <div className="flex items-center justify-between">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-3">JOURNAL TACTIQUE</AccordionTrigger>
                        <Button variant="ghost" size="sm" onClick={handleClearTactical} className="h-7 text-destructive text-[8px] font-black uppercase">Effacer</Button>
                    </div>
                    <AccordionContent className="pb-4 space-y-2">
                        {currentVesselData?.huntingMarkers?.map((m, i) => (
                            <div key={i} className="p-2 bg-white border-2 rounded-lg text-[9px] flex justify-between items-center shadow-sm">
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/30 text-primary">{m.label}</Badge>
                                <span className="font-bold opacity-60">À {m.time}</span>
                            </div>
                        ))}
                        {(!currentVesselData?.huntingMarkers || currentVesselData.huntingMarkers.length === 0) && <p className="text-center text-[9px] font-bold opacity-30 uppercase italic py-4">Pas de signalements</p>}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </Card>

      <Card className="border-2 bg-muted/10 shadow-none rounded-2xl">
        <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary"><Phone className="size-4" /> Annuaire Maritime NC</CardTitle></CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-red-600 border-b pb-1">Urgences</h4><div className="space-y-2"><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">COSS NC (Mer)</span><a href="tel:16" className="text-sm font-black">16</a></div><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">SAMU (Terre)</span><a href="tel:15" className="text-sm font-black">15</a></div></div></div>
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-1">Services</h4><div className="space-y-2"><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">Météo Marine</span><a href="tel:366736" className="text-sm font-black">36 67 36</a></div></div></div>
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-indigo-600 border-b pb-1">Ports</h4><div className="space-y-2"><div className="flex flex-col"><span className="text-[9px] font-bold uppercase">Port Autonome</span><a href="tel:255000" className="text-sm font-black">25 50 00</a></div></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
