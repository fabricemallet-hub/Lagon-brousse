'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
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
  Bell,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  History,
  MapPin,
  ChevronDown,
  X,
  Play,
  Volume2,
  Check,
  Trash2,
  Ship,
  Home,
  RefreshCw,
  Settings,
  Battery,
  MessageSquare,
  Eye,
  Smartphone,
  Phone,
  Waves
} from 'lucide-react';
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

const INITIAL_CENTER = { lat: -22.27, lng: 166.45 };
const IMMOBILITY_THRESHOLD_METERS = 20; 

const defaultVesselSounds = [
  { id: 'sonar', label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'bip', label: 'Bip Digital', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
];

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

export function VesselTracker() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const shouldPanOnNextFix = useRef(false);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: 'sonar', stationary: 'cloche', offline: 'alerte' },
    isWatchEnabled: false,
    watchType: 'stationary',
    watchDuration: 60,
    watchSound: 'alerte',
    batteryThreshold: 20
  });
  
  const [history, setHistory] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean }[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastBatteryLevelsRef = useRef<Record<string, number>>({});
  const lastChargingStatesRef = useRef<Record<string, boolean>>({});
  const lastClearTimesRef = useRef<Record<string, number>>({});

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

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    const list = [...defaultVesselSounds];
    if (dbSounds) {
      dbSounds.forEach(s => {
        const isVessel = !s.categories || s.categories.includes('Vessel') || s.categories.includes('General');
        if (isVessel && !list.find(l => l.url === s.url)) list.push({ id: s.id, label: s.label, url: s.url });
      });
    }
    return list;
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
      
      const savedNickname = userProfile.vesselNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '';
      if (!vesselNickname) setVesselNickname(savedNickname);
      
      if (userProfile.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
    }
  }, [userProfile, user]);

  useEffect(() => {
    if (!user || !firestore || !vesselNickname) return;
    
    const timer = setTimeout(() => {
      updateDoc(doc(firestore, 'users', user.uid), {
        vesselNickname: vesselNickname
      }).catch(err => console.warn("Auto-save failed:", err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [vesselNickname, user, firestore]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const newStatus = data.status || vesselStatus;
    const statusChanged = lastSentStatusRef.current !== newStatus;

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
            ...batteryInfo,
            ...data 
        };

        if (statusChanged || lastSentStatusRef.current === null || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
            lastSentStatusRef.current = newStatus;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname, vesselStatus]);

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: cleanId ? arrayUnion(cleanId) : savedVesselIds,
            lastVesselId: cleanId || customSharingId,
            vesselNickname: vesselNickname
        });
        if (vesselIdToFollow) setVesselIdToFollow('');
        toast({ title: "ID enregistré" });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Erreur sauvegarde" });
    }
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayRemove(id)
        });
        toast({ title: "Navire retiré de la liste" });
    } catch (e) {
        console.error(e);
    }
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    
    if (st === 'moving') {
        immobilityStartTime.current = null;
        setAnchorPos(null);
    }
    
    toast({ title: label || (st === 'returning' ? 'Retour Maison' : st === 'landed' ? 'À terre' : 'Mode Auto') });
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await setDoc(doc(firestore, 'vessels', sharingId), { 
        isSharing: false, 
        lastActive: serverTimestamp(),
        statusChangedAt: serverTimestamp() 
    }, { merge: true });

    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    setCurrentPos(null);
    setAnchorPos(null);
    lastSentStatusRef.current = null;
    toast({ title: "Partage arrêté" });
  };

  const handleClearHistory = async () => {
    setHistory([]);
    if (!firestore || !user) return;
    
    try {
        if (isSharing) {
            await updateDoc(doc(firestore, 'vessels', sharingId), {
                historyClearedAt: serverTimestamp()
            });
        }
        toast({ title: "Historique effacé" });
    } catch (e) {
        console.error(e);
    }
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const handleSaveSmsSettings = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            emergencyContact: emergencyContact,
            vesselSmsMessage: vesselSmsMessage
        });
        toast({ title: "Paramètres SMS sauvegardés" });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Erreur sauvegarde SMS" });
    }
  };

  useEffect(() => {
    if (!followedVessels) return;

    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const statusTime = vessel.statusChangedAt || vessel.lastActive;
        const currentBattery = vessel.batteryLevel ?? 100;
        const currentCharging = vessel.isCharging ?? false;
        
        const getTimeMillis = (t: any) => {
            if (!t) return 0;
            if (typeof t.toMillis === 'function') return t.toMillis();
            if (typeof t.getTime === 'function') return t.getTime();
            if (t.seconds) return t.seconds * 1000;
            return 0;
        };

        const timeKey = getTimeMillis(statusTime);
        const clearTimeKey = getTimeMillis(vessel.historyClearedAt);

        if (clearTimeKey > (lastClearTimesRef.current[vessel.id] || 0)) {
            setHistory(prev => prev.filter(h => h.vesselName !== (vessel.displayName || vessel.id)));
            lastClearTimesRef.current[vessel.id] = clearTimeKey;
        }

        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;
        const lastBattery = lastBatteryLevelsRef.current[vessel.id] ?? 100;
        const lastCharging = lastChargingStatesRef.current[vessel.id] ?? false;
        
        const statusChanged = lastStatus !== currentStatus;
        const timestampUpdated = timeKey > lastUpdate;
        const batteryDroppedUnderThreshold = lastBattery >= (vesselPrefs.batteryThreshold || 20) && currentBattery < (vesselPrefs.batteryThreshold || 20);
        const chargingStateChanged = lastCharging !== currentCharging;

        const pos = { 
            lat: vessel.location?.latitude || INITIAL_CENTER.lat, 
            lng: vessel.location?.longitude || INITIAL_CENTER.lng 
        };

        const statusLabels: Record<string, string> = { 
            moving: 'EN MOUVEMENT', 
            stationary: 'AU MOUILLAGE', 
            offline: 'SIGNAL PERDU',
            returning: 'RETOUR MAISON',
            landed: 'À TERRE (HOME)'
        };

        const addToHistory = (label: string) => {
            setHistory(prev => {
                const alreadyAdded = prev.length > 0 && 
                                   prev[0].statusLabel === label && 
                                   prev[0].vesselName === (vessel.displayName || vessel.id) && 
                                   Math.abs(prev[0].time.getTime() - Date.now()) < 2000;
                if (alreadyAdded) return prev;
                return [{ 
                    vesselName: vessel.displayName || vessel.id, 
                    statusLabel: label, 
                    time: new Date(), 
                    pos,
                    batteryLevel: currentBattery,
                    isCharging: currentCharging
                }, ...prev].slice(0, 50);
            });
        };

        if (statusChanged || timestampUpdated) {
            const label = vessel.eventLabel || statusLabels[currentStatus] || currentStatus;
            addToHistory(label);
            
            if (mode === 'receiver' && lastStatus && statusChanged && vesselPrefs.isNotifyEnabled) {
                const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : currentStatus;
                if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) {
                    playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar');
                    toast({ title: vessel.displayName || vessel.id, description: `Changement d'état : ${label.toLowerCase()}` });
                }
            }
            lastStatusesRef.current[vessel.id] = currentStatus;
            lastUpdatesRef.current[vessel.id] = timeKey;
        }

        if (batteryDroppedUnderThreshold) {
            addToHistory(`BATTERIE FAIBLE`);
            if (mode === 'receiver' && vesselPrefs.isNotifyEnabled) {
                playVesselSound('alerte');
                toast({ variant: 'destructive', title: "Batterie Critique", description: `${vessel.displayName || vessel.id} : ${currentBattery}%` });
            }
        }

        if (chargingStateChanged) {
            const label = currentCharging ? "BATTERIE EN CHARGE" : "DÉCONNECTÉ DU SECTEUR";
            addToHistory(label);
            if (mode === 'receiver' && vesselPrefs.isNotifyEnabled) {
                playVesselSound('sonar');
            }
        }

        lastBatteryLevelsRef.current[vessel.id] = currentBattery;
        lastChargingStatesRef.current[vessel.id] = currentCharging;
    });
  }, [followedVessels, mode, vesselPrefs, playVesselSound, toast]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        
        if (vesselStatus !== 'returning' && vesselStatus !== 'landed') {
            if (!anchorPos) { 
              setAnchorPos(newPos); 
              updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true }); 
              return; 
            }
            const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
            if (dist > IMMOBILITY_THRESHOLD_METERS) {
              setVesselStatus('moving'); setAnchorPos(newPos); immobilityStartTime.current = null;
              updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true, eventLabel: null });
            } else {
              if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
              if (Date.now() - immobilityStartTime.current > 30000 && vesselStatus !== 'stationary') {
                setVesselStatus('stationary'); updateVesselInFirestore({ status: 'stationary', eventLabel: null });
              }
            }
        } else {
            updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } });
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map, toast, vesselStatus]);

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    
    const customText = vesselSmsMessage || "Requiert assistance immédiate.";
    const body = `${customText} [${type}] Position : ${posUrl}`;
    
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const smsPreview = useMemo(() => {
    const customText = vesselSmsMessage || "Requiert assistance immédiate.";
    return `${customText} [MAYDAY/PAN PAN] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [vesselSmsMessage]);

  if (loadError) return <div className="p-4 text-destructive">Erreur chargement Google Maps.</div>;
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
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2", 
                        vesselStatus === 'landed' ? "bg-green-600 border-green-400/20" : "bg-primary border-primary-foreground/20")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10 text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage en cours
                            </p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[10px] px-3 h-6 animate-pulse">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                {vesselStatus === 'moving' ? <Move className="size-3" /> : vesselStatus === 'returning' ? <Navigation className="size-3" /> : vesselStatus === 'landed' ? <Home className="size-3" /> : <Anchor className="size-3" />}
                                {vesselStatus === 'moving' ? 'En mouvement' : vesselStatus === 'returning' ? 'Retour Maison' : vesselStatus === 'landed' ? 'À terre' : 'Au mouillage'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2"><Zap className="size-3" /> Signalisation manuelle</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2 touch-manipulation" onClick={() => handleManualStatus('returning')} disabled={vesselStatus === 'returning'}>
                                <Navigation className="size-4 text-blue-600" /> Retour Maison
                            </Button>
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2 touch-manipulation" onClick={() => handleManualStatus('landed')} disabled={vesselStatus === 'landed'}>
                                <Home className="size-4 text-green-600" /> Home (À terre)
                            </Button>
                        </div>
                        
                        <Button 
                            variant="ghost" 
                            className="w-full h-12 font-black uppercase text-[9px] border-2 border-dashed gap-2 touch-manipulation text-orange-600" 
                            onClick={() => handleManualStatus('moving', 'ERREUR - REPRISE MODE AUTO')}
                        >
                            <RefreshCw className="size-4" /> ERREUR / REPRISE MODE NORMAL (AUTO)
                        </Button>
                    </div>

                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20 touch-manipulation" onClick={handleStopSharing}>
                        <X className="size-5" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                        <Switch checked={isSharing} onCheckedChange={(val) => { if (val) setIsSharing(true); else handleStopSharing(); }} className="touch-manipulation" />
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
                                        <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0 touch-manipulation" onClick={handleSaveVessel}>
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
                                    <p className="text-[8px] font-bold text-muted-foreground px-1 mt-1 leading-tight italic">
                                        le surnom inscrit ici n'est pas relié au surnom de la session chasse. il sera enregistré automatiquement sur le profil utilisateur a la saisie
                                    </p>
                                </div>
                                <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2 gap-2 touch-manipulation" onClick={toggleWakeLock}>
                                    <Zap className={cn("size-4", wakeLock && "fill-primary")} />
                                    {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
                                </Button>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="sms-settings" className="border-none mt-2">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 border-2 border-orange-100/50 rounded-xl">
                                <Smartphone className="size-4 text-orange-600" />
                                <span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-6">
                                <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Numéro d'urgence (Contact à terre)</Label>
                                        <Input 
                                            placeholder="Ex: 77 12 34" 
                                            value={emergencyContact} 
                                            onChange={e => setEmergencyContact(e.target.value)} 
                                            className="h-12 border-2 font-black text-lg" 
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Message de détresse personnalisé</Label>
                                        <Textarea 
                                            placeholder="Ex: Problème moteur, demande assistance." 
                                            value={vesselSmsMessage} 
                                            onChange={e => setVesselSmsMessage(e.target.value)} 
                                            className="border-2 font-medium min-h-[80px]"
                                        />
                                        <p className="text-[8px] font-bold text-muted-foreground italic px-1">Le point GPS sera annexé automatiquement à la fin de votre message.</p>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-dashed">
                                        <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1">
                                            <Eye className="size-3" /> Visualisation du SMS envoyé :
                                        </p>
                                        <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] font-medium leading-relaxed text-slate-600">
                                            "{smsPreview}"
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
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label>
                <div className="flex gap-2">
                    <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                    <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0 touch-manipulation" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button>
                </div>
              </div>

              {savedVesselIds.length > 0 && (
                <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Flotte suivie ({followedVessels?.filter(v => v.isSharing).length || 0})</Label>
                    <div className="grid gap-2">
                        {savedVesselIds.map(id => {
                            const vessel = followedVessels?.find(v => v.id === id);
                            const isActive = vessel?.isSharing === true;
                            return (
                                <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl transition-all shadow-sm", isActive ? "bg-primary/5 border-primary/20" : "bg-muted/5 opacity-60")}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                            {isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase tracking-tight">{vessel?.displayName || id}</span>
                                            <span className="text-[8px] font-bold uppercase opacity-60">{isActive ? 'En ligne' : 'Déconnecté'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isActive && <BatteryIconComp level={vessel?.batteryLevel} charging={vessel?.isCharging} />}
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveSavedVessel(id)} className="size-8 text-destructive/40 hover:text-destructive border-2 touch-manipulation"><Trash2 className="size-3" /></Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              )}

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
                          <Label className="text-xs font-black uppercase">Alertes Sonores</Label>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux audio</p>
                        </div>
                        <Switch 
                          checked={vesselPrefs.isNotifyEnabled} 
                          onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} 
                          className="touch-manipulation"
                        />
                      </div>

                      <div className="space-y-3 pt-2 border-t border-dashed">
                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                          <Volume2 className="size-3" /> Volume des alertes
                        </Label>
                        <Slider 
                          value={[vesselPrefs.vesselVolume * 100]} 
                          max={100} step={1} 
                          onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} 
                          className="touch-manipulation"
                        />
                      </div>

                      <div className="space-y-4 pt-4 border-t border-dashed">
                        <p className="text-[9px] font-black uppercase text-muted-foreground">Sons par événement</p>
                        <div className="grid gap-3">
                          {['moving', 'stationary', 'offline'].map(key => (
                            <div key={key} className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-bold uppercase flex-1">{key === 'moving' ? 'Mouvement' : key === 'stationary' ? 'Mouillage' : 'Signal Perdu'}</span>
                              <Select 
                                value={vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds]} 
                                onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [key]: v } })}
                              >
                                <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-muted/30">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-8 w-8 touch-manipulation" onClick={() => playVesselSound(vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds])}><Play className="size-3" /></Button>
                            </div>
                          ))}
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
                          className="touch-manipulation"
                        />
                      </div>
                      
                      <div className="space-y-4 pt-2 border-t border-orange-100">
                        <div className="flex justify-between items-center px-1">
                          <Label className="text-[10px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label>
                          <Badge variant="outline" className="font-black bg-white">{vesselPrefs.watchDuration >= 60 ? `${Math.floor(vesselPrefs.watchDuration / 60)}h` : `${vesselPrefs.watchDuration} min`}</Badge>
                        </div>
                        <Slider 
                          value={[vesselPrefs.watchDuration || 60]} 
                          min={60} 
                          max={1440} 
                          step={60}
                          onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} 
                          className="touch-manipulation"
                        />
                        <div className="flex justify-between text-[8px] font-black uppercase opacity-40 px-1">
                          <span>1h</span>
                          <span>24h</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 border-2 rounded-2xl bg-red-50/30 border-red-100">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-black uppercase text-red-800">Seuil Batterie Faible</Label>
                          <p className="text-[9px] font-bold text-red-600/60 uppercase">Alerte journal de bord</p>
                        </div>
                        <Badge variant="outline" className="font-black">{vesselPrefs.batteryThreshold || 20}%</Badge>
                      </div>
                      <Slider 
                        value={[vesselPrefs.batteryThreshold || 20]} 
                        min={5} max={50} step={5}
                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batteryThreshold: v[0] })} 
                        className="touch-manipulation"
                      />
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
                {followedVessels?.filter(v => v.isSharing).map(vessel => (
                    <OverlayView key={vessel.id} position={{ lat: vessel.location.latitude, lng: vessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2">
                          {vessel.displayName || vessel.id}
                          <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                        </div>
                        <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                            vessel.status === 'moving' ? "bg-blue-600" : 
                            vessel.status === 'returning' ? "bg-indigo-600" :
                            vessel.status === 'landed' ? "bg-green-600" : "bg-amber-600")}>
                          {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : 
                           vessel.status === 'landed' ? <Home className="size-5 text-white" /> : 
                           vessel.status === 'returning' ? <Navigation className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                ))}
                {mode === 'sender' && currentPos && (
                    <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" />
                    </OverlayView>
                )}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0 touch-manipulation"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 touch-manipulation" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs touch-manipulation" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5" /> MAYDAY</Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20 touch-manipulation" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
            </div>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history" className="border rounded-xl bg-muted/10 overflow-hidden">
                  <div className="flex items-center pr-4">
                    <AccordionTrigger className="flex-1 text-[10px] font-black uppercase py-3 px-3 hover:no-underline">
                      <div className="flex items-center gap-2"><History className="size-3"/> Journal de bord unifié</div>
                    </AccordionTrigger>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[8px] font-black text-destructive hover:bg-destructive/10 border border-destructive/20 touch-manipulation"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClearHistory();
                        }}
                    >
                        <Trash2 className="size-3 mr-1" /> Effacer
                    </Button>
                  </div>
                  <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide touch-pan-y">
                        {history.length > 0 ? (
                            <div className="space-y-2 px-3">
                                {history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm animate-in fade-in slide-in-from-left-2">
                                        <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-2">
                                            <span className="font-black text-primary">{h.vesselName}</span>
                                            <span className={cn("font-black uppercase", 
                                                h.statusLabel.includes('ERREUR') ? 'text-orange-600' :
                                                h.statusLabel.includes('FAIBLE') ? 'text-red-600' :
                                                h.statusLabel.includes('CHARGE') ? 'text-green-600' :
                                                h.statusLabel.includes('MOUILLAGE') ? 'text-orange-600' : 
                                                h.statusLabel.includes('MOUVEMENT') ? 'text-blue-600' : 
                                                h.statusLabel.includes('RETOUR') ? 'text-indigo-600' :
                                                h.statusLabel.includes('TERRE') ? 'text-green-600' : 'text-red-600')}>
                                                {h.statusLabel}
                                            </span>
                                            {h.batteryLevel !== undefined && (
                                                <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 border border-slate-200">
                                                    <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />
                                                    {h.batteryLevel}%
                                                </span>
                                            )}
                                          </div>
                                          <span className="text-[9px] font-bold opacity-40">{format(h.time, 'HH:mm:ss')}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2 touch-manipulation" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>
                                          <MapPin className="size-3 text-primary" /> GPS
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-40 mx-3">
                              <p className="text-[10px] font-black uppercase tracking-widest">pas d'affichage dans l'historique</p>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </Card>

      {/* Directory Section */}
      <Card className="border-2 bg-muted/10 shadow-none">
        <CardHeader className="p-4 pb-2 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Phone className="size-4 text-primary" /> Annuaire Maritime NC
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2 border-b pb-1">
              <ShieldAlert className="size-3" /> Urgences
            </h4>
            <div className="space-y-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">COSS NC (Mer)</span>
                <a href="tel:16" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 16
                </a>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">SAMU (Terre)</span>
                <a href="tel:15" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 15
                </a>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Gendarmerie Maritime</span>
                <a href="tel:294036" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 29 40 36
                </a>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Protection du lagon</span>
                <a href="tel:243255" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 24 32 55
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 border-b pb-1">
              <Waves className="size-3" /> Services
            </h4>
            <div className="space-y-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Météo Marine</span>
                <a href="tel:366736" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 36 67 36
                </a>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Phares et Balises</span>
                <a href="tel:232100" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 23 21 00
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 border-b pb-1">
              <Ship className="size-3" /> Ports & Marinas
            </h4>
            <div className="space-y-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Port Autonome (VHF 12)</span>
                <a href="tel:255000" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 25 50 00
                </a>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Port Moselle (VHF 67)</span>
                <a href="tel:277197" className="text-sm font-black hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="size-3" /> 27 71 97
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
