'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
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
  Sparkles,
  Copy,
  Ruler,
  Bell,
  Fish,
  Users,
  Target
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

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="size-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
);

type HistoryEntry = {
    vesselName: string;
    statusLabel: string;
    time: Date;
    pos: google.maps.LatLngLiteral;
    batteryLevel?: number;
    isCharging?: boolean;
    accuracy?: number;
    mooringRadius?: number;
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
  const [isPositionSharedWithGroup, setIsPositionSharedWithGroup] = useState(true);
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

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCatchDialogOpen, setIsCatchDialogOpen] = useState(false);

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
    batterySound: '',
    mooringRadius: 20
  });
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);

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
        return query(collection(firestore, 'vessels'), where('groupId', '==', fleetGroupId.toUpperCase()));
    }

    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId) && sharingId) queryIds.push(sharingId);
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
      if (userProfile.vesselPrefs) setVesselPrefs({ ...vesselPrefs, ...userProfile.vesselPrefs });
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      const savedNickname = userProfile.vesselNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '';
      if (!vesselNickname) setVesselNickname(savedNickname);
      if (userProfile.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
      if (userProfile.fleetGroupId && !fleetGroupId) setFleetGroupId(userProfile.fleetGroupId);
    }
  }, [userProfile, user]);

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
            isPositionHidden: !isPositionSharedWithGroup,
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
  }, [user, firestore, isSharing, sharingId, vesselNickname, currentPos, vesselPrefs.mooringRadius, fleetGroupId, isPositionSharedWithGroup]);

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving' || label === 'ERREUR - REPRISE MODE AUTO') {
        immobilityStartTime.current = Date.now();
        setAnchorPos(currentPos);
        isFirstFixRef.current = label === 'ERREUR - REPRISE MODE AUTO';
    }
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || 'Statut mis à jour' });
  };

  const handleSaveVessel = () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    const cleanGroupId = fleetGroupId.trim().toUpperCase();
    const userRef = doc(firestore, 'users', user.uid);
    updateDoc(userRef, { 
        savedVesselIds: cleanId ? arrayUnion(cleanId) : savedVesselIds, 
        lastVesselId: cleanId || customSharingId,
        fleetGroupId: cleanGroupId,
        vesselPrefs: vesselPrefs
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
        eventLabel: 'REGROUPEMENT D\'OISEAUX (CHASSE)' 
    });
    playVesselSound(vesselPrefs.notifySounds.birds || 'birds');
    toast({ title: "SIGNAL OISEAUX ENVOYÉ" });
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
        eventLabel: `PRISE DE POISSON : ${fishType.toUpperCase()}`
    });
    playVesselSound(vesselPrefs.notifySounds.birds || 'sonar');
    setIsCatchDialogOpen(false);
    toast({ title: "PRISE SIGNALÉE !", description: fishType });
  };

  const handleDeleteMarker = (marker: any) => {
    if (!firestore || !user || !isSharing) return;
    updateDoc(doc(firestore, 'vessels', sharingId), {
        huntingMarkers: arrayRemove(marker)
    }).then(() => toast({ title: "Point retiré" }));
  };

  const handleClearHuntingHistory = () => {
    if (!firestore || !user || !isSharing) return;
    updateDoc(doc(firestore, 'vessels', sharingId), { huntingMarkers: [] }).then(() => toast({ title: "Journal tactique réinitialisé" }));
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, { isSharing: false, lastActive: serverTimestamp(), statusChangedAt: serverTimestamp() }, { merge: true })
      .then(() => {
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setCurrentPos(null); setAnchorPos(null); lastSentStatusRef.current = null; isFirstFixRef.current = true; immobilityStartTime.current = null;
        setCountdown(null);
        toast({ title: "Partage arrêté" });
      });
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (!firestore || !user || !isSharing) return;
    updateDoc(doc(firestore, 'vessels', sharingId), { historyClearedAt: serverTimestamp() }).then(() => toast({ title: "Journal de bord réinitialisé" }));
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

  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        setCountdown(null);
        return;
    }

    const interval = setInterval(() => {
      if (!immobilityStartTime.current) return;

      const timeSinceStart = Date.now() - immobilityStartTime.current;
      const remaining = Math.max(0, Math.ceil((30000 - timeSinceStart) / 1000));
      
      if (vesselStatus === 'moving') {
        setCountdown(remaining);
      } else {
        setCountdown(null);
      }
      
      if (timeSinceStart >= 30000 && vesselStatus === 'moving') {
        if (currentPos && anchorPos) {
          const dist = getDistance(currentPos.lat, currentPos.lng, anchorPos.lat, anchorPos.lng);
          if (dist <= (vesselPrefs.mooringRadius || 20)) {
            handleManualStatus('stationary', 'AU MOUILLAGE (DÉTECTION AUTO)');
          } else {
            setAnchorPos(currentPos);
            immobilityStartTime.current = Date.now();
            handleManualStatus('moving', 'EN MOUVEMENT (DÉTECTION AUTO)');
          }
        }
        setCountdown(null);
      }
    }, 1000); 

    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, currentPos, anchorPos, vesselPrefs.mooringRadius]);

  useEffect(() => {
    if (!followedVessels) return;
    const newEntries: HistoryEntry[] = [];
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const timeKey = vessel.statusChangedAt?.toMillis ? vessel.statusChangedAt.toMillis() : (vessel.statusChangedAt?.seconds ? vessel.statusChangedAt.seconds * 1000 : 0);
        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;

        if (lastStatus !== currentStatus || timeKey > lastUpdate) {
            const pos = { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
            
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
                time: new Date(timeKey), 
                pos, 
                batteryLevel: vessel.batteryLevel, 
                isCharging: vessel.isCharging,
                accuracy: vessel.accuracy,
                mooringRadius: vessel.mooringRadius
            });

            if (mode !== 'sender' && lastStatus && lastStatus !== currentStatus && vesselPrefs.isNotifyEnabled) {
                let soundKey = '';
                if (currentStatus === 'emergency') soundKey = 'emergency';
                else if (vessel.eventLabel?.includes('OISEAUX')) soundKey = 'birds';
                else if (vessel.eventLabel?.includes('PRISE')) soundKey = 'birds';
                else if (currentStatus === 'returning' || currentStatus === 'landed') soundKey = 'moving';
                else soundKey = currentStatus;

                if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) {
                    playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar');
                }
            }
            lastStatusesRef.current[vessel.id] = currentStatus;
            lastUpdatesRef.current[vessel.id] = timeKey;
        }
    });
    if (newEntries.length > 0) setHistory(prev => [...newEntries, ...prev].slice(0, 20));
  }, [followedVessels, mode, vesselPrefs, playVesselSound]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        const accuracy = Math.round(position.coords.accuracy);
        setCurrentPos(newPos);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        
        if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
            if (isFirstFixRef.current) { 
                setAnchorPos(newPos); 
                immobilityStartTime.current = Date.now();
                isFirstFixRef.current = false; 
                updateVesselInFirestore({ status: 'moving', isSharing: true, eventLabel: 'LANCEMENT EN COURS', accuracy });
                return; 
            }
            
            if (anchorPos) {
                const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
                const currentRadius = vesselPrefs.mooringRadius || 20;
                
                if (vesselStatus === 'stationary' && dist > currentRadius) {
                    setVesselStatus('moving');
                    setAnchorPos(newPos);
                    immobilityStartTime.current = Date.now();
                    updateVesselInFirestore({ status: 'moving', eventLabel: 'REPRISE DE MOUVEMENT (SORTIE ZONE)', accuracy });
                } else if (vesselStatus === 'moving' && dist > currentRadius) {
                    setAnchorPos(newPos);
                    immobilityStartTime.current = Date.now();
                    updateVesselInFirestore({ accuracy });
                } else {
                    updateVesselInFirestore({ accuracy });
                }
            }
        } else {
            updateVesselInFirestore({ accuracy });
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map, toast, vesselStatus, vesselPrefs.mooringRadius]);

  const handleRecenter = () => {
    const pos = currentPos || (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const sendEmergencySms = (type: string) => {
    const pos = currentPos || (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    if (!pos) { toast({ variant: "destructive", title: "GPS non verrouillé" }); return; }
    const posUrl = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const body = `${vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : ""}${isCustomMessageEnabled ? vesselSmsMessage : "Assistance requise."} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleSavePreferences = () => {
    handleSaveVessel();
  };

  const SoundSettingsGrid = () => (
    <div className="space-y-6">
        <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-xs font-black uppercase">Alertes Sonores</Label>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux audio</p>
                </div>
                <Switch 
                    checked={vesselPrefs.isNotifyEnabled} 
                    onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} 
                />
            </div>

            <div className={cn("space-y-4 transition-opacity", !vesselPrefs.isNotifyEnabled && "opacity-40 pointer-events-none")}>
                <div className="space-y-3 pt-2 border-t border-dashed">
                    <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                        <Volume2 className="size-3" /> Volume des alertes
                    </Label>
                    <Slider 
                        value={[vesselPrefs.vesselVolume * 100]} 
                        max={100} step={1} 
                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} 
                    />
                </div>

                <div className="space-y-4 pt-4 border-t border-dashed">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Sons par événement</p>
                    <div className="grid gap-4">
                        {[
                            { id: 'moving', label: 'MOUVEMENT' },
                            { id: 'stationary', label: 'MOUILLAGE' },
                            { id: 'offline', label: 'SIGNAL PERDU' },
                            { id: 'emergency', label: 'ASSISTANCE (URGENCE)' },
                            { id: 'birds', label: 'OISEAUX / PRISES' }
                        ].map(evt => (
                            <div key={evt.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Switch 
                                            checked={vesselPrefs.notifySettings[evt.id as keyof typeof vesselPrefs.notifySettings]} 
                                            onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, notifySettings: { ...vesselPrefs.notifySettings, [evt.id]: v } })}
                                            className="scale-75"
                                        />
                                        <span className="text-[10px] font-black uppercase">{evt.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={vesselPrefs.notifySounds[evt.id as keyof typeof vesselPrefs.notifySounds]} 
                                            onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [evt.id]: v } })}
                                        >
                                            <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-white">
                                                <SelectValue placeholder="Choisir..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playVesselSound(vesselPrefs.notifySounds[evt.id as keyof typeof vesselPrefs.notifySounds])}>
                                            <Play className="size-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <Button onClick={handleSavePreferences} className="w-full h-12 font-black uppercase tracking-widest shadow-lg text-[10px] gap-2 mt-4 bg-primary text-white">
                <Save className="size-4" /> Enregistrer les préférences
            </Button>
        </div>

        <div className="p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100 space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-xs font-black uppercase text-orange-800">Veille Stratégique</Label>
                    <p className="text-[9px] font-bold text-orange-600/60 uppercase">Alarme si immobile trop longtemps</p>
                </div>
                <Switch checked={vesselPrefs.isWatchEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isWatchEnabled: v })} />
            </div>
            
            <div className={cn("space-y-4", !vesselPrefs.isWatchEnabled && "opacity-40 pointer-events-none")}>
                <div className="space-y-4 pt-2 border-t border-orange-100">
                    <div className="flex justify-between items-center px-1">
                        <Label className="text-[10px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label>
                        <Badge variant="outline" className="bg-white font-black">{vesselPrefs.watchDuration >= 60 ? `${Math.floor(vesselPrefs.watchDuration / 60)}h` : `${vesselPrefs.watchDuration} min`}</Badge>
                    </div>
                    <Slider value={[vesselPrefs.watchDuration || 60]} min={60} max={1440} step={60} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} />
                    <div className="flex justify-between text-[8px] font-black uppercase opacity-40 px-1"><span>1h</span><span>24h</span></div>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-black uppercase text-orange-800">Son de l'alarme</span>
                    <div className="flex items-center gap-2">
                        <Select value={vesselPrefs.watchSound} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchSound: v })}>
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-white border-orange-200"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600" onClick={() => playVesselSound(vesselPrefs.watchSound)}><Play className="size-3" /></Button>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 border-2 rounded-2xl bg-red-50/30 border-red-100 space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-xs font-black uppercase text-red-800">Seuil Batterie Faible</Label>
                    <p className="text-[9px] font-bold text-red-600/60 uppercase">Alerte journal de bord</p>
                </div>
                <Badge variant="outline" className="font-black bg-white">{vesselPrefs.batteryThreshold || 20}%</Badge>
            </div>
            <Slider value={[vesselPrefs.batteryThreshold || 20]} min={5} max={50} step={5} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batteryThreshold: v[0] })} />
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-red-100">
                <span className="text-[10px] font-black uppercase text-red-800">Son de l'alerte</span>
                <div className="flex items-center gap-2">
                    <Select value={vesselPrefs.batterySound} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batterySound: v })}>
                        <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-white border-red-200"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => playVesselSound(vesselPrefs.batterySound)}><Play className="size-3" /></Button>
                </div>
            </div>
        </div>

        <Button onClick={handleSaveVessel} className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-xs gap-3">
            <Save className="size-5" /> Enregistrer toutes les préférences
        </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('fleet')}>Flotte (C)</Button>
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
                            {fleetGroupId && <Badge variant="outline" className="bg-blue-500/20 text-blue-100 border-blue-300/30 text-[9px] uppercase font-black">Groupe: {fleetGroupId}</Badge>}
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2"><Zap className="size-3" /> Signalisation manuelle</p>
                        <Button variant="destructive" className="w-full h-14 font-black uppercase text-[10px] border-2 border-red-400 bg-red-500/20 text-red-700 gap-3 shadow-sm hover:bg-red-500/30 transition-all" onClick={() => handleManualStatus('emergency')} disabled={vesselStatus === 'emergency'}>
                            <ShieldAlert className="size-5" /> DEMANDE ASSISTANCE (PROBLÈME)
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                            <Button className="h-14 font-black uppercase text-[10px] border-2 border-blue-200 bg-blue-50 text-blue-700 gap-3 shadow-sm hover:bg-blue-100" onClick={handleSignalBirds}>
                                <Bird className="size-5" /> Oiseaux
                            </Button>
                            <Button className="h-14 font-black uppercase text-[10px] border-2 border-emerald-200 bg-emerald-50 text-emerald-700 gap-3 shadow-sm hover:bg-emerald-100" onClick={() => setIsCatchDialogOpen(true)}>
                                <Fish className="size-5" /> Signaler Prise
                            </Button>
                        </div>

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

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sender-audio" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl">
                                <Volume2 className="size-4 text-primary" />
                                <span className="text-[10px] font-black uppercase">Notifications & Sons</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <SoundSettingsGrid />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <Button variant="secondary" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 bg-primary text-white border-2 border-white/20" onClick={handleStopSharing}>
                        <X className="size-5" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <Label className="text-sm font-black uppercase">Partager ma position</Label>
                        <Switch checked={isSharing} onCheckedChange={(val) => { if (val) setIsSharing(true); else handleStopSharing(); }} />
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sender-prefs" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl">
                                <Settings className="size-4 text-primary" />
                                <span className="text-[10px] font-black uppercase">Identité & Flotte</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du navire (Partage)</Label>
                                    <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest w-full" />
                                    <Button variant="default" className="w-full h-12 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg" onClick={handleSaveVessel}>
                                        <Save className="size-4" />
                                        Enregistrement et validation
                                    </Button>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID de Flotte (Optionnel)</Label>
                                    <Input placeholder="EX: ASSOCIATION-XYZ" value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow bg-blue-50/50" />
                                    <div className="flex items-center justify-between p-3 bg-blue-50/30 rounded-xl border border-blue-100 mt-2">
                                        <Label className="text-[10px] font-black uppercase text-blue-800">Partager avec la flotte</Label>
                                        <Switch checked={isPositionSharedWithGroup} onCheckedChange={setIsPositionSharedWithGroup} className="scale-75" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label>
                                    <Input placeholder="EX: CAPITAINE NEMO" value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold text-center h-12 border-2 uppercase flex-grow w-full" />
                                </div>
                                <div className="space-y-4 p-4 border-2 rounded-2xl bg-primary/5 border-dashed">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                                            <Ruler className="size-3 text-primary" /> Rayon de Mouillage
                                        </Label>
                                        <Badge variant="outline" className="bg-white font-black">{vesselPrefs.mooringRadius || 20}m</Badge>
                                    </div>
                                    <Slider 
                                        value={[vesselPrefs.mooringRadius || 20]} 
                                        min={10} 
                                        max={100} 
                                        step={5} 
                                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, mooringRadius: v[0] })} 
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
                                        <Switch checked={isEmergencyEnabled} onCheckedChange={setIsEmergencyEnabled} />
                                    </div>

                                    <div className={cn("space-y-4 transition-opacity", !isEmergencyEnabled && "opacity-40 pointer-events-none")}>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Numéro d'urgence (Contact à terre)</Label>
                                            <Input placeholder="Ex: +687 75 27 97" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" disabled={!isEmergencyEnabled} />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Message de détresse personnalisé</Label>
                                                <Switch checked={isCustomMessageEnabled} onCheckedChange={setIsCustomMessageEnabled} className="scale-75" disabled={!isEmergencyEnabled} />
                                            </div>
                                            <Textarea placeholder="Ex: SOS j'ai un souci avec le bateau..." value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className={cn("border-2 font-medium min-h-[80px]", !isCustomMessageEnabled && "opacity-50")} disabled={!isEmergencyEnabled || !isCustomMessageEnabled} />
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-dashed">
                                            <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1"><Eye className="size-3" /> Visualisation du SMS :</p>
                                            <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] font-medium leading-relaxed text-slate-600">"{smsPreview}"</div>
                                        </div>
                                    </div>
                                    <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] tracking-widest gap-2 shadow-md"><Save className="size-4" /> Enregistrer mes réglages SMS</Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
              )}
            </div>
          ) : mode === 'receiver' ? (
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
                <AccordionItem value="receiver-audio" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl">
                        <Volume2 className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Notifications & Sons</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4">
                        <SoundSettingsGrid />
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID de la Flotte / Association</Label>
                    <div className="flex gap-2">
                        <Input placeholder="EX: CLUB-PECHE-NC" value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow bg-blue-50/50" />
                        <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px]" onClick={handleSaveVessel} disabled={!fleetGroupId.trim()}><Check className="size-4" /></Button>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground italic px-1 mt-1">Connectez-vous pour voir les autres navires, les oiseaux et les prises du groupe.</p>
                </div>

                <div className="grid gap-2">
                    {followedVessels?.filter(v => v.groupId === fleetGroupId.toUpperCase() && v.id !== sharingId && !v.isPositionHidden).map(v => (
                        <div key={v.id} className="flex items-center justify-between p-3 border-2 border-blue-100 bg-blue-50/30 rounded-xl shadow-sm cursor-pointer active:scale-[0.98] transition-all" onClick={() => { if (v.location && map) { map.panTo({ lat: v.location.latitude, lng: v.location.longitude }); map.setZoom(15); } }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-lg"><Navigation className="size-4" /></div>
                                <div className="flex flex-col">
                                    <span className="font-black text-xs uppercase">{v.displayName}</span>
                                    <Badge variant="outline" className={cn("text-[7px] font-black uppercase h-4 px-1 border-blue-200", 
                                        v.status === 'emergency' ? "bg-red-50 text-white" : "text-blue-600")}>
                                        {v.status === 'emergency' ? 'ASSISTANCE' : v.status}
                                    </Badge>
                                </div>
                            </div>
                            <BatteryIconComp level={v.batteryLevel} charging={v.isCharging} />
                        </div>
                    ))}
                    {(!followedVessels || followedVessels.filter(v => v.groupId === fleetGroupId.toUpperCase() && v.id !== sharingId && !v.isPositionHidden).length === 0) && fleetGroupId && (
                        <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-30">
                            <p className="text-[10px] font-black uppercase tracking-widest">Aucun autre navire visible</p>
                        </div>
                    )}
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.filter(v => v.isSharing && (!v.isPositionHidden || mode === 'receiver')).map(vessel => (
                    <React.Fragment key={vessel.id}>
                        {vessel.status === 'stationary' && vessel.location && (
                            <Circle
                                center={{ lat: vessel.location.latitude, lng: vessel.location.longitude }}
                                radius={vessel.mooringRadius || 20}
                                options={{
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.3,
                                    strokeColor: '#3b82f6',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    clickable: false,
                                    editable: false,
                                    draggable: false,
                                    visible: true,
                                    zIndex: 100
                                }}
                            />
                        )}
                        <OverlayView position={{ lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className={cn("px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2", 
                                    vessel.status === 'emergency' ? "bg-red-600 border-red-400" : "")}>
                                  <span>{vessel.displayName || vessel.id}</span>
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
                        
                        {vessel.huntingMarkers?.map(m => {
                            const isCatch = (m as any).type !== undefined;
                            if (isCatch) {
                                const catchInfo = FISH_TYPES.find(f => f.id === (m as any).type);
                                return (
                                    <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                            <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded border shadow-lg flex flex-col items-center">
                                                <span className="text-[10px] font-black uppercase text-slate-800">{(m as any).type}</span>
                                                <span className="text-[7px] font-bold text-muted-foreground uppercase">{(m as any).vesselName}</span>
                                            </div>
                                            <div className="p-1.5 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: catchInfo?.color || '#000' }}>
                                                <Fish className="size-4 text-white" />
                                            </div>
                                        </div>
                                    </OverlayView>
                                )
                            }
                            return (
                                <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center">
                                        <div className="bg-blue-600/90 text-white px-2 py-0.5 rounded text-[8px] font-black shadow-lg mb-1">OISEAUX {format(new Date(m.time), 'HH:mm')}</div>
                                        <div className="p-1.5 bg-blue-600 rounded-full border-2 border-white shadow-md"><Bird className="size-4 text-white" /></div>
                                    </div>
                                </OverlayView>
                            );
                        })}
                    </React.Fragment>
                ))}
                {mode === 'sender' && currentPos && (
                    <>
                        {vesselStatus === 'stationary' && anchorPos && (
                            <Circle
                                center={anchorPos}
                                radius={vesselPrefs.mooringRadius || 20}
                                options={{
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.3,
                                    strokeColor: '#3b82f6',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    clickable: false,
                                    editable: false,
                                    draggable: false,
                                    visible: true,
                                    zIndex: 100
                                }}
                            />
                        )}
                        <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" />
                        </OverlayView>
                    </>
                )}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5" /> MAYDAY</Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
            </div>
            
            <div className="space-y-2">
                <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/10">
                    <AccordionItem value="history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><History className="size-3 mr-2"/> Journal de bord (Statuts)</AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHistory}><Trash2 className="size-3 mr-1" /> Reset</Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide">
                            {history.length > 0 ? (
                                <div className="space-y-2 px-3">
                                    {history.map((h, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm animate-in fade-in slide-in-from-left-2">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-2">
                                                <span className="font-black text-primary">{h.vesselName}</span>
                                                <Badge variant="outline" className={cn("text-[8px] font-black uppercase h-4 px-1.5", 
                                                    h.statusLabel.includes('URGENCE') ? 'border-red-500 text-red-600 bg-red-50' :
                                                    h.statusLabel.includes('MOUILLAGE') ? 'border-amber-500 text-amber-600 bg-amber-50' :
                                                    h.statusLabel.includes('RETOUR') ? 'border-indigo-500 text-indigo-600 bg-indigo-50' :
                                                    h.statusLabel.includes('TERRE') ? 'border-green-500 text-green-600 bg-green-50' :
                                                    'border-primary text-primary bg-primary/5'
                                                )}>{h.statusLabel} {h.statusLabel.includes('MOUILLAGE') && h.mooringRadius ? `(${h.mooringRadius}m)` : ''}</Badge>
                                                {h.batteryLevel !== undefined && (
                                                    <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 border border-slate-200">
                                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />
                                                        {h.batteryLevel}%
                                                    </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2 text-[9px] font-bold opacity-40 uppercase">
                                                <span>{format(h.time, 'HH:mm:ss')}</span>
                                                {h.accuracy !== undefined && <span>• +/- {h.accuracy}m GPS</span>}
                                              </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary border-2" onClick={() => {
                                                    const coords = `${h.pos.lat.toFixed(6)},${h.pos.lng.toFixed(6)}`;
                                                    navigator.clipboard.writeText(coords);
                                                    toast({ title: "Point GPS copié", description: coords });
                                                }}>
                                                    <Copy className="size-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { if (h.pos && map) { map.panTo(h.pos); map.setZoom(17); } }}>
                                                  <MapPin className="size-3 text-primary" /> GPS
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 opacity-40 uppercase text-[10px] font-black italic">pas d'affichage dans l'historique</div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/10">
                    <AccordionItem value="hunting-history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><Target className="size-3 mr-2"/> Journal Tactique (Oiseaux & Prises)</AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHuntingHistory}><Trash2 className="size-3 mr-1" /> Reset</Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide">
                            {followedVessels?.some(v => v.huntingMarkers && v.huntingMarkers.length > 0) ? (
                                <div className="space-y-2 px-3">
                                    {followedVessels.flatMap(v => (v.huntingMarkers || []).map(m => ({ ...m, vesselId: v.id, vesselName: v.displayName }))).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20).map((m, i) => {
                                        const isCatch = (m as any).type !== undefined;
                                        return (
                                            <div key={m.id} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm animate-in fade-in slide-in-from-left-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-primary">{m.vesselName}</span>
                                                        <Badge variant={isCatch ? "default" : "outline"} className={cn("text-[8px] font-black uppercase h-4 px-1.5", isCatch ? "bg-emerald-600 border-none" : "border-blue-500 text-blue-600 bg-blue-50")}>
                                                            {isCatch ? `PRISE : ${(m as any).type}` : 'OISEAUX'}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-[9px] font-bold opacity-40 uppercase">{format(new Date(m.time), 'HH:mm:ss')}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary border-2" onClick={() => {
                                                        const coords = `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`;
                                                        navigator.clipboard.writeText(coords);
                                                        toast({ title: "Point GPS copié", description: coords });
                                                    }}>
                                                        <Copy className="size-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2" onClick={() => { if (map) { map.panTo({ lat: m.lat, lng: m.lng }); map.setZoom(17); } }}>
                                                        <LocateFixed className="size-3 text-primary" /> GPS
                                                    </Button>
                                                    {isSharing && m.vesselId === sharingId && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive border-2" onClick={() => handleDeleteMarker(m)}>
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 opacity-40 uppercase text-[10px] font-black italic">Aucun signal tactique</div>
                            )}
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
