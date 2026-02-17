
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteDoc, getDoc } from 'firebase/firestore';
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
  Home,
  RefreshCw,
  Settings,
  Smartphone,
  Phone,
  Waves,
  Eye,
  AlertCircle,
  Clock,
  EyeOff,
  Sparkles,
  Copy,
  Ruler,
  Bell,
  Repeat
} from 'lucide-react';
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

const statusLabels: Record<string, string> = { 
    moving: 'EN MOUVEMENT', 
    stationary: 'AU MOUILLAGE', 
    drifting: 'À LA DÉRIVE',
    offline: 'SIGNAL PERDU',
    returning: 'RETOUR MAISON',
    landed: 'À TERRE (HOME)',
    emergency: 'DEMANDE ASSISTANCE'
};

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

export default function VesselTrackerPage() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // --- ÉTATS DU COMPOSANT (Définis en haut pour éviter les ReferenceError) ---
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [fleetGroupId, setFleetGroupId] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  
  const [emergencyContact, setEmergencyContact] = useState('');
  const [receiverSmsContact, setReceiverSmsContact] = useState('');
  const [receiverCallContact, setReceiverCallContact] = useState('');
  const [targetVesselIdForAction, setTargetVesselIdForAction] = useState('');

  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [receiverSmsMessage, setReceiverSmsMessage] = useState('');
  
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [preManualStatus, setPreManualStatus] = useState<VesselStatus['status'] | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [secondsUntilUpdate, setSecondsUntilUpdate] = useState(60);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const shouldPanOnNextFix = useRef(false);
  const lastSentStatusRef = useRef<string | null>(null);

  // Alert Loop State
  const [activeLoopingAlert, setActiveLoopingAlert] = useState<{
    type: string;
    vesselName?: string;
    title: string;
    message: string;
    color: string;
    icon: any;
  } | null>(null);
  const loopingAudioRef = useRef<HTMLAudioElement | null>(null);

  const [vesselPrefs, setVesselPrefs] = useState<any>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, emergency: true, watch: true, battery: true },
    notifySounds: { moving: '', stationary: '', offline: '', emergency: '', watch: '', battery: '' },
    repeatSettings: { moving: false, stationary: false, offline: false, emergency: true, watch: true, battery: false },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20,
    mooringRadius: 20
  });
  
  const [history, setHistory] = useState<{ vesselId: string, vesselName: string, statusLabel: string, statusCategory: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean, durationMinutes?: number, accuracy?: number }[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastClearTimesRef = useRef<Record<string, number>>({});

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (mode === 'fleet' && fleetGroupId) {
        return query(collection(firestore, 'vessels'), where('groupId', '==', fleetGroupId.trim().toUpperCase()));
    }
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing, mode, fleetGroupId]);
  
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

  const stopLoopingAlert = () => {
    if (loopingAudioRef.current) {
        loopingAudioRef.current.pause();
        loopingAudioRef.current = null;
    }
    setActiveLoopingAlert(null);
  };

  const playVesselSound = useCallback((soundId: string, type?: string, vesselName?: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (!sound) return;

    if (type && vesselPrefs.repeatSettings?.[type]) {
        if (loopingAudioRef.current) loopingAudioRef.current.pause();
        const audio = new Audio(sound.url);
        audio.volume = vesselPrefs.vesselVolume;
        audio.loop = true;
        loopingAudioRef.current = audio;
        
        const alertConfigs: Record<string, any> = {
            moving: { title: 'MOUVEMENT DÉTECTÉ', message: 'Le navire fait route.', color: 'bg-blue-600', icon: Navigation },
            stationary: { title: 'MOUILLAGE DÉTECTÉ', message: 'Le navire est maintenant immobile.', color: 'bg-amber-600', icon: Anchor },
            offline: { title: 'SIGNAL PERDU', message: 'Le navire ne répond plus au réseau.', color: 'bg-red-600', icon: WifiOff },
            emergency: { title: 'URGENCE / MAYDAY', message: 'DEMANDE D\'ASSISTANCE IMMÉDIATE !', color: 'bg-red-700', icon: ShieldAlert },
            watch: { title: 'VEILLE STRATÉGIQUE', message: 'Le navire est immobile depuis trop longtemps.', color: 'bg-orange-600', icon: Clock },
            battery: { title: 'BATTERIE FAIBLE', message: 'Niveau de batterie critique détecté.', color: 'bg-red-500', icon: BatteryLow },
        };

        const config = alertConfigs[type] || { title: 'ALERTE NAVIRE', message: 'Événement détecté.', color: 'bg-slate-800', icon: Bell };
        setActiveLoopingAlert({ ...config, type, vesselName });
        audio.play().catch(() => {});
    } else {
        const audio = new Audio(sound.url);
        audio.volume = vesselPrefs.vesselVolume;
        audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, vesselPrefs.repeatSettings, availableSounds]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo = {};
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            lastActive: serverTimestamp(),
            mooringRadius: vesselPrefs.mooringRadius || 20,
            groupId: fleetGroupId ? fleetGroupId.toUpperCase() : null,
            isGhostMode: data.isGhostMode !== undefined ? data.isGhostMode : isGhostMode,
            accuracy: userAccuracy || null,
            ...batteryInfo,
            ...data 
        };

        if (data.status && data.status !== lastSentStatusRef.current) {
            updatePayload.statusChangedAt = serverTimestamp();
            lastSentStatusRef.current = data.status;
        }

        if (!updatePayload.location && currentPos) {
            updatePayload.location = { latitude: currentPos.lat, longitude: currentPos.lng };
        }

        const vesselRef = doc(firestore, 'vessels', sharingId);
        setDoc(vesselRef, updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname, currentPos, userAccuracy, vesselPrefs.mooringRadius, fleetGroupId, isGhostMode]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.receiverSmsContact) setReceiverSmsContact(userProfile.receiverSmsContact);
      if (userProfile.receiverCallContact) setReceiverCallContact(userProfile.receiverCallContact);
      if (userProfile.receiverSmsMessage) setReceiverSmsMessage(userProfile.receiverSmsMessage);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      setIsGhostMode(userProfile.isGhostMode ?? false);
      setVesselNickname(userProfile.vesselNickname || '');
      setCustomSharingId(userProfile.lastVesselId || '');
      if (userProfile.fleetGroupId) setFleetGroupId(userProfile.fleetGroupId);
    }
  }, [userProfile]);

  const handleSaveVessel = () => {
    if (!user || !firestore) return;
    const cleanId = customSharingId.trim().toUpperCase();
    const cleanGroupId = fleetGroupId.trim().toUpperCase();
    const idHist = userProfile?.vesselIdHistory || [];
    const newHist = [...new Set([cleanId, cleanGroupId, ...idHist])].filter(Boolean).slice(0, 10);
    
    updateDoc(doc(firestore, 'users', user.uid), { 
        lastVesselId: cleanId,
        fleetGroupId: cleanGroupId,
        vesselIdHistory: newHist,
        vesselPrefs: vesselPrefs,
        isGhostMode: isGhostMode,
        vesselNickname: vesselNickname,
        emergencyContact,
        receiverSmsContact,
        receiverCallContact,
        receiverSmsMessage,
        vesselSmsMessage,
        isEmergencyEnabled,
        isCustomMessageEnabled
    }).then(() => { 
        toast({ title: "Paramètres enregistrés" }); 
    });
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    lastSentStatusRef.current = null;
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, { isSharing: false, lastActive: serverTimestamp() }, { merge: true })
      .then(() => {
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setCurrentPos(null); setAnchorPos(null);
        toast({ title: "Partage arrêté" });
      });
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (isSharing && firestore && user) {
        updateDoc(doc(firestore, 'vessels', sharingId), { historyClearedAt: serverTimestamp() });
    }
    toast({ title: "Historique vidé" });
  };

  useEffect(() => {
    if (!followedVessels) return;
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const getTimeMillis = (t: any) => {
            if (!t) return 0;
            if (typeof t.toMillis === 'function') return t.toMillis();
            if (t.seconds) return t.seconds * 1000;
            return 0;
        };

        const timeKey = getTimeMillis(vessel.statusChangedAt || vessel.lastActive);
        const clearTimeKey = getTimeMillis(vessel.historyClearedAt);

        if (clearTimeKey > (lastClearTimesRef.current[vessel.id] || 0)) {
            setHistory(prev => prev.filter(h => h.vesselId !== vessel.id));
            lastClearTimesRef.current[vessel.id] = clearTimeKey;
        }

        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;

        const pos = { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
        const label = vessel.eventLabel || statusLabels[currentStatus] || currentStatus.toUpperCase();
        
        setHistory(prev => {
            const lastEntryIdx = prev.findIndex(h => h.vesselId === vessel.id);
            const lastEntry = lastEntryIdx !== -1 ? prev[lastEntryIdx] : null;

            if (lastEntry && lastEntry.statusCategory === currentStatus && !label.includes('ERREUR')) {
                const newHistory = [...prev];
                newHistory[lastEntryIdx] = {
                    ...lastEntry,
                    statusLabel: label + ` (MAJ ${format(new Date(), 'HH:mm')})`,
                    time: new Date(),
                    durationMinutes: differenceInMinutes(new Date(), new Date(timeKey))
                };
                return newHistory;
            }

            if (lastStatus !== currentStatus || timeKey > lastUpdate || label.includes('ERREUR')) {
                const newEntry = { 
                    vesselId: vessel.id,
                    vesselName: vessel.displayName || vessel.id, 
                    statusLabel: label, 
                    statusCategory: currentStatus,
                    time: new Date(), 
                    pos, 
                    batteryLevel: vessel.batteryLevel, 
                    isCharging: vessel.isCharging,
                    durationMinutes: differenceInMinutes(new Date(), new Date(timeKey))
                };
                return [newEntry, ...prev].slice(0, 50);
            }
            return prev;
        });

        lastStatusesRef.current[vessel.id] = currentStatus;
        lastUpdatesRef.current[vessel.id] = timeKey;
    });
  }, [followedVessels, mode, vesselPrefs, playVesselSound]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        setUserAccuracy(Math.round(position.coords.accuracy));
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        updateVesselInFirestore({});
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, updateVesselInFirestore, map, toast]);

  const handleManualToggle = (st: VesselStatus['status'], label: string) => {
    if (vesselStatus !== st) {
        setPreManualStatus(vesselStatus);
        setVesselStatus(st);
        updateVesselInFirestore({ status: st, eventLabel: label });
    } else {
        const revertTo = preManualStatus || 'moving';
        updateVesselInFirestore({ eventLabel: 'ERREUR INVOLONTAIRE' });
        setTimeout(() => {
            setVesselStatus(revertTo);
            updateVesselInFirestore({ status: revertTo, eventLabel: `${statusLabels[revertTo]} (REPRISE)` });
            setPreManualStatus(null);
        }, 500);
    }
  };

  const handleEmergencyToggle = () => {
    if (vesselStatus !== 'emergency') {
        setPreManualStatus(vesselStatus);
        setVesselStatus('emergency');
        updateVesselInFirestore({ status: 'emergency', eventLabel: 'DEMANDE ASSISTANCE (PROBLÈME)' });
        if (isGhostMode) setIsGhostMode(false);
    } else {
        const revertTo = preManualStatus || 'moving';
        updateVesselInFirestore({ eventLabel: 'ERREUR INVOLONTAIRE' });
        setTimeout(() => {
            setVesselStatus(revertTo);
            updateVesselInFirestore({ status: revertTo, eventLabel: `${statusLabels[revertTo]} (REPRISE)` });
            setPreManualStatus(null);
        }, 500);
    }
  };

  const handleRecenter = () => {
    if (currentPos && map) { map.panTo(currentPos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const handleForceGpsUpdate = () => {
    if (!isSharing || mode !== 'sender') return;
    setSecondsUntilUpdate(60);
    updateVesselInFirestore({ eventLabel: `${statusLabels[vesselStatus]} (MAJ FORCÉE)` });
    toast({ title: "Point GPS forcé" });
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
        setSecondsUntilUpdate(prev => {
            if (prev <= 1) {
                updateVesselInFirestore({ eventLabel: `${statusLabels[vesselStatus]} (MAJ ${format(new Date(), 'HH:mm')})` });
                return 60;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, updateVesselInFirestore]);

  if (isProfileLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {activeLoopingAlert && (
        <div className={cn("fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300", activeLoopingAlert.color)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <Card className="relative w-full max-w-md border-4 border-white shadow-2xl overflow-hidden rounded-[2.5rem]">
                <CardHeader className="text-center pt-10 relative z-10">
                    <div className="mx-auto size-20 rounded-full bg-white/20 flex items-center justify-center border-4 border-white mb-4 animate-pulse"><activeLoopingAlert.icon className="size-10 text-white" /></div>
                    <CardTitle className="text-2xl font-black uppercase text-white drop-shadow-md">{activeLoopingAlert.title}</CardTitle>
                    <CardDescription className="text-white/80 font-bold uppercase text-xs mt-2">Navire : {activeLoopingAlert.vesselName || 'Inconnu'}</CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-10 px-8 relative z-10">
                    <p className="text-white font-medium italic mb-8">"{activeLoopingAlert.message}"</p>
                    <Button onClick={stopLoopingAlert} className="w-full h-20 text-lg font-black uppercase tracking-widest bg-white text-slate-900 rounded-2xl gap-3"><Check className="size-8" /> COUPER L'ALARME</Button>
                </CardContent>
            </Card>
        </div>
      )}

      {isSharing && mode === 'sender' && (
          <button onClick={handleForceGpsUpdate} className="bg-primary text-white text-[10px] font-black uppercase py-1.5 px-4 rounded-full shadow-lg flex items-center gap-2 mx-auto w-fit border-2 border-white/20">
              <RefreshCw className={cn("size-3", secondsUntilUpdate < 5 && "animate-spin")} /> MAJ GPS DANS {secondsUntilUpdate}S
          </button>
      )}

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <button className={cn("flex-1 font-black uppercase text-[10px] h-12 rounded-lg transition-all", mode === 'sender' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")} onClick={() => setMode('sender')}>Émetteur (A)</button>
          <button className={cn("flex-1 font-black uppercase text-[10px] h-12 rounded-lg transition-all", mode === 'receiver' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")} onClick={() => setMode('receiver')}>Récepteur (B)</button>
          <button className={cn("flex-1 font-black uppercase text-[10px] h-12 rounded-lg transition-all", mode === 'fleet' ? "bg-white text-primary shadow-sm" : "text-muted-foreground")} onClick={() => setMode('fleet')}>Flotte (C)</button>
        </div>

        <CardContent className="p-4 space-y-4">
          {mode === 'sender' ? (
            <div className="space-y-6">
              {isSharing ? (
                <div className="space-y-4 animate-in fade-in">
                    <Button variant="destructive" className={cn("w-full h-14 font-black uppercase text-[11px] gap-3 shadow-lg border-2 border-white/20", vesselStatus === 'emergency' ? "bg-slate-800" : "bg-red-400")} onClick={handleEmergencyToggle}>
                        <AlertCircle className={cn("size-5", vesselStatus === 'emergency' && "animate-pulse")} /> 
                        {vesselStatus === 'emergency' ? "ANNULER L'ASSISTANCE (ERREUR)" : "DEMANDE ASSISTANCE (PROBLÈME)"}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant={vesselStatus === 'returning' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualToggle('returning', 'RETOUR MAISON')}>
                            <Navigation className="size-4 text-blue-600" /> Retour Maison
                        </Button>
                        <Button variant={vesselStatus === 'landed' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualToggle('landed', 'À TERRE (HOME)')}>
                            <Home className="size-4 text-green-600" /> Home (À terre)
                        </Button>
                    </div>
                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20" onClick={handleStopSharing}><X className="size-5" /> Arrêter le partage</Button>
                </div>
              ) : (
                <Button onClick={() => setIsSharing(true)} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base gap-3"><Zap className="size-6 fill-white" /> Lancer le Partage</Button>
              )}
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4" /><span className="text-[10px] font-black uppercase">Identité & IDs</span></AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">Surnom</Label><Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="h-12 border-2 font-black text-center uppercase" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID Navire (B)</Label><Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="h-12 border-2 font-black text-center uppercase" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID Groupe Flotte (C)</Label><Input value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="h-12 border-2 font-black text-center uppercase" /></div>
                            
                            <div className="space-y-3 pt-2">
                                <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between">Rayon de Mouillage <span>{vesselPrefs.mooringRadius}m</span></Label>
                                <Slider value={[vesselPrefs.mooringRadius]} min={10} max={200} step={5} onValueChange={v => setVesselPrefs({...vesselPrefs, mooringRadius: v[0]})} />
                            </div>

                            <Button onClick={handleSaveVessel} className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-base"><Save className="size-5 mr-2" /> Enregistrer mes Identifiants</Button>
                        </div>

                        {userProfile?.vesselIdHistory && userProfile.vesselIdHistory.length > 0 && (
                            <div className="space-y-2 border-t pt-4">
                                <p className="text-[9px] font-black uppercase opacity-40 ml-1">Historique des IDs</p>
                                <div className="flex flex-wrap gap-2">
                                    {userProfile.vesselIdHistory.map(id => (
                                        <div key={id} className="flex items-center bg-white border-2 rounded-lg pl-3 pr-1 py-1 gap-2 shadow-sm">
                                            <span className="text-[10px] font-black uppercase cursor-pointer" onClick={() => { setCustomSharingId(id); setFleetGroupId(id); }}>{id}</span>
                                            <Button variant="ghost" size="icon" className="size-6 text-destructive/40" onClick={() => updateDoc(doc(firestore!, 'users', user!.uid), { vesselIdHistory: arrayRemove(id) })}><X className="size-3" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : mode === 'receiver' ? (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase opacity-60">Suivre le navire ID</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase" />
                        <Button variant="default" className="h-12 px-4" onClick={handleSaveVessel}><Check className="size-4" /></Button>
                    </div>
                </div>
                
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="receiver-settings" className="border-none">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4" /><span className="text-[10px] font-black uppercase">Notifications & Veille</span></AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-6">
                            <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5"><Label className="text-xs font-black uppercase">Alertes Sonores</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux audio</p></div>
                                    <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({...vesselPrefs, isNotifyEnabled: v})} />
                                </div>
                                <div className="space-y-3 border-t border-dashed pt-4">
                                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Volume2 className="size-3" /> Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
                                    <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => saveVesselPrefs({...vesselPrefs, vesselVolume: v[0] / 100})} />
                                </div>
                            </div>

                            <div className="space-y-4 p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5"><Label className="text-xs font-black uppercase text-orange-800">Veille Stratégique</Label><p className="text-[9px] font-bold text-orange-600/60 uppercase">Alarme si immobile trop longtemps</p></div>
                                    <Switch checked={vesselPrefs.isWatchEnabled} onCheckedChange={v => saveVesselPrefs({...vesselPrefs, isWatchEnabled: v})} />
                                </div>
                                <div className="space-y-4 pt-2 border-t border-orange-100">
                                    <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label><Badge variant="outline" className="font-black bg-white">{vesselPrefs.watchDuration >= 60 ? `${Math.floor(vesselPrefs.watchDuration / 60)}h` : `${vesselPrefs.watchDuration} min`}</Badge></div>
                                    <Slider value={[vesselPrefs.watchDuration || 60]} min={60} max={1440} step={60} onValueChange={v => saveVesselPrefs({...vesselPrefs, watchDuration: v[0]})} />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase opacity-60">ID du groupe Flotte</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ LE CODE..." value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase" />
                        <Button variant="default" className="h-12 px-4" onClick={handleSaveVessel}><Check className="size-4" /></Button>
                    </div>
                </div>
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-muted/5">
                    <div className="space-y-0.5"><Label className="text-xs font-black uppercase">Mode Fantôme</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Devenir invisible pour le groupe</p></div>
                    <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[350px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.filter(v => v.isSharing).map(vessel => (
                    <OverlayView key={vessel.id} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                            <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg flex items-center gap-2">
                                <span className="truncate max-w-[80px]">{vessel.displayName || vessel.id}</span>
                                <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                            </div>
                            <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", vessel.status === 'moving' ? "bg-blue-600" : vessel.status === 'returning' ? "bg-indigo-600" : vessel.status === 'landed' ? "bg-green-600" : "bg-amber-600")}>
                                {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                            </div>
                        </div>
                    </OverlayView>
                ))}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="h-10 w-10 p-0"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="h-10 w-10" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history" className="border-none">
                    <div className="flex items-center justify-between px-3 h-12 bg-muted/10 rounded-xl">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">Journal de bord unifié</AccordionTrigger>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHistory}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                    </div>
                    <AccordionContent className="space-y-2 pt-4 px-1 max-h-64 overflow-y-auto">
                        {history.length > 0 ? history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] animate-in slide-in-from-left-2 shadow-sm">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-primary">{h.vesselName}</span>
                                        <span className={cn("font-black uppercase", h.statusLabel.includes('ERREUR') ? 'text-orange-600' : 'text-slate-800')}>{h.statusLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-40 font-bold">
                                        <span>{format(h.time, 'HH:mm:ss')}</span>
                                        {h.durationMinutes !== undefined && <span>• {h.durationMinutes} min</span>}
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="h-8 text-[9px] border-2 px-3" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}><MapPin className="size-3 mr-1" /> GPS</Button>
                            </div>
                        )) : <p className="text-center py-6 opacity-20 uppercase text-[9px] font-black italic">Aucun mouvement</p>}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </Card>

      <Card className="border-2 border-red-100 bg-red-50/10 shadow-none">
        <CardHeader className="p-4 pb-2 border-b border-red-100">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-red-800 flex items-center gap-2"><ShieldAlert className="size-4 text-red-600" /> Numéros d'Urgence (NC)</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-red-100">
            <div className="p-4 flex justify-between items-center"><span className="text-[10px] font-black uppercase">Secours en Mer (MRCC)</span><a href="tel:196" className="text-sm font-black text-red-600">196 (OU VHF 16)</a></div>
            <div className="p-4 flex justify-between items-center"><span className="text-[10px] font-black uppercase">Sapeurs-Pompiers</span><a href="tel:18" className="text-sm font-black">18</a></div>
            <div className="p-4 flex justify-between items-center"><span className="text-[10px] font-black uppercase">SAMU</span><div className="text-right"><a href="tel:15" className="text-sm font-black block">15</a><a href="tel:+687787725" className="text-[10px] font-bold text-slate-500">+687 78.77.25</a></div></div>
        </CardContent>
      </Card>

      {/* SECTION SONS GLOBALE */}
      <Card className="border-2 border-primary/10 bg-muted/5">
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="global-sounds" className="border-none">
                <AccordionTrigger className="p-4 hover:no-underline"><div className="flex items-center gap-3"><Volume2 className="size-5 text-primary" /><span className="text-sm font-black uppercase tracking-tight">Notifications Sonores & Alarmes</span></div></AccordionTrigger>
                <AccordionContent className="p-4 pt-0 space-y-6">
                    <div className="grid gap-4">
                        {[
                            { key: 'moving', label: 'Mouvement' },
                            { key: 'stationary', label: 'Mouillage' },
                            { key: 'offline', label: 'Signal Perdu' },
                            { key: 'emergency', label: 'Urgence / SOS' },
                            { key: 'watch', label: 'Veille Stratégique' },
                            { key: 'battery', label: 'Batterie Faible' }
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border-2 shadow-sm">
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-[10px] font-black uppercase truncate">{item.label}</span>
                                    <Select 
                                        value={vesselPrefs.notifySounds[item.key]} 
                                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [item.key]: v } })}
                                    >
                                        <SelectTrigger className="h-8 text-[9px] font-black uppercase border-none bg-transparent p-0 mt-1"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                        <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className={cn("size-8 rounded-lg", vesselPrefs.repeatSettings?.[item.key] ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                        onClick={() => saveVesselPrefs({ ...vesselPrefs, repeatSettings: { ...vesselPrefs.repeatSettings, [item.key]: !vesselPrefs.repeatSettings?.[item.key] } })}
                                    >
                                        <Repeat className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-8" onClick={() => playVesselSound(vesselPrefs.notifySounds[item.key])}><Play className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handleSaveVessel} className="w-full h-12 font-black uppercase text-[10px] tracking-widest"><Save className="size-4 mr-2" /> Sauver les préférences audio</Button>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}
