
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
  Sparkles
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
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const isFirstFixRef = useRef<boolean>(true);

  // Minuteur de décompte (30s)
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    vesselStatusRef.current = vesselStatus;
  }, [vesselStatus]);

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

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || EMPTY_IDS;
  
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

        if (data.status || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
        }

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
    if (label === 'ERREUR - REPRISE MODE AUTO') {
        isFirstFixRef.current = true;
        setVesselStatus('moving');
        updateVesselInFirestore({ status: 'moving', eventLabel: label });
    } else {
        setVesselStatus(st);
        updateVesselInFirestore({ status: st, eventLabel: label || null });
    }
    
    if (st === 'moving' || st === 'emergency') { 
        immobilityStartTime.current = Date.now(); 
        anchorPosRef.current = currentPosRef.current; 
        setCountdown(30);
    } else if (st === 'stationary') {
        if (currentPosRef.current) anchorPosRef.current = currentPosRef.current;
        setCountdown(null);
    }
    toast({ title: label || (st === 'emergency' ? 'ALERTE ASSISTANCE' : 'Statut mis à jour') });
  };

  const handleSignalBirds = () => {
    if (!currentPosRef.current || !firestore) return;
    const marker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPosRef.current.lat,
        lng: currentPosRef.current.lng,
        time: new Date().toISOString()
    };
    updateVesselInFirestore({ 
        huntingMarkers: arrayUnion(marker),
        eventLabel: 'REGROUPEMENT D\'OISEAUX (CHASSE)' 
    });
    playVesselSound('birds');
    toast({ title: "SIGNAL OISEAUX ENVOYÉ" });
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setIsReceiverGpsActive(false);
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, { isSharing: false, lastActive: serverTimestamp(), statusChangedAt: serverTimestamp() }, { merge: true })
      .then(() => {
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setCurrentPos(null); currentPosRef.current = null; anchorPosRef.current = null; lastSentStatusRef.current = null; isFirstFixRef.current = true; immobilityStartTime.current = null;
        setCountdown(null);
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

  const handleSaveSmsSettings = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            emergencyContact: emergencyContact,
            vesselSmsMessage: vesselSmsMessage,
            isEmergencyEnabled: isEmergencyEnabled,
            isCustomMessageEnabled: isCustomMessageEnabled
        });
        toast({ title: "Paramètres SMS sauvegardés" });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Erreur sauvegarde SMS" });
    }
  };

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    return `${nicknamePrefix}${customText} [MAYDAY/PAN PAN] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname]);

  const labels = useMemo(() => ({
    title: "Vessel Tracker",
    status1: "Au Mouillage",
    status2: "En Dérive",
    alertBtn: "DEMANDE ASSISTANCE",
    alertTitle: "URGENCE !",
    alertDesc: "Demande assistance !",
  }), []);

  // --- LOGIQUE DE SURVEILLANCE ACTIVE DES 30 SECONDES ---
  useEffect(() => {
    if (mode !== 'sender' || !isSharing || vesselStatus !== 'moving') {
        setCountdown(null);
        return;
    }

    const interval = setInterval(() => {
      // Si on n'a pas encore démarré le chrono, on ne fait rien
      if (!immobilityStartTime.current) return;

      const timeSinceStart = Date.now() - (immobilityStartTime.current || 0);
      const remaining = Math.max(0, Math.ceil((30000 - timeSinceStart) / 1000));
      
      setCountdown(remaining);
      
      // Si on a atteint 30s et qu'on est toujours en mode "moving"
      if (timeSinceStart >= 30000) {
        if (currentPosRef.current && anchorPosRef.current) {
          const distFromAnchor = getDistance(currentPosRef.current.lat, currentPosRef.current.lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
          
          if (distFromAnchor <= IMMOBILITY_THRESHOLD_METERS) {
            // IMMOBILE -> PASSAGE AU MOUILLAGE
            handleManualStatus('stationary', 'AU MOUILLAGE (DÉTECTION AUTO)');
          } else {
            // EN MOUVEMENT -> CONFIRMATION MOUVEMENT
            handleManualStatus('moving', 'EN MOUVEMENT (DÉTECTION AUTO)');
            anchorPosRef.current = currentPosRef.current;
            immobilityStartTime.current = Date.now();
          }
        } else if (anchorPosRef.current) {
            handleManualStatus('stationary', 'AU MOUILLAGE (DÉTECTION AUTO)');
        }
        setCountdown(null);
      }
    }, 1000); 

    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus]);

  useEffect(() => {
    if (!followedVessels) return;
    const newEntries: any[] = [];
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const timeKey = vessel.statusChangedAt?.toMillis ? vessel.statusChangedAt.toMillis() : (vessel.statusChangedAt?.seconds ? vessel.statusChangedAt.seconds * 1000 : 0);
        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;

        if (lastStatus !== currentStatus || timeKey > lastUpdate) {
            const pos = vessel.isPositionHidden ? null : { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
            
            const statusLabels: Record<string, string> = { 
                moving: 'EN MOUVEMENT', 
                stationary: 'AU MOUILLAGE', 
                offline: 'SIGNAL PERDU',
                returning: 'RETOUR MAISON',
                landed: 'À TERRE (HOME)',
                emergency: 'URGENCE - ASSISTANCE'
            };

            const label = vessel.eventLabel || statusLabels[currentStatus] || currentStatus.toUpperCase();
            
            newEntries.push({ 
                vesselName: vessel.displayName || vessel.id, 
                statusLabel: label, 
                time: new Date(), 
                pos, 
                batteryLevel: vessel.batteryLevel, 
                isCharging: vessel.isCharging, 
                accuracy: vessel.accuracy 
            });

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
            if (isFirstFixRef.current) { 
                anchorPosRef.current = newPos; 
                if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
                isFirstFixRef.current = false; 
                updateVesselInFirestore({ 
                    status: 'moving', 
                    isSharing: true, 
                    eventLabel: 'LANCEMENT EN COURS' 
                });
                return; 
            }
            
            const distFromAnchor = getDistance(newPos.lat, newPos.lng, anchorPosRef.current!.lat, anchorPosRef.current!.lng);
            
            if (distFromAnchor > IMMOBILITY_THRESHOLD_METERS) {
                const currentVesselStatus = vesselStatusRef.current;
                if (currentVesselStatus !== 'returning' && currentVesselStatus !== 'landed' && currentVesselStatus !== 'emergency') {
                    if (currentVesselStatus !== 'moving') {
                        setVesselStatus('moving');
                        updateVesselInFirestore({ status: 'moving' });
                    }
                }
                anchorPosRef.current = newPos;
                immobilityStartTime.current = Date.now();
            }
            
            updateVesselInFirestore({});
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, isReceiverGpsActive, mode, updateVesselInFirestore, map, toast]);

  const handleRecenter = () => {
    let pos = currentPosRef.current;
    if (!pos) { 
        const activeVessel = followedVessels?.find(v => v.isSharing && !v.isPositionHidden); 
        if (activeVessel && activeVessel.location) {
            pos = { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude };
        }
    }
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; if (mode === 'receiver') setIsReceiverGpsActive(true); }
  };

  const sendEmergencySms = (type: string) => {
    const activeVessel = followedVessels?.find(v => v.isSharing && !v.isPositionHidden);
    const pos = currentPosRef.current || (activeVessel?.location ? { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude } : null);
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
                        <div className="text-white relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300" /> Partage en cours</p>
                            <h3 className="text-4xl font-black uppercase tracking-tighter">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>

                        {/* COMPTE À REBOURS DE QUALIFICATION */}
                        {countdown !== null && countdown > 0 && (
                            <div className="mt-6 p-4 bg-white/10 rounded-3xl border-2 border-white/20 flex flex-col items-center justify-center relative z-10 animate-in zoom-in-95">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1 flex items-center gap-2">
                                    <RefreshCw className="size-3 animate-spin" /> Analyse du statut...
                                </p>
                                <p className="text-7xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.9)] leading-none my-2 font-mono">
                                    {countdown}
                                </p>
                                <div className="flex gap-1.5 mt-1">
                                    <div className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <div className="size-1.5 rounded-full bg-red-500 animate-pulse delay-150" />
                                    <div className="size-1.5 rounded-full bg-red-500 animate-pulse delay-300" />
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex items-center gap-2 relative z-10">
                            <Badge className="bg-white/20 border-white/30 text-white font-black uppercase text-[9px] h-6 px-3">ALERTE ACTIVE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1.5"><ShieldAlert className="size-3" /> ASSISTANCE</span>
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2"><Zap className="size-3" /> Signalisation manuelle</p>
                        
                        <Button variant="destructive" className="w-full h-14 font-black uppercase text-[10px] border-2 border-red-400 bg-red-500/20 text-red-700 gap-3 shadow-sm hover:bg-red-500/30 transition-all" onClick={() => handleManualStatus('emergency')} disabled={vesselStatus === 'emergency'}>
                            <ShieldAlert className="size-5" /> DEMANDE ASSISTANCE (PROBLÈME)
                        </Button>

                        <Button 
                            className="w-full h-14 font-black uppercase text-[10px] border-2 border-blue-200 bg-blue-50 text-blue-700 gap-3 shadow-sm hover:bg-blue-100 transition-all" 
                            onClick={handleSignalBirds}
                        >
                            <Bird className="size-5" /> REGROUPEMENT D'OISEAUX (CHASSE)
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('returning')}>
                                <Ship className="size-4 text-indigo-600" /> Retour Maison
                            </Button>
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('landed')}>
                                <Home className="size-4 text-green-600" /> Home (À terre)
                            </Button>
                        </div>
                        
                        <Button 
                            variant="ghost" 
                            className="w-full h-12 font-black uppercase text-[9px] border-2 border-dashed gap-2 text-orange-600 bg-white/50" 
                            onClick={() => handleManualStatus('moving', 'ERREUR - REPRISE MODE AUTO')}
                        >
                            <RefreshCw className="size-4" /> ERREUR / REPRISE MODE NORMAL (AUTO)
                        </Button>
                    </div>

                    <Button variant="secondary" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 bg-primary text-white border-2 border-white/20" onClick={handleStopSharing}>
                        <X className="size-5" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <Label className="text-sm font-black uppercase">Partager ma position</Label>
                        <Switch checked={isSharing} onCheckedChange={(val) => {
                            if (val) {
                                setIsSharing(true);
                                immobilityStartTime.current = Date.now(); // Start countdown timer immediately
                            } else {
                                handleStopSharing();
                            }
                        }} />
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sender-prefs" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl">
                                <Settings className="size-4 text-primary" />
                                <span className="text-[10px] font-black uppercase">Identité & Surnom</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du navire (Partage)</Label>
                                    <div className="flex gap-2">
                                        <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow" />
                                        <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVessel}>
                                            <Save className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label>
                                    <Input 
                                        placeholder="EX: CAPITAINE NEMO" 
                                        value={vesselNickname} 
                                        onChange={e => setVesselNickname(e.target.value)} 
                                        className="font-bold text-center h-12 border-2 uppercase flex-grow w-full" 
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="sms-settings" className="border-none mt-2">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 border-2 border-orange-100/50 rounded-xl">
                                <Smartphone className="size-4 text-orange-600" />
                                <span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-6">
                                <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                                    <div className="flex items-center justify-between border-b border-dashed pb-3 mb-2">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-black uppercase text-orange-800">Service d'Urgence</Label>
                                            <p className="text-[9px] font-bold text-orange-600/60 uppercase">Activer/Désactiver le contact SMS</p>
                                        </div>
                                        <Switch 
                                            checked={isEmergencyEnabled} 
                                            onCheckedChange={setIsEmergencyEnabled} 
                                        />
                                    </div>

                                    <div className={cn("space-y-4 transition-opacity", !isEmergencyEnabled && "opacity-40 pointer-events-none")}>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Numéro d'urgence (Contact à terre)</Label>
                                            <Input 
                                                placeholder="Ex: +687 75 27 97" 
                                                value={emergencyContact} 
                                                onChange={e => setEmergencyContact(e.target.value)} 
                                                className="h-12 border-2 font-black text-lg" 
                                                disabled={!isEmergencyEnabled}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Message de détresse personnalisé</Label>
                                                <Switch 
                                                    checked={isCustomMessageEnabled} 
                                                    onCheckedChange={setIsCustomMessageEnabled} 
                                                    className="scale-75"
                                                    disabled={!isEmergencyEnabled}
                                                />
                                            </div>
                                            <Textarea 
                                                placeholder="Ex: SOS j'ai un souci avec le bateau contact immédiatement les secours en mer pour me porter secours. voici mes coordonnées GPS" 
                                                value={vesselSmsMessage} 
                                                onChange={e => setVesselSmsMessage(e.target.value)} 
                                                className={cn("border-2 font-medium min-h-[80px]", !isCustomMessageEnabled && "opacity-50")}
                                                disabled={!isEmergencyEnabled || !isCustomMessageEnabled}
                                            />
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-dashed">
                                            <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1">
                                                <Eye className="size-3" /> Visualisation du SMS envoyé :
                                            </p>
                                            <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] font-medium leading-relaxed text-slate-600">
                                                "{smsPreview}"
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] tracking-widest gap-2 shadow-md">
                                        <Save className="size-4" /> Enregistrer mes réglages SMS
                                    </Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow bg-white" /><Button variant="default" className="h-12 px-4 font-black uppercase text-[10px]" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button></div></div>
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
                              <div className="flex items-center gap-2">{isActive && <BatteryIconComp level={vessel?.batteryLevel} charging={vessel?.isCharging} />}<Button variant="ghost" size="icon" className="size-8 text-destructive/40 border-2" onClick={(e) => { e.stopPropagation(); handleRemoveSavedVessel(id); }}><Trash2 className="size-3" /></Button></div>
                          </div>
                      );
                  })}
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="receiver-settings" className="border-none">
                  <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl">
                    <Settings className="size-4 text-primary" />
                    <span className="text-[10px] font-black uppercase">Réglages Notifications & Veille</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-6">
                    <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-black uppercase text-primary">Alertes Sonores</Label>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux audio</p>
                            </div>
                            <Switch 
                                checked={vesselPrefs.isNotifyEnabled} 
                                onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} 
                            />
                        </div>

                        <div className={cn("space-y-6 transition-opacity", !vesselPrefs.isNotifyEnabled && "opacity-40 pointer-events-none")}>
                            <div className="space-y-3 pt-2 border-t border-dashed">
                                <div className="flex items-center gap-2">
                                    <Volume2 className="size-3 text-muted-foreground" />
                                    <Label className="text-[10px] font-black uppercase opacity-60">Volume des alertes</Label>
                                </div>
                                <Slider 
                                    value={[vesselPrefs.vesselVolume * 100]} 
                                    max={100} step={1} 
                                    onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} 
                                />
                            </div>

                            <div className="space-y-4 pt-2 border-t border-dashed">
                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Sons par événement</p>
                                <div className="grid gap-4">
                                    {[
                                        { key: 'moving', label: 'Mouvement' },
                                        { key: 'stationary', label: 'Mouillage' },
                                        { key: 'offline', label: 'Signal Perdu' },
                                        { key: 'emergency', label: 'Assistance (Urgence)' },
                                        { key: 'birds', label: 'Oiseaux (Chasse)' }
                                    ].map(item => (
                                        <div key={item.key} className="flex flex-col gap-2 p-2 bg-muted/10 rounded-xl">
                                            <div className="flex items-center justify-between px-1">
                                                <div className="flex items-center gap-2">
                                                    <Switch 
                                                        checked={vesselPrefs.notifySettings[item.key as keyof typeof vesselPrefs.notifySettings]} 
                                                        onCheckedChange={v => saveVesselPrefs({ 
                                                            ...vesselPrefs, 
                                                            notifySettings: { ...vesselPrefs.notifySettings, [item.key]: v } 
                                                        })}
                                                        className="scale-75"
                                                    />
                                                    <span className="text-[10px] font-black uppercase">{item.label}</span>
                                                    <span className="text-[8px] font-bold opacity-40 uppercase ml-1">Actif</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Select 
                                                    value={vesselPrefs.notifySounds[item.key as keyof typeof vesselPrefs.notifySounds]} 
                                                    onValueChange={v => saveVesselPrefs({ 
                                                        ...vesselPrefs, 
                                                        notifySounds: { ...vesselPrefs.notifySounds, [item.key]: v } 
                                                    })}
                                                >
                                                    <SelectTrigger className="h-9 text-[9px] font-black uppercase bg-white border-2">
                                                        <SelectValue placeholder="Choisir un son..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 border-2 shrink-0 bg-white" onClick={() => playVesselSound(vesselPrefs.notifySounds[item.key as keyof typeof vesselPrefs.notifySounds])}>
                                                    <Play className="size-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-black uppercase text-orange-800">Veille Stratégique</Label>
                                <p className="text-[9px] font-bold text-orange-600/60 uppercase">Alarme si immobile trop longtemps</p>
                            </div>
                            <Switch 
                                checked={vesselPrefs.isWatchEnabled} 
                                onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isWatchEnabled: v })} 
                            />
                        </div>
                        
                        <div className={cn("space-y-6 transition-opacity", !vesselPrefs.isWatchEnabled && "opacity-40 pointer-events-none")}>
                            <div className="space-y-4 pt-2 border-t border-dashed border-orange-200">
                                <div className="flex justify-between items-center px-1">
                                    <Label className="text-[10px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label>
                                    <Badge variant="outline" className="font-black bg-white border-orange-200 text-orange-800 h-6">
                                        {vesselPrefs.watchDuration >= 60 ? `${Math.floor(vesselPrefs.watchDuration / 60)}h` : `${vesselPrefs.watchDuration} min`}
                                    </Badge>
                                </div>
                                <Slider 
                                    value={[vesselPrefs.watchDuration || 60]} 
                                    min={60} 
                                    max={1440} 
                                    step={60}
                                    onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} 
                                />
                                <div className="flex justify-between text-[8px] font-black uppercase text-orange-800/40 px-1">
                                    <span>1h</span>
                                    <span>24h</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-orange-800/60 ml-1">Son de l'alarme</Label>
                                <div className="flex gap-2">
                                    <Select 
                                        value={vesselPrefs.watchSound} 
                                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchSound: v })}
                                    >
                                        <SelectTrigger className="h-9 text-[9px] font-black uppercase bg-white border-2 border-orange-100">
                                            <SelectValue placeholder="Choisir..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 border-2 border-orange-100 shrink-0 bg-white text-orange-600" onClick={() => playVesselSound(vesselPrefs.watchSound)}>
                                        <Play className="size-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 p-4 border-2 rounded-2xl bg-red-50/30 border-red-100">
                        <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-black uppercase text-red-800">Seuil Batterie Faible</Label>
                                <Badge variant="outline" className="font-black bg-white border-red-200 text-red-800 h-6">
                                    {vesselPrefs.batteryThreshold || 20}%
                                </Badge>
                            </div>
                            <p className="text-[9px] font-bold text-red-600/60 uppercase">Alerte niveau bas batterie smartphone</p>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-4 pt-2 border-t border-dashed border-red-200">
                                <Slider 
                                    value={[vesselPrefs.batteryThreshold || 20]} 
                                    min={5} max={50} step={5}
                                    onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batteryThreshold: v[0] })} 
                                />
                                <div className="flex justify-between text-[8px] font-black uppercase text-red-800/40 px-1">
                                    <span>5%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-red-800/60 ml-1">Son de l'alerte</Label>
                                <div className="flex gap-2">
                                    <Select 
                                        value={vesselPrefs.batterySound} 
                                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batterySound: v })}
                                    >
                                        <SelectTrigger className="h-9 text-[9px] font-black uppercase bg-white border-2 border-red-100">
                                            <SelectValue placeholder="Choisir..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 border-2 border-red-100 shrink-0 bg-white text-orange-600" onClick={() => playVesselSound(vesselPrefs.batterySound)}>
                                        <Play className="size-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.map(vessel => vessel.isSharing && vessel.location && (
                    <OverlayView key={`vessel-render-${vessel.id}`} position={{ lat: vessel.location.latitude, lng: vessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                            <div className={cn("px-2 py-1 rounded text-[10px] font-black text-white shadow-lg border whitespace-nowrap flex items-center gap-2", 
                                vessel.status === 'emergency' ? "bg-red-600 border-red-400" : 
                                vessel.status === 'landed' ? "bg-green-600 border-green-400" :
                                vessel.status === 'stationary' ? "bg-amber-600 border-amber-400" :
                                vessel.status === 'returning' ? "bg-indigo-600 border-indigo-400" :
                                "bg-slate-900/90 border-white/20")}>
                              <span>{vessel.displayName || vessel.id}</span>
                              <span className={cn(
                                "text-[8px] font-black border-l pl-2 border-white/20",
                                vessel.status === 'emergency' ? "text-red-200" : 
                                vessel.status === 'landed' ? "text-green-200" :
                                vessel.status === 'stationary' ? "text-amber-200" :
                                vessel.status === 'returning' ? "text-indigo-200" :
                                "text-blue-200"
                              )}>
                                {vessel.status === 'emergency' ? 'SOS' : 
                                 vessel.status === 'moving' ? 'MOUV' : 
                                 vessel.status === 'stationary' ? 'MOUIL' : 
                                 vessel.status === 'returning' ? 'RETOUR' : 
                                 vessel.status === 'landed' ? 'HOME' : 'OFF'}
                              </span>
                              <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                            </div>
                            <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                                vessel.status === 'moving' ? "bg-blue-600" : 
                                vessel.status === 'emergency' ? "bg-red-600 animate-pulse" : 
                                vessel.status === 'stationary' ? "bg-amber-600" :
                                vessel.status === 'returning' ? "bg-indigo-600" :
                                vessel.status === 'landed' ? "bg-green-600" : "bg-slate-600")}>
                                {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : 
                                 vessel.status === 'returning' ? <Ship className="size-5 text-white" /> : 
                                 vessel.status === 'landed' ? <Home className="size-5 text-white" /> : 
                                 vessel.status === 'emergency' ? <ShieldAlert className="size-5 text-white" /> :
                                 <Navigation className="size-5 text-white" />}
                            </div>
                        </div>
                    </OverlayView>
                ))}
                {followedVessels?.flatMap(v => v.huntingMarkers || []).map(m => (
                    <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                            <div className="px-2 py-1 rounded bg-blue-600 text-white text-[8px] font-black shadow-lg uppercase whitespace-nowrap">{format(new Date(m.time), 'HH:mm:ss')}</div>
                            <div className="p-1.5 bg-white rounded-full border-2 border-blue-600 shadow-md text-blue-600"><Bird className="size-3" /></div>
                        </div>
                    </OverlayView>
                ))}
                {(currentPos || (mode === 'sender' && isSharing)) && (
                    <OverlayView position={currentPos || INITIAL_CENTER} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" />
                    </OverlayView>
                )}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5 text-primary" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg text-sm gap-2" onClick={() => sendEmergencySms('MAYDAY')}>
                    <ShieldAlert className="size-5" /> MAYDAY
                </Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg text-sm border-2 border-primary/20 gap-2 text-primary" onClick={() => sendEmergencySms('PAN PAN')}>
                    <AlertTriangle className="size-5" /> PAN PAN
                </Button>
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
                                    <span className={cn("font-black uppercase text-[10px]", 
                                        h.statusLabel.includes('URGENCE') ? 'text-red-600' :
                                        h.statusLabel.includes('MOUILLAGE') ? 'text-amber-600' :
                                        h.statusLabel.includes('RETOUR') ? 'text-indigo-600' :
                                        h.statusLabel.includes('TERRE') ? 'text-green-600' :
                                        h.statusLabel.includes('LANCEMENT') ? 'text-blue-400 animate-pulse' :
                                        'text-primary'
                                    )}>{h.vesselName} - {h.statusLabel}</span>
                                    <span className="text-[8px] font-bold opacity-40 uppercase">{format(h.time, 'HH:mm:ss')} {h.accuracy ? `• +/-${h.accuracy}m` : ''}</span>
                                </div>
                                {h.pos && <Button variant="outline" size="sm" className="h-8 text-[9px] font-black border-2" onClick={() => { if (h.pos && map) { map.panTo(h.pos); map.setZoom(17); } }}><MapPin className="size-3 text-primary" /> GPS</Button>}
                            </div>
                        )) : (
                            <div className="text-center py-10 opacity-40 uppercase text-[10px] font-black italic">
                                pas d'affichage dans l'historique
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </Card>
    </div>
  );
}
