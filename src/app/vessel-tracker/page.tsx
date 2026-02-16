'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
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
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  History,
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
  Phone,
  Waves,
  Eye,
  Bird,
  AlertCircle,
  Clock,
  EyeOff,
  Compass,
  Ruler
} from 'lucide-react';
import { cn, getDistance, getBearing } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const IMMOBILITY_THRESHOLD_METERS = 20; 
const EMPTY_IDS: string[] = [];

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const ShootingAngleWedge = React.memo(({ angle, spread, color, distance = 500, zoom = 16, lat = -21.3 }: { angle: number, spread: number, color: string, distance?: number, zoom?: number, lat?: number }) => {
    const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    const pixelRadius = distance / metersPerPixel;
    const svgSize = Math.max(pixelRadius * 2 + 20, 40);

    if (spread >= 360) {
        return (
            <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1, width: svgSize, height: svgSize }}>
                <svg width={svgSize} height={svgSize}>
                    <circle cx={svgSize/2} cy={svgSize/2} r={pixelRadius} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
                </svg>
            </div>
        );
    }

    return (
        <div 
            style={{ 
                position: 'absolute', 
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                pointerEvents: 'none',
                zIndex: 1,
                width: svgSize,
                height: svgSize
            }}
        >
            <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                <path 
                    d={`M ${svgSize/2},${svgSize/2} L ${svgSize/2 + pixelRadius * Math.sin((-spread/2) * Math.PI / 180)},${svgSize/2 - pixelRadius * Math.cos((-spread/2) * Math.PI / 180)} A ${pixelRadius},${pixelRadius} 0 ${spread > 180 ? 1 : 0},1 ${svgSize/2 + pixelRadius * Math.sin((spread/2) * Math.PI / 180)},${svgSize/2 - pixelRadius * Math.cos((spread/2) * Math.PI / 180)} Z`} 
                    fill={color} 
                    fillOpacity="0.2"
                    stroke={color}
                    strokeWidth="1"
                    strokeOpacity="0.5"
                />
            </svg>
        </div>
    );
});
ShootingAngleWedge.displayName = 'ShootingAngleWedge';

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [isPositionHidden, setIsPositionHidden] = useState(false);
  const [isReceiverGpsActive, setIsReceiverGpsActive] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const shouldPanOnNextFix = useRef(false);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const currentPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const currentAccuracyRef = useRef<number | null>(null);
  const anchorPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const isFirstFixRef = useRef<boolean>(true);

  // Shooting Angle State
  const [isAngleActive, setIsAngleActive] = useState(false);
  const [shootingAngle, setShootingAngle] = useState(0);
  const [shootingSpread, setShootingSpread] = useState(30);
  const [shootingDistance, setShootingDistance] = useState(500);
  const [isDangerActive, setIsDangerActive] = useState(false);
  const [dangerMessage, setDangerMessage] = useState('');
  const lastAlertTimeRef = useRef<number>(0);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, emergency: true, birds: true },
    notifySounds: { moving: '', stationary: '', offline: '', emergency: '', birds: '' },
    isWatchEnabled: false,
    watchType: 'stationary',
    watchDuration: 60,
    watchSound: '',
    batteryThreshold: 20,
    batterySound: ''
  });
  
  const [history, setHistory] = useState<{ 
    vesselName: string, 
    statusLabel: string, 
    time: Date, 
    pos: google.maps.LatLngLiteral | null, 
    batteryLevel?: number, 
    isCharging?: boolean,
    accuracy?: number
  }[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastBatteryLevelsRef = useRef<Record<string, number>>({});
  const lastClearTimesRef = useRef<Record<string, number>>({});

  const [activeWatchAlarm, setActiveWatchAlarm] = useState<HTMLAudioElement | null>(null);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = useMemo(() => userProfile?.savedVesselIds || EMPTY_IDS, [userProfile?.savedVesselIds]);
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId) && sharingId) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
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
    return dbSounds.filter(s => 
      !s.categories || s.categories.includes('Vessel') || s.categories.includes('General')
    ).map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  const playVesselSound = useCallback((soundId: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

  const stopWatchAlarm = () => {
    if (activeWatchAlarm) {
        activeWatchAlarm.pause();
        setActiveWatchAlarm(null);
        toast({ title: "Alarme de veille arrêtée" });
    }
  };

  // Sync angle to firestore
  useEffect(() => {
    if (mode !== 'sender' || !isSharing) return;
    const updatePayload: any = {};
    if (isAngleActive) {
        updatePayload.shootingAngle = { center: shootingAngle, spread: shootingSpread, distance: shootingDistance, isActive: true };
    } else {
        updatePayload.shootingAngle = null;
    }
    updateVesselInFirestore(updatePayload);
  }, [isAngleActive, shootingAngle, shootingSpread, shootingDistance]);

  // Collision Detection
  useEffect(() => {
    if (!currentPosRef.current || !followedVessels) {
        setIsDangerActive(false);
        return;
    }

    const isWithinAngle = (bearing: number, center: number, spread: number) => {
        if (spread >= 360) return true;
        let diff = Math.abs(bearing - center) % 360;
        if (diff > 180) diff = 360 - diff;
        return diff <= spread / 2;
    };

    let dangerFound = false;
    let msg = '';

    followedVessels.forEach(v => {
        if (v.id === sharingId || !v.location || !v.isSharing || v.isPositionHidden) return;
        
        // If VESSEL points at ME (local user)
        if (v.shootingAngle?.isActive) {
            const distToMe = getDistance(v.location.latitude, v.location.longitude, currentPosRef.current!.lat, currentPosRef.current!.lng);
            if (distToMe <= v.shootingAngle.distance) {
                const bearingToMe = getBearing(v.location.latitude, v.location.longitude, currentPosRef.current!.lat, currentPosRef.current!.lng);
                if (isWithinAngle(bearingToMe, v.shootingAngle.center, v.shootingAngle.spread)) {
                    dangerFound = true;
                    msg = `DANGER : Vous êtes dans l'axe de tir de ${v.displayName} !`;
                }
            }
        }

        // If I (local user as sender) point at VESSEL
        if (!dangerFound && isAngleActive && mode === 'sender') {
            const distToV = getDistance(currentPosRef.current!.lat, currentPosRef.current!.lng, v.location.latitude, v.location.longitude);
            if (distToV <= shootingDistance) {
                const bearingToV = getBearing(currentPosRef.current!.lat, currentPosRef.current!.lng, v.location.latitude, v.location.longitude);
                if (isWithinAngle(bearingToV, shootingAngle, shootingSpread)) {
                    dangerFound = true;
                    msg = `ATTENTION : ${v.displayName} est dans votre axe de tir !`;
                }
            }
        }
    });

    if (dangerFound && !isDangerActive) {
        const now = Date.now();
        if (now - lastAlertTimeRef.current > 5000) {
            playVesselSound('alerte');
            toast({ variant: 'destructive', title: "ALERTE COLLISION", description: msg });
            lastAlertTimeRef.current = now;
        }
    }
    setIsDangerActive(dangerFound);
    setDangerMessage(msg);
  }, [followedVessels, currentPos, isAngleActive, shootingAngle, shootingSpread, shootingDistance, mode, sharingId]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      const savedNickname = userProfile.vesselNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '';
      if (!vesselNickname) setVesselNickname(savedNickname);
      if (userProfile.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
    }
  }, [userProfile, user, customSharingId, vesselNickname]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo = {};
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        const effectiveHidePos = data.isPositionHidden !== undefined ? data.isPositionHidden : isPositionHidden;
        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            isPositionHidden: effectiveHidePos,
            lastActive: serverTimestamp(),
            accuracy: currentAccuracyRef.current,
            ...batteryInfo,
            ...data 
        };

        if (!effectiveHidePos && !updatePayload.location && currentPosRef.current) {
            updatePayload.location = { latitude: currentPosRef.current.lat, longitude: currentPosRef.current.lng };
        } else if (effectiveHidePos) {
            updatePayload.location = null;
        }

        const vesselRef = doc(firestore, 'vessels', sharingId);
        setDoc(vesselRef, updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname, isPositionHidden]);

  const handleSaveVessel = () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    const userRef = doc(firestore, 'users', user.uid);
    updateDoc(userRef, { savedVesselIds: cleanId ? arrayUnion(cleanId) : savedVesselIds, lastVesselId: cleanId || customSharingId })
      .then(() => { if (vesselIdToFollow) setVesselIdToFollow(''); toast({ title: "ID enregistré" }); });
  };

  const handleRemoveSavedVessel = (id: string) => {
    if (!user || !firestore) return;
    updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayRemove(id) }).then(() => toast({ title: "Navire retiré" }));
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    if (st === 'moving' || st === 'emergency') { immobilityStartTime.current = null; anchorPosRef.current = null; }
    toast({ title: label || (st === 'emergency' ? 'ALERTE ASSISTANCE' : 'Statut mis à jour') });
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setIsReceiverGpsActive(false);
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, { isSharing: false, lastActive: serverTimestamp(), shootingAngle: null }, { merge: true })
      .then(() => {
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setCurrentPos(null); currentPosRef.current = null; anchorPosRef.current = null; lastSentStatusRef.current = null; isFirstFixRef.current = true;
        toast({ title: "Partage arrêté" });
      });
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (!firestore || !user || !isSharing) return;
    updateDoc(doc(firestore, 'vessels', sharingId), { historyClearedAt: serverTimestamp(), huntingMarkers: [] }).then(() => toast({ title: "Journal réinitialisé" }));
  };

  const saveVesselPrefs = (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  useEffect(() => {
    if (!followedVessels) return;
    const newEntries: any[] = [];
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const timeKey = vessel.statusChangedAt?.toMillis ? vessel.statusChangedAt.toMillis() : (vessel.statusChangedAt?.seconds ? vessel.statusChangedAt.seconds * 1000 : 0);
        if (timeKey === 0) return;
        const lastStatus = lastStatusesRef.current[vessel.id];
        if (lastStatus !== currentStatus || timeKey > (lastUpdatesRef.current[vessel.id] || 0)) {
            const pos = vessel.isPositionHidden ? null : { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
            newEntries.push({ vesselName: vessel.displayName || vessel.id, statusLabel: vessel.eventLabel || currentStatus.toUpperCase(), time: new Date(), pos, batteryLevel: vessel.batteryLevel, isCharging: vessel.isCharging, accuracy: vessel.accuracy });
            if (mode === 'receiver' && lastStatus && lastStatus !== currentStatus && vesselPrefs.isNotifyEnabled) {
                const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : currentStatus;
                if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar');
            }
            lastStatusesRef.current[vessel.id] = currentStatus;
            lastUpdatesRef.current[vessel.id] = timeKey;
        }
    });
    if (newEntries.length > 0) setHistory(prev => [...newEntries, ...prev].slice(0, 50));
  }, [followedVessels, mode, vesselPrefs, playVesselSound]);

  useEffect(() => {
    const shouldRunGps = (mode === 'sender' && isSharing) || (mode === 'receiver' && isReceiverGpsActive);
    if (!shouldRunGps || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos); currentPosRef.current = newPos; currentAccuracyRef.current = Math.round(position.coords.accuracy);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        if (mode === 'sender') {
            if (isFirstFixRef.current) { anchorPosRef.current = newPos; updateVesselInFirestore({ status: 'moving', isSharing: true }); immobilityStartTime.current = Date.now(); isFirstFixRef.current = false; return; }
            if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
                const dist = getDistance(newPos.lat, newPos.lng, anchorPosRef.current!.lat, anchorPosRef.current!.lng);
                if (dist > IMMOBILITY_THRESHOLD_METERS) { setVesselStatus('moving'); anchorPosRef.current = newPos; immobilityStartTime.current = null; updateVesselInFirestore({ status: 'moving' }); }
                else if (Date.now() - (immobilityStartTime.current || 0) > 30000 && vesselStatus !== 'stationary') { setVesselStatus('stationary'); updateVesselInFirestore({ status: 'stationary' }); }
                else updateVesselInFirestore({});
            } else updateVesselInFirestore({});
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, isReceiverGpsActive, mode, updateVesselInFirestore, map, toast, vesselStatus]);

  const handleRecenter = () => {
    let pos = currentPosRef.current;
    if (!pos) { const activeVessel = followedVessels?.find(v => v.isSharing && !v.isPositionHidden); if (activeVessel?.location) pos = { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude }; }
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; if (mode === 'receiver') setIsReceiverGpsActive(true); }
  };

  const sendEmergencySms = (type: string) => {
    const pos = currentPosRef.current || (followedVessels?.find(v => v.isSharing && !v.isPositionHidden)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location!.latitude, lng: followedVessels.find(v => v.isSharing)!.location!.longitude } : null);
    if (!pos) { toast({ variant: "destructive", title: "GPS non verrouillé" }); return; }
    const posUrl = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const body = `${vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : ""}${isCustomMessageEnabled ? vesselSmsMessage : "Assistance requise."} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  if (loadError) return <div className="p-4 text-destructive">Erreur Google Maps.</div>;
  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

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
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2", vesselStatus === 'emergency' ? "bg-red-600 animate-pulse" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300" /> Partage actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1">{vesselNickname || 'Capitaine'}</p>
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <div className="flex items-center justify-between p-3 bg-background rounded-xl border">
                            <Label className="text-xs font-black uppercase flex items-center gap-2">{isPositionHidden ? <EyeOff className="size-4 text-orange-600" /> : <Eye className="size-4 text-primary" />} Mode Fantôme</Label>
                            <Switch checked={isPositionHidden} onCheckedChange={setIsPositionHidden} />
                        </div>
                        <Button variant="destructive" className="w-full h-14 font-black uppercase text-[10px] border-2 border-red-400 gap-3" onClick={() => handleManualStatus('emergency')} disabled={vesselStatus === 'emergency'}>DEMANDE ASSISTANCE</Button>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-12 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('returning')}><Navigation className="size-4 text-blue-600" /> Retour</Button>
                            <Button variant="outline" className="h-12 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('landed')}><Home className="size-4 text-green-600" /> À terre</Button>
                        </div>
                    </div>

                    <Card className="border-2 border-dashed border-primary/20 bg-primary/5 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2 text-primary"><ShieldAlert className="size-3" /> Angle de Tir / Sécurité</h4>
                            <Switch checked={isAngleActive} onCheckedChange={setIsAngleActive} />
                        </div>
                        <div className={cn("space-y-4", !isAngleActive && "opacity-40 pointer-events-none")}>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase opacity-60">Direction: {shootingAngle}°</Label>
                                <Slider value={[shootingAngle]} min={-180} max={180} step={1} onValueChange={v => setShootingAngle(v[0])} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase opacity-60">Ouverture: {shootingSpread}°</Label>
                                <Slider value={[shootingSpread]} min={10} max={360} step={1} onValueChange={v => setShootingSpread(v[0])} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase opacity-60 flex justify-between"><span>Portée: {shootingDistance}m</span><Ruler className="size-3" /></Label>
                                <Slider value={[shootingDistance]} min={50} max={2000} step={50} onValueChange={v => setShootingDistance(v[0])} />
                            </div>
                        </div>
                    </Card>

                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl" onClick={handleStopSharing}>ARRÊTER LE PARTAGE</Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="p-4 border-2 rounded-2xl bg-primary/5 border-primary/10 space-y-3">
                        <Label className="text-sm font-black uppercase">ID du navire</Label>
                        <div className="flex gap-2">
                            <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest bg-white" />
                            <Button variant="outline" size="icon" className="h-12 w-12 border-2 bg-white" onClick={handleSaveVessel}><Save className="size-4 text-primary" /></Button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <Label className="text-sm font-black uppercase">Partager ma position</Label>
                        <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                    </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase bg-white" /><Button variant="default" className="h-12 px-4 font-black uppercase text-[10px]" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button></div></div>
              <div className="grid gap-2">
                  {savedVesselIds.map(id => {
                      const vessel = followedVessels?.find(v => v.id === id);
                      const isActive = vessel?.isSharing === true;
                      return (
                          <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl transition-all shadow-sm cursor-pointer", vessel?.status === 'emergency' ? "bg-red-50 border-red-500 animate-pulse" : isActive ? "bg-primary/5 border-primary/20" : "bg-muted/5 opacity-60")} onClick={() => { if (isActive && vessel?.location && map) { map.panTo({ lat: vessel.location.latitude, lng: vessel.location.longitude }); map.setZoom(15); } }}>
                              <div className="flex items-center gap-3">
                                  <div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}</div>
                                  <div className="flex flex-col"><span className="font-black text-xs uppercase">{vessel?.displayName || id}</span><span className="text-[8px] font-bold uppercase">{isActive ? 'En ligne' : 'OFF'}</span></div>
                              </div>
                              <div className="flex items-center gap-2">{isActive && <BatteryIconComp level={vessel?.batteryLevel} charging={vessel?.isCharging} />}<Button variant="ghost" size="icon" onClick={() => handleRemoveSavedVessel(id)} className="size-8 text-destructive/40 border-2"><Trash2 className="size-3" /></Button></div>
                          </div>
                      );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} onZoomChanged={() => map && setMapZoom(map.getZoom() || 10)} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.map(vessel => vessel.isSharing && vessel.location && (
                    <React.Fragment key={`vessel-render-${vessel.id}`}>
                        {vessel.shootingAngle?.isActive && (
                            <OverlayView position={{ lat: vessel.location.latitude, lng: vessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <ShootingAngleWedge angle={vessel.shootingAngle.center} spread={vessel.shootingAngle.spread} distance={vessel.shootingAngle.distance} color="#38bdf8" zoom={mapZoom} lat={vessel.location.latitude} />
                            </OverlayView>
                        )}
                        <OverlayView position={{ lat: vessel.location.latitude, lng: vessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className="px-2 py-1 rounded text-[10px] font-black bg-slate-900/90 text-white shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2">
                                  <span>{vessel.displayName || vessel.id}</span>
                                  <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                                </div>
                                <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", vessel.status === 'moving' ? "bg-blue-600" : vessel.status === 'emergency' ? "bg-red-600 animate-pulse" : "bg-amber-600")}><Navigation className="size-5 text-white" /></div>
                            </div>
                        </OverlayView>
                    </React.Fragment>
                ))}
                {(currentPos || (mode === 'sender' && isSharing)) && (
                    <OverlayView position={currentPos || INITIAL_CENTER} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div className="relative">
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" />
                            {isAngleActive && mode === 'sender' && currentPos && <ShootingAngleWedge angle={shootingAngle} spread={shootingSpread} distance={shootingDistance} color="#38bdf8" zoom={mapZoom} lat={currentPos.lat} />}
                        </div>
                    </OverlayView>
                )}
          </GoogleMap>
          {isDangerActive && <div className="absolute inset-0 border-[10px] border-red-600 animate-pulse pointer-events-none z-30" />}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            {isDangerActive && <div className="p-3 bg-red-600 text-white rounded-xl text-center font-black uppercase text-xs animate-bounce shadow-lg">⚠️ {dangerMessage} ⚠️</div>}
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg text-xs" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5 mr-2" /> MAYDAY</Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg text-xs border-2" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 mr-2 text-primary" /> PAN PAN</Button>
            </div>
            <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/10">
                <AccordionItem value="history" className="border-none">
                    <div className="flex items-center justify-between px-3 h-12">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><History className="size-3 mr-2"/> Journal de bord</AccordionTrigger>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHistory}><Trash2 className="size-3 mr-1" /> Reset</Button>
                    </div>
                    <AccordionContent className="space-y-2 pt-2 pb-4 px-3 overflow-y-auto max-h-64 scrollbar-hide">
                        {history.length > 0 ? history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 shadow-sm animate-in fade-in">
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-black text-primary uppercase text-[10px]">{h.vesselName} - {h.statusLabel}</span>
                                    <span className="text-[8px] font-bold opacity-40 uppercase">{format(h.time, 'HH:mm:ss')} {h.accuracy ? `• +/-${h.accuracy}m` : ''}</span>
                                </div>
                                {h.pos && <Button variant="outline" size="sm" className="h-8 text-[9px] font-black border-2" onClick={() => { map?.panTo(h.pos!); map?.setZoom(17); }}><MapPin className="size-3 text-primary" /> GPS</Button>}
                            </div>
                        )) : <div className="text-center py-10 opacity-40 uppercase text-[10px] font-black">Journal vide</div>}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </Card>
    </div>
  );
}
