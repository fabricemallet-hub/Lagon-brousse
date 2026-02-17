
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteDoc } from 'firebase/firestore';
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
  Bird,
  AlertCircle,
  Clock,
  EyeOff,
  Sparkles,
  Copy,
  Ruler,
  Bell,
  Fish,
  Users,
  Target,
  ChevronDown,
  Pencil
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const FISH_TYPES = [
  { id: 'Marlin', label: 'Marlin', color: '#1e40af' },
  { id: 'Thon', label: 'Thon', color: '#b91c1c' },
  { id: 'Mahi-Mahi', label: 'Mahi-Mahi', color: '#10b981' },
  { id: 'Bonite', label: 'Bonite', color: '#64748b' },
  { id: 'Thazard', label: 'Thazard', color: '#7c3aed' },
  { id: 'Wahoo', label: 'Wahoo', color: '#f97316' },
  { id: 'Autres', label: 'Autres', color: '#000000' }
];

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

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [fleetGroupId, setFleetGroupId] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [sharingTarget, setSharingTarget] = useState<'none' | 'receiver' | 'fleet' | 'both'>('none');
  const [isTargetMenuOpen, setIsTargetMenuOpen] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
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
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const isFirstFixRef = useRef<boolean>(true);
  const lastMinutePosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const [secondsUntilUpdate, setSecondsUntilUpdate] = useState(60);

  const [isCatchDialogOpen, setIsCatchDialogOpen] = useState(false);
  const [locallyClearedMarkerIds, setLocallyClearedMarkerIds] = useState<string[]>([]);

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
    mooringRadius: 20
  });
  
  const [history, setHistory] = useState<{ vesselId: string, vesselName: string, statusLabel: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean, durationMinutes?: number }[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
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
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) {
        queryIds.push(sharingId);
    }
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const selfVesselData = useMemo(() => {
    return followedVessels?.find(v => v.id === sharingId);
  }, [followedVessels, sharingId]);

  const tacticalMarkers = useMemo(() => {
    if (!followedVessels) return [];
    return followedVessels
        .flatMap(v => (v.huntingMarkers || []).map(m => ({ ...m, vesselId: v.id, vesselName: v.displayName })))
        .filter(m => !locallyClearedMarkerIds.includes(m.id))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [followedVessels, locallyClearedMarkerIds]);

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
            ...batteryInfo,
            ...data 
        };

        if (data.status || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
        }

        if (!updatePayload.location && currentPos) {
            updatePayload.location = { latitude: currentPos.lat, longitude: currentPos.lng };
        }

        const vesselRef = doc(firestore, 'vessels', sharingId);
        setDoc(vesselRef, updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname, currentPos, vesselPrefs.mooringRadius, fleetGroupId, isGhostMode]);

  const handleSharingTargetChange = (target: 'none' | 'receiver' | 'fleet' | 'both') => {
    setSharingTarget(target);
    setIsTargetMenuOpen(false);
    if (target === 'none') {
        handleStopSharing();
    } else {
        setIsSharing(true);
        const isPosHidden = target === 'receiver';
        const isPrivHidden = target === 'fleet';
        
        updateVesselInFirestore({ 
            isSharing: true, 
            isPositionHidden: isPosHidden,
            isPrivateHidden: isPrivHidden 
        });

        if (user && firestore) {
            updateDoc(doc(firestore, 'users', user.uid), {
                vesselSharingTarget: target
            });
        }
        toast({ title: "Partage activé" });
    }
  };

  const handleGhostModeToggle = (val: boolean) => {
    setIsGhostMode(val);
    updateVesselInFirestore({ isGhostMode: val });
    if (user && firestore) {
        updateDoc(doc(firestore, 'users', user.uid), { isGhostMode: val });
    }
    toast({ title: val ? "Mode Fantôme activé" : "Mode Fantôme désactivé" });
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving') {
        immobilityStartTime.current = Date.now();
        setAnchorPos(currentPos);
    }
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || 'Statut mis à jour' });
  };

  const handleSaveVessel = () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    const cleanGroupId = fleetGroupId.trim().toUpperCase();
    updateDoc(doc(firestore, 'users', user.uid), { 
        savedVesselIds: cleanId ? arrayUnion(cleanId) : savedVesselIds, 
        lastVesselId: cleanId || customSharingId,
        fleetGroupId: cleanGroupId,
        vesselPrefs: vesselPrefs,
        vesselSharingTarget: sharingTarget,
        isGhostMode: isGhostMode,
        vesselNickname: vesselNickname
    }).then(() => { 
        if (vesselIdToFollow) setVesselIdToFollow(''); 
        toast({ title: "Paramètres enregistrés" }); 
    });
  };

  const handleRemoveSavedVessel = (id: string) => {
    if (!user || !firestore) return;
    updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayRemove(id) }).then(() => toast({ title: "Navire retiré" }));
  };

  const handleSignalBirds = () => {
    if (!currentPos || !firestore) return;
    const marker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date().toISOString()
    };
    updateVesselInFirestore({ 
        huntingMarkers: arrayUnion(marker),
        eventLabel: 'REGROUPEMENT D\'OISEAUX' 
    });
    playVesselSound(vesselPrefs.notifySounds.birds || 'birds');
    toast({ title: "Signal oiseaux envoyé" });
  };

  const handleSignalCatch = (fishType: string) => {
    if (!currentPos || !firestore) return;
    const catchId = Math.random().toString(36).substring(7);
    const catchMarker = {
        id: catchId,
        lat: currentPos.lat,
        lng: currentPos.lng,
        type: fishType,
        time: new Date().toISOString(),
        vesselName: vesselNickname || 'Capitaine'
    };
    updateVesselInFirestore({ 
        huntingMarkers: arrayUnion(catchMarker as any),
        eventLabel: `PRISE : ${fishType.toUpperCase()}`
    });
    playVesselSound(vesselPrefs.notifySounds.birds || 'sonar');
    setIsCatchDialogOpen(false);
    toast({ title: "Prise signalée !" });
  };

  const handleClearHuntingHistory = () => {
    if (!firestore || !user) return;
    if (isSharing && mode === 'sender') {
        updateDoc(doc(firestore, 'vessels', sharingId), {
            huntingMarkers: []
        }).then(() => toast({ title: "Signalements tactiques supprimés" }));
    } else {
        setLocallyClearedMarkerIds(prev => [...prev, ...tacticalMarkers.map(m => m.id)]);
        toast({ title: "Journal tactique masqué" });
    }
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setSharingTarget('none');
    setIsTargetMenuOpen(false);
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, { isSharing: false, lastActive: serverTimestamp() }, { merge: true })
      .then(() => {
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setCurrentPos(null); setAnchorPos(null); lastSentStatusRef.current = null; isFirstFixRef.current = true;
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

  const saveVesselPrefs = (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const sendEmergencySms = (type: string) => {
    const pos = currentPos || (selfVesselData?.location ? { lat: selfVesselData.location.latitude, lng: selfVesselData.location.longitude } : null);
    if (!pos) { toast({ variant: "destructive", title: "GPS non verrouillé" }); return; }
    
    if (isGhostMode) {
        setIsGhostMode(false);
        updateVesselInFirestore({ isGhostMode: false, status: 'emergency', eventLabel: 'DEMANDE D\'ASSISTANCE (MAYDAY)' });
    }

    const posUrl = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const body = `${vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : ""}${isCustomMessageEnabled ? vesselSmsMessage : "Assistance requise."} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const filteredHistory = useMemo(() => {
    return history.filter(h => mode !== 'sender' || h.vesselId === sharingId);
  }, [history, mode, sharingId]);

  const filteredTactical = useMemo(() => {
    return tacticalMarkers.filter(m => mode !== 'sender' || m.vesselId === sharingId);
  }, [tacticalMarkers, mode, sharingId]);

  // EFFET POUR LE DÉCOMPTE VISUEL ET LES MAJ GPS MINUTE PAR MINUTE
  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        setSecondsUntilUpdate(60);
        return;
    }

    const interval = setInterval(() => {
        setSecondsUntilUpdate(prev => {
            if (prev <= 1) {
                // MISE À JOUR FORCEE TOUTES LES MINUTES
                let statusToUpdate = vesselStatus;
                let labelToUpdate = null;

                if (currentPos && lastMinutePosRef.current) {
                    const distInMinute = getDistance(currentPos.lat, currentPos.lng, lastMinutePosRef.current.lat, lastMinutePosRef.current.lng);
                    const radius = vesselPrefs.mooringRadius || 20;
                    
                    if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
                        if (distInMinute <= radius) {
                            statusToUpdate = 'stationary';
                        } else if (distInMinute < 100) {
                            statusToUpdate = 'drifting';
                            labelToUpdate = 'BATEAU À LA DÉRIVE';
                        } else {
                            statusToUpdate = 'moving';
                        }
                    }
                }

                updateVesselInFirestore({ 
                    status: statusToUpdate,
                    eventLabel: labelToUpdate || `MAJ GPS à ${format(new Date(), 'HH:mm')}`
                });

                lastMinutePosRef.current = currentPos;
                return 60;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, currentPos, vesselPrefs.mooringRadius, updateVesselInFirestore]);

  useEffect(() => {
    if (!followedVessels) return;
    const newEntries: any[] = [];
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const timeKey = vessel.statusChangedAt?.toMillis ? vessel.statusChangedAt.toMillis() : (vessel.statusChangedAt?.seconds ? vessel.statusChangedAt.seconds * 1000 : 0);
        const clearTimeKey = vessel.historyClearedAt?.toMillis ? vessel.historyClearedAt.toMillis() : (vessel.historyClearedAt?.seconds ? vessel.historyClearedAt.seconds * 1000 : 0);

        if (clearTimeKey > (lastClearTimesRef.current[vessel.id] || 0)) {
            setHistory(prev => prev.filter(h => h.vesselId !== vessel.id));
            lastClearTimesRef.current[vessel.id] = clearTimeKey;
        }

        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;

        if (lastStatus !== currentStatus || timeKey > lastUpdate) {
            const pos = { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
            
            const statusLabels: Record<string, string> = { 
                moving: 'EN MOUVEMENT', 
                stationary: 'AU MOUILLAGE', 
                drifting: 'À LA DÉRIVE',
                offline: 'SIGNAL PERDU',
                returning: 'RETOUR MAISON',
                landed: 'À TERRE (HOME)',
                emergency: 'DEMANDE D\'ASSISTANCE'
            };

            const label = vessel.eventLabel || statusLabels[currentStatus] || currentStatus.toUpperCase();
            const duration = differenceInMinutes(new Date(), new Date(timeKey));
            
            newEntries.push({ 
                vesselId: vessel.id,
                vesselName: vessel.displayName || vessel.id, 
                statusLabel: label, 
                time: new Date(timeKey), 
                pos, 
                batteryLevel: vessel.batteryLevel, 
                isCharging: vessel.isCharging,
                durationMinutes: duration 
            });

            if (mode !== 'sender' && lastStatus && lastStatus !== currentStatus && vesselPrefs.isNotifyEnabled) {
                const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : (currentStatus === 'emergency' ? 'emergency' : currentStatus);
                if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) {
                    playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar');
                }
            }
            lastStatusesRef.current[vessel.id] = currentStatus;
            lastUpdatesRef.current[vessel.id] = timeKey;
        }
    });
    if (newEntries.length > 0) setHistory(prev => [...newEntries, ...prev].slice(0, 50));
  }, [followedVessels, mode, vesselPrefs, playVesselSound]);

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
            if (isFirstFixRef.current) { 
                setAnchorPos(newPos); 
                lastMinutePosRef.current = newPos;
                isFirstFixRef.current = false; 
                updateVesselInFirestore({ status: 'moving', isSharing: true, eventLabel: `DÉMARRAGE À ${format(new Date(), 'HH:mm')}` });
                return; 
            }
        }
        updateVesselInFirestore({});
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, updateVesselInFirestore, map, toast, vesselStatus]);

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const handleRecenter = () => {
    const pos = currentPos || (selfVesselData?.location ? { lat: selfVesselData.location.latitude, lng: selfVesselData.location.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {isSharing && mode === 'sender' && (
          <div className="bg-primary text-white text-[10px] font-black uppercase py-1.5 px-4 rounded-full shadow-lg flex items-center gap-2 animate-pulse mx-auto w-fit border-2 border-white/20">
              <RefreshCw className="size-3" /> MAJ GPS DANS {secondsUntilUpdate}S
          </div>
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
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    {sharingTarget !== 'none' && !isTargetMenuOpen ? (
                        <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary text-white rounded-lg"><Zap className="size-4 fill-white" /></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-primary">Partage Actif</span>
                                    <span className="text-xs font-bold uppercase">
                                        {sharingTarget === 'receiver' ? 'Récepteur B' : sharingTarget === 'fleet' ? 'Flotte C' : 'Total (B + C)'}
                                    </span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setIsTargetMenuOpen(true)} className="h-8 text-[9px] font-black uppercase border-2 gap-1 px-3">
                                <Pencil className="size-3" /> Modifier
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3 p-4 border-2 rounded-3xl bg-primary/5 border-primary/10 shadow-inner animate-in slide-in-from-top-2">
                            <div className="flex flex-col gap-1 px-1">
                                <Label className="text-sm font-black uppercase text-primary">Cibles du partage</Label>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Choisissez avec qui partager votre position</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {[
                                    { id: 'none', label: 'Désactivé', icon: '❌', desc: 'Off' },
                                    { id: 'receiver', label: 'Récepteur B', icon: '👤', desc: 'Privé' },
                                    { id: 'fleet', label: 'Flotte C', icon: '🌊', desc: 'Groupe' },
                                    { id: 'both', label: 'B + C', icon: '🛡️', desc: 'Total' }
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleSharingTargetChange(option.id as any)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all active:scale-95 shadow-sm h-20",
                                            sharingTarget === option.id 
                                                ? "bg-primary text-white border-primary ring-2 ring-primary/20" 
                                                : "bg-white border-slate-100 text-slate-600 hover:border-primary/20"
                                        )}
                                    >
                                        <span className="text-xl mb-1">{option.icon}</span>
                                        <span className="text-[10px] font-black uppercase leading-tight text-center">{option.label}</span>
                                        <span className={cn("text-[7px] font-bold uppercase mt-1 opacity-50", sharingTarget === option.id ? "text-white/70" : "")}>{option.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('returning')} disabled={vesselStatus === 'returning'}>
                            <Navigation className="size-4 text-blue-600" /> Retour Maison
                        </Button>
                        <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('landed')} disabled={vesselStatus === 'landed'}>
                            <Home className="size-4 text-green-600" /> Home (À terre)
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button className="flex-1 h-14 font-black uppercase bg-slate-800 text-white text-[10px] gap-2 shadow-lg" onClick={handleSignalBirds}>
                            <Bird className="size-4" /> Signaler Oiseaux
                        </Button>
                        <Button className="flex-1 h-14 font-black uppercase bg-blue-600 text-white text-[10px] gap-2 shadow-lg" onClick={() => setIsCatchDialogOpen(true)}>
                            <Fish className="size-4" /> Signaler Prise
                        </Button>
                    </div>

                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20" onClick={handleStopSharing}>
                        <X className="size-5" /> Arrêter le partage
                    </Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="p-10 text-center border-4 border-dashed rounded-[3rem] bg-muted/5 opacity-40 flex flex-col items-center gap-4">
                        <Navigation className="size-12 text-primary" />
                        <p className="font-black uppercase tracking-widest text-xs">Partage Inactif</p>
                    </div>
                    <Button onClick={() => setIsTargetMenuOpen(true)} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base gap-3">
                        <Zap className="size-6 fill-white" /> Lancer le Partage
                    </Button>
                </div>
              )}
            </div>
          ) : mode === 'receiver' ? (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                        <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button>
                    </div>
                </div>
                {savedVesselIds.length > 0 && (
                    <div className="space-y-2">
                        {savedVesselIds.map(id => {
                            const v = followedVessels?.find(nav => nav.id === id);
                            const isActive = v?.isSharing;
                            return (
                                <div key={id} className={cn("p-3 border-2 rounded-xl flex items-center justify-between transition-all", isActive ? "bg-primary/5 border-primary/20" : "bg-muted/5 opacity-60")}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}</div>
                                        <div className="flex flex-col"><span className="font-black text-xs uppercase">{v?.displayName || id}</span><span className="text-[8px] font-bold uppercase opacity-60">{isActive ? 'En ligne' : 'Déconnecté'}</span></div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSavedVessel(id)} className="size-8 text-destructive/40 hover:text-destructive border-2"><Trash2 className="size-3" /></Button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
          ) : (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du groupe Flotte (ex: ABCD)</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ L'ID..." value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                        <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={handleSaveVessel} disabled={!fleetGroupId.trim()}><Check className="size-4" /></Button>
                    </div>
                </div>
                <div className="p-4 border-2 rounded-2xl bg-slate-900 text-white space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black uppercase text-primary">Mode Fantôme</Label>
                            <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">Devenir invisible sur les cartes</p>
                        </div>
                        <Switch checked={isGhostMode} onCheckedChange={handleGhostModeToggle} />
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-medium leading-relaxed italic text-slate-300">
                        "En activant ce mode, votre navire n'apparaît plus sur les cartes des autres membres de la flotte. Vous continuez cependant à recevoir leurs signaux tactiques."
                    </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[350px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.filter(v => v.isSharing && (!v.isGhostMode || mode === 'sender' || v.status === 'emergency')).map(vessel => {
                    const isSelf = vessel.id === sharingId;
                    if (mode === 'sender' && !isSelf) return null;
                    if (vessel.isGhostMode && !isSelf && vessel.status !== 'emergency') return null;

                    return (
                        <React.Fragment key={vessel.id}>
                            <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                    <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2">
                                      <span className="truncate max-w-[80px]">{vessel.displayName || vessel.id}</span>
                                      <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                                    </div>
                                    <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                                        vessel.status === 'emergency' ? 'bg-red-600 animate-pulse scale-125' :
                                        vessel.status === 'moving' ? "bg-blue-600" : 
                                        vessel.status === 'returning' ? "bg-indigo-600" :
                                        vessel.status === 'landed' ? "bg-green-600" : "bg-amber-600")}>
                                      {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : 
                                       vessel.status === 'landed' ? <Home className="size-5 text-white" /> : 
                                       vessel.status === 'emergency' ? <ShieldAlert className="size-6 text-white" /> :
                                       <Navigation className="size-5 text-white" />}
                                    </div>
                                </div>
                            </OverlayView>
                            {vessel.status === 'stationary' && (
                                <Circle center={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} radius={vessel.mooringRadius || 20} options={{ fillColor: '#3b82f6', fillOpacity: 0.2, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 1 }} />
                            )}
                        </React.Fragment>
                    );
                })}

                {tacticalMarkers.map(marker => {
                    if (mode === 'sender' && marker.vesselId !== sharingId) return null;
                    return (
                        <OverlayView 
                            key={`map-marker-${marker.id}`} 
                            position={{ lat: marker.lat, lng: marker.lng }} 
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className="px-1.5 py-0.5 bg-white/90 backdrop-blur-sm border rounded text-[8px] font-black uppercase shadow-sm whitespace-nowrap">
                                    {marker.type || 'OISEAUX'}
                                </div>
                                <div className={cn(
                                    "p-1.5 rounded-full border-2 border-white shadow-lg",
                                    marker.type ? "bg-blue-600" : "bg-orange-500"
                                )}>
                                    {marker.type ? <Fish className="size-3 text-white" /> : <Bird className="size-3 text-white" />}
                                </div>
                            </div>
                        </OverlayView>
                    );
                })}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}>
                    <ShieldAlert className="size-5" /> MAYDAY
                </Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}>
                    <AlertTriangle className="size-5 text-primary" /> PAN PAN
                </Button>
            </div>
            
            <div className="border rounded-xl bg-muted/10 overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">
                                <div className="flex items-center gap-2"><History className="size-3"/> Journal Unifié</div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive hover:bg-destructive/10 border border-destructive/20" onClick={(e) => { e.stopPropagation(); handleClearHistory(); }}>
                                <Trash2 className="size-3 mr-1" /> Effacer
                            </Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide">
                            <div className="px-3 space-y-4">
                                <div className="space-y-2">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground ml-1">Technique (Statuts)</p>
                                    {filteredHistory.length > 0 ? filteredHistory.map((h, i) => (
                                        <div key={`hist-${i}`} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm animate-in fade-in slide-in-from-left-2">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-2">
                                                <span className="font-black text-primary">{h.vesselName}</span>
                                                <span className={cn("font-black uppercase", h.statusLabel.includes('DÉRIVE') ? 'text-orange-600 underline' : h.statusLabel.includes('ASSISTANCE') ? 'text-red-600 animate-pulse' : 'text-slate-700')}>
                                                    {h.statusLabel}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 text-[8px] font-bold opacity-40 uppercase">
                                                <span>{format(h.time, 'HH:mm:ss')}</span>
                                                {h.durationMinutes !== undefined && <span>• Actif depuis {h.durationMinutes} min</span>}
                                              </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>
                                              <MapPin className="size-3 text-primary" /> GPS
                                            </Button>
                                        </div>
                                    )) : <div className="text-center py-6 opacity-20 uppercase text-[9px] font-black italic">Aucun mouvement</div>}
                                </div>

                                <div className="space-y-2 pt-2 border-t border-dashed">
                                    <p className="text-[8px] font-black uppercase text-primary ml-1 flex items-center justify-between">
                                        <span>Tactique (Oiseaux & Prises)</span>
                                        <Button variant="ghost" className="h-4 p-0 text-destructive text-[7px]" onClick={handleClearHuntingHistory}>Reset Tactique</Button>
                                    </p>
                                    {filteredTactical.length > 0 ? filteredTactical.map((m, i) => (
                                        <div key={`tact-${i}`} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-primary/10 text-[10px] shadow-sm">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    {m.type ? <Fish className="size-3 text-blue-600" /> : <Bird className="size-3 text-orange-500" />}
                                                    <span className="font-black uppercase">{m.type || 'OISEAUX'}</span>
                                                    <span className="text-[8px] font-bold opacity-40 uppercase">par {m.vesselName}</span>
                                                </div>
                                                <span className="text-[8px] font-bold opacity-40 uppercase">{format(new Date(m.time), 'HH:mm:ss')}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { map?.panTo({ lat: m.lat, lng: m.lng }); map?.setZoom(17); }}>
                                                    <LocateFixed className="size-3 text-primary" /> GPS
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive border-2" onClick={() => {
                                                    if (isSharing && m.vesselId === sharingId) {
                                                        updateDoc(doc(firestore!, 'vessels', sharingId), { huntingMarkers: arrayRemove(m) });
                                                    } else {
                                                        setLocallyClearedMarkerIds(prev => [...prev, m.id]);
                                                    }
                                                }}><Trash2 className="size-3.5" /></Button>
                                            </div>
                                        </div>
                                    )) : <div className="text-center py-6 opacity-20 uppercase text-[9px] font-black italic">Aucun signal tactique</div>}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>

      <Dialog open={isCatchDialogOpen} onOpenChange={setIsCatchDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                    <Fish className="size-5 text-primary" /> Signaler une Prise
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase">Quel poisson avez-vous pêché ?</DialogDescription>
            </DialogHeader>
            <div className="py-6 grid grid-cols-2 gap-2">
                {FISH_TYPES.map(fish => (
                    <Button 
                        key={fish.id} 
                        onClick={() => handleSignalCatch(fish.id)}
                        className="h-16 font-black uppercase text-xs shadow-md border-2 border-white/20"
                        style={{ backgroundColor: fish.color }}
                    >
                        {fish.label}
                    </Button>
                ))}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCatchDialogOpen(false)} className="w-full font-black uppercase text-[10px]">Annuler</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
