'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
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
  Waves,
  Bird,
  Fish,
  Copy,
  VolumeX,
  Camera,
  ImageIcon,
  Maximize2,
  Users,
  Ghost
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
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const TACTICAL_TYPES = [
    { id: 'oiseaux', label: 'OISEAUX', icon: Bird, color: 'bg-white text-blue-600 border-blue-600' },
    { id: 'marlin', label: 'MARLIN', icon: Fish, color: 'bg-blue-900 text-white border-blue-900' },
    { id: 'thon', label: 'THON', icon: Fish, color: 'bg-red-600 text-white border-red-600' },
    { id: 'tazard', label: 'TAZARD', icon: Fish, color: 'bg-slate-500 text-white border-slate-500' },
    { id: 'wahoo', label: 'WAHOO', icon: Fish, color: 'bg-cyan-600 text-white border-cyan-600' },
    { id: 'bonite', label: 'BONITE', icon: Fish, color: 'bg-indigo-600 text-white border-indigo-600' },
    { id: 'sardines', label: 'SARDINES', icon: Waves, color: 'bg-teal-500 text-white border-teal-500' },
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

interface TechEntry {
    vesselName: string;
    statusLabel: string;
    time: Date;
    pos: google.maps.LatLngLiteral;
    batteryLevel?: number;
    isCharging?: boolean;
    accuracy?: number;
    statusDurationMin?: number;
    vesselId: string;
}

interface TacticalEntry {
    id: string;
    vesselName: string;
    label: string;
    time: Date;
    pos: google.maps.LatLngLiteral;
    photoUrl?: string;
    vesselId: string;
}

export default function VesselTrackerPage() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const shouldPanOnNextFix = useRef(false);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, battery: true, emergency: true, tactical: true },
    notifySounds: { moving: '', stationary: '', offline: '', battery: '', emergency: '', tactical: '' },
    notifyLoops: { moving: false, stationary: false, offline: false, battery: false, emergency: false, tactical: false },
    isWatchEnabled: false,
    watchDuration: 60,
    watchSound: '',
    batteryThreshold: 20,
    mooringRadius: 20
  });
  
  const [techHistory, setTechHistory] = useState<TechEntry[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<TacticalEntry[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<{url: string, title: string} | null>(null);

  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastHistoryMinutesRef = useRef<Record<string, number>>({});
  const lastTacticalUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastBatteryLevelsRef = useRef<Record<string, number>>({});
  const lastChargingStatesRef = useRef<Record<string, boolean>>({});
  const lastClearTimesRef = useRef<Record<string, number>>({});

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showLoopAlert, setShowLoopAlert] = useState(false);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselIdHistory = userProfile?.vesselIdHistory || [];
  const fleetIdHistory = userProfile?.fleetIdHistory || [];

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    if (mode === 'fleet' && vesselIdToFollow) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', vesselIdToFollow.trim().toUpperCase()));
    }

    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing, mode, vesselIdToFollow]);
  
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

  const stopAllSounds = useCallback(() => {
    if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
    }
    setShowLoopAlert(false);
  }, []);

  const playVesselSound = useCallback((soundId: string, forceLoop: boolean = false) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    
    if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
    }

    const targetSound = soundId || 'sonar';
    const sound = availableSounds.find(s => s.id === targetSound || s.label.toLowerCase() === targetSound.toLowerCase());
    
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.loop = forceLoop;
      activeAudioRef.current = audio;
      
      if (forceLoop) {
          setShowLoopAlert(true);
      }

      audio.play().catch(e => console.warn("Audio play blocked or failed:", e));
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
            isGhostMode: data.isGhostMode !== undefined ? data.isGhostMode : isGhostMode,
            lastActive: serverTimestamp(),
            mooringRadius: vesselPrefs.mooringRadius || 20,
            fleetId: customFleetId.trim().toUpperCase() || null,
            ...batteryInfo,
            ...data 
        };

        if (data.status || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, vesselPrefs.mooringRadius, customFleetId]);

  const handleSaveId = async (idValue: string, type: 'vessel' | 'fleet') => {
    if (!user || !firestore || !idValue.trim()) return;
    const cleanId = idValue.trim().toUpperCase();
    
    const updateData: any = {
        [type === 'vessel' ? 'vesselIdHistory' : 'fleetIdHistory']: arrayUnion(cleanId),
        [type === 'vessel' ? 'lastVesselId' : 'lastFleetId']: cleanId,
        vesselNickname: vesselNickname
    };

    try {
        await updateDoc(doc(firestore, 'users', user.uid), updateData);
        if (isSharing) updateVesselInFirestore({});
        toast({ title: type === 'vessel' ? "ID Navire enregistré" : "ID Flotte enregistré" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur sauvegarde ID" });
    }
  };

  const handleRemoveHistoryId = async (id: string, type: 'vessel' | 'fleet') => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            [type === 'vessel' ? 'vesselIdHistory' : 'fleetIdHistory']: arrayRemove(id)
        });
    } catch (e) {}
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

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(prev => ({ ...prev, ...userProfile.vesselPrefs }));
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      setIsGhostMode(userProfile.isGhostMode ?? false);
      
      const savedNickname = userProfile.vesselNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '';
      if (!vesselNickname) setVesselNickname(savedNickname);
      
      if (userProfile.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
      if (userProfile.lastFleetId && !customFleetId) setCustomFleetId(userProfile.lastFleetId);
    }
  }, [userProfile, user]);

  const handleSaveVesselToList = async () => {
    if (!user || !firestore || !vesselIdToFollow.trim()) return;
    const cleanId = vesselIdToFollow.trim().toUpperCase();
    
    if (mode === 'fleet') {
        handleSaveId(cleanId, 'fleet');
        return;
    }

    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayUnion(cleanId)
        });
        setVesselIdToFollow('');
        toast({ title: "Navire ajouté à la liste" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur ajout" });
    }
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayRemove(id)
        });
        toast({ title: "Navire retiré" });
    } catch (e) {
        console.error(e);
    }
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    const isDeactivating = vesselStatus === st;
    const nextStatus = isDeactivating ? 'moving' : st;
    const nextLabel = isDeactivating ? null : (label || null);

    setVesselStatus(nextStatus);
    updateVesselInFirestore({ status: nextStatus, eventLabel: nextLabel });
    
    playVesselSound('sonar');

    if (nextStatus === 'moving') {
        immobilityStartTime.current = null;
        setAnchorPos(null);
    }
    
    const labelTitle = label || (st === 'returning' ? 'Retour Maison' : st === 'landed' ? 'À terre' : st === 'emergency' ? 'Demande d\'assistance' : 'Mode Auto');
    toast({ 
        title: isDeactivating ? "Mode Normal (Auto) Réactivé" : labelTitle
    });
  };

  const handleTacticalSignal = (label: string, photoUrl?: string) => {
    if (!user || !firestore || !currentPos) return;
    
    const newMarker: HuntingMarker = {
        id: Math.random().toString(36).substring(2, 9),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date().toISOString(),
        label: label,
        photoUrl: photoUrl
    };

    updateVesselInFirestore({ 
        eventLabel: photoUrl ? 'PRISE PHOTO' : label,
        huntingMarkers: arrayUnion(newMarker) as any
    });
    
    if (vesselPrefs.notifySettings.tactical) {
        const isLoop = !!vesselPrefs.notifyLoops?.tactical;
        playVesselSound(vesselPrefs.notifySounds.tactical || 'sonar', isLoop);
    }
    toast({ title: photoUrl ? "Photo partagée !" : "Signalement envoyé", description: label });
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPos) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleTacticalSignal('PRISE', base64);
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
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

  const handleClearHistory = async (type: 'tech' | 'tactical') => {
    if (type === 'tech') setTechHistory([]);
    else setTacticalHistory([]);

    if (!firestore || !user) return;
    try {
        if (isSharing) {
            const updatePayload: any = {
                [type === 'tech' ? 'historyClearedAt' : 'tacticalClearedAt']: serverTimestamp()
            };
            if (type === 'tactical') {
                updatePayload.huntingMarkers = [];
                updatePayload.eventLabel = null;
            }
            await updateDoc(doc(firestore, 'vessels', sharingId), updatePayload);
        }
        toast({ title: "Journal effacé" });
    } catch (e) {}
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  useEffect(() => {
    if (!followedVessels) return;

    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const statusTime = vessel.statusChangedAt || vessel.lastActive;
        const currentBattery = vessel.batteryLevel ?? 100;
        const currentCharging = vessel.isCharging ?? false;
        const accuracy = vessel.accuracy || 0;
        const isGhost = vessel.isGhostMode === true;
        const isSelf = vessel.id === sharingId;
        
        const getTimeMillis = (t: any) => {
            if (!t) return 0;
            if (typeof t.toMillis === 'function') return t.toMillis();
            if (typeof t.getTime === 'function') return t.getTime();
            if (t.seconds) return t.seconds * 1000;
            return 0;
        };

        const timeKey = getTimeMillis(statusTime);
        const techClearTime = getTimeMillis(vessel.historyClearedAt);
        const tactClearTime = getTimeMillis(vessel.tacticalClearedAt);

        if (techClearTime > (lastClearTimesRef.current[vessel.id + '_tech'] || 0)) {
            setTechHistory(prev => prev.filter(h => h.vesselId !== vessel.id));
            lastClearTimesRef.current[vessel.id + '_tech'] = techClearTime;
        }
        if (tactClearTime > (lastClearTimesRef.current[vessel.id + '_tact'] || 0)) {
            setTacticalHistory(prev => prev.filter(h => h.vesselId !== vessel.id));
            lastClearTimesRef.current[vessel.id + '_tact'] = tactClearTime;
        }

        // TACTICAL JOURNAL: Ghost Mode hides tactical markers too, unless emergency
        if ((!isGhost || currentStatus === 'emergency' || isSelf) && vessel.huntingMarkers) {
            vessel.huntingMarkers.forEach(marker => {
                const markerTime = new Date(marker.time).getTime();
                if (markerTime > (lastTacticalUpdatesRef.current[marker.id] || 0) && markerTime > tactClearTime) {
                    setTacticalHistory(prev => {
                        if (prev.some(h => h.id === marker.id)) return prev;
                        return [{ 
                            id: marker.id,
                            vesselId: vessel.id,
                            vesselName: vessel.displayName || vessel.id, 
                            label: marker.label!, 
                            time: new Date(marker.time), 
                            pos: { lat: marker.lat, lng: marker.lng },
                            photoUrl: marker.photoUrl
                        }, ...prev].slice(0, 50);
                    });
                    lastTacticalUpdatesRef.current[marker.id] = markerTime;
                    
                    if (!isSelf && vesselPrefs.notifySettings.tactical) {
                        const isLoop = !!vesselPrefs.notifyLoops?.tactical;
                        playVesselSound(vesselPrefs.notifySounds.tactical || 'sonar', isLoop);
                    }
                }
            });
        }

        if (timeKey === 0) return;
        
        // TECHNICAL JOURNAL: Skip if ghost and not emergency
        if (isGhost && currentStatus !== 'emergency' && !isSelf) return;

        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;
        const lastBattery = lastBatteryLevelsRef.current[vessel.id] ?? 100;
        const lastHistMin = lastHistoryMinutesRef.current[vessel.id] ?? -1;
        
        const pos = { 
            lat: vessel.location?.latitude || INITIAL_CENTER.lat, 
            lng: vessel.location?.longitude || INITIAL_CENTER.lng 
        };

        const statusLabels: Record<string, string> = { 
            moving: 'EN MOUVEMENT', 
            stationary: 'AU MOUILLAGE', 
            offline: 'SIGNAL PERDU',
            returning: 'RETOUR MAISON',
            landed: 'À TERRE (HOME)',
            emergency: 'DEMANDE D\'ASSISTANCE'
        };

        const statusStart = getTimeMillis(vessel.statusChangedAt || vessel.lastActive);
        const durationMin = statusStart > 0 ? Math.floor((Date.now() - statusStart) / 60000) : 0;

        const statusChanged = lastStatus !== currentStatus;
        const minutePassed = durationMin > lastHistMin;

        if (statusChanged || (minutePassed && isSharingActive)) {
            let label = statusLabels[currentStatus] || currentStatus;
            
            // Special tag if visibility restored via emergency
            if (isGhost && currentStatus === 'emergency') {
                label = "DEMANDE D'ASSISTANCE (REPRISE VISIBILITÉ)";
            }

            setTechHistory(prev => {
                const alreadyAdded = prev.length > 0 && 
                                   prev[0].statusLabel === label && 
                                   prev[0].vesselId === vessel.id && 
                                   Math.abs(prev[0].time.getTime() - Date.now()) < 5000;
                if (alreadyAdded) return prev;
                return [{ 
                    vesselId: vessel.id,
                    vesselName: vessel.displayName || vessel.id, 
                    statusLabel: label, 
                    time: new Date(), 
                    pos, 
                    batteryLevel: currentBattery, 
                    isCharging: currentCharging, 
                    accuracy,
                    statusDurationMin: durationMin 
                }, ...prev].slice(0, 50);
            });
            
            if (lastStatus && statusChanged && vesselPrefs.isNotifyEnabled && !isSelf) {
                const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : currentStatus;
                if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) {
                    const isLoop = !!vesselPrefs.notifyLoops?.[soundKey as keyof typeof vesselPrefs.notifyLoops];
                    playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar', isLoop);
                }
            }
            lastStatusesRef.current[vessel.id] = currentStatus;
            lastUpdatesRef.current[vessel.id] = timeKey;
            lastHistoryMinutesRef.current[vessel.id] = durationMin;
        }

        const batteryDropped = lastBattery >= (vesselPrefs.batteryThreshold || 20) && currentBattery < (vesselPrefs.batteryThreshold || 20);
        if (batteryDropped && vesselPrefs.notifySettings.battery && !isSelf) {
            if (vesselPrefs.isNotifyEnabled) {
                const isLoop = !!vesselPrefs.notifyLoops?.battery;
                playVesselSound(vesselPrefs.notifySounds.battery || 'alerte', isLoop);
            }
        }

        lastBatteryLevelsRef.current[vessel.id] = currentBattery;
        lastChargingStatesRef.current[vessel.id] = currentCharging;
    });
  }, [followedVessels, vesselPrefs, playVesselSound, sharingId]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        const roundedAccuracy = Math.round(accuracy);
        
        setCurrentPos(newPos);
        setUserAccuracy(roundedAccuracy);

        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        
        if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
            if (!anchorPos) { 
              setAnchorPos(newPos); 
              updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving', isSharing: true, accuracy: roundedAccuracy }); 
              return; 
            }
            
            const distFromAnchor = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
            const isMoving = distFromAnchor > (vesselPrefs.mooringRadius || 20) && distFromAnchor > accuracy * 0.8;

            if (isMoving) {
              setVesselStatus('moving'); 
              setAnchorPos(newPos); 
              immobilityStartTime.current = null;
              updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving', isSharing: true, eventLabel: null, accuracy: roundedAccuracy, anchorLocation: null });
            } else {
              if (!immobilityStartTime.current) {
                  immobilityStartTime.current = Date.now();
                  updateVesselInFirestore({ eventLabel: 'ANALYSE IMMOBILITÉ...', accuracy: roundedAccuracy });
              }
              if (Date.now() - immobilityStartTime.current > 15000 && vesselStatus !== 'stationary') {
                setVesselStatus('stationary'); 
                updateVesselInFirestore({ 
                    status: 'stationary', 
                    eventLabel: null, 
                    accuracy: roundedAccuracy,
                    anchorLocation: { latitude: anchorPos.lat, longitude: anchorPos.lng }
                });
              } else {
                updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
              }
            }
        } else {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map, toast, vesselStatus, vesselPrefs.mooringRadius]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
      updateVesselInFirestore({}); 
    }, 60000);
    return () => clearInterval(interval);
  }, [isSharing, mode, updateVesselInFirestore]);

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
    if (!isEmergencyEnabled) {
        toast({ variant: "destructive", title: "Service désactivé", description: "Veuillez activer les réglages d'urgence." });
        return;
    }
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    
    const timeStr = format(new Date(), 'HH:mm');
    const accuracyStr = userAccuracy ? ` (+/- ${userAccuracy}m)` : "";
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    const body = `${nicknamePrefix}${customText} [${type}] à ${timeStr}. Position${accuracyStr} : ${posUrl}`;
    
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const smsPreview = useMemo(() => {
    const timeStr = format(new Date(), 'HH:mm');
    const accuracyStr = userAccuracy ? ` (+/- ${userAccuracy}m)` : "";
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    return `${nicknamePrefix}${customText} [MAYDAY] à ${timeStr}. Position${accuracyStr} : https://www.google.com/maps?q=-22.27,166.45`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname, userAccuracy]);

  const activeVesselInfo = useMemo(() => {
    const v = followedVessels?.find(v => v.id === sharingId);
    if (!v) return null;
    const getTimeMillis = (t: any) => {
        if (!t) return 0;
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (typeof t.getTime === 'function') return t.getTime();
        if (t.seconds) return t.seconds * 1000;
        return 0;
    };
    const statusStart = getTimeMillis(v.statusChangedAt || v.lastActive);
    const duration = statusStart > 0 ? Math.floor((Date.now() - statusStart) / 60000) : 0;
    return { ...v, durationMin: duration };
  }, [followedVessels, sharingId]);

  const NotificationSettingsUI = () => (
    <div className="space-y-6 p-4 border-2 rounded-2xl bg-card shadow-inner">
        <div className="flex items-center justify-between border-b border-dashed pb-3">
            <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Alertes Audio</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux sonores globaux</p></div>
            <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
        </div>
        
        <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Volume2 className="size-3" /> Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
            <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
        </div>

        <div className="space-y-4 p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-xs font-black uppercase text-orange-800">Veille Stratégique</Label>
                    <p className="text-[9px] font-bold text-orange-600/60 uppercase">Alarme si immobile (mouillage) trop longtemps</p>
                </div>
                <Switch 
                    checked={vesselPrefs.isWatchEnabled} 
                    onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isWatchEnabled: v })} 
                />
            </div>
            
            <Separator className="bg-orange-100/50" />

            <div className={cn("space-y-4", !vesselPrefs.isWatchEnabled && "opacity-40 pointer-events-none")}>
                <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label>
                    <Badge variant="outline" className="font-black bg-white border-orange-200 text-orange-800 h-7 px-3 text-xs">
                        {vesselPrefs.watchDuration >= 60 ? `${Math.floor(vesselPrefs.watchDuration / 60)}h` : `${vesselPrefs.watchDuration}m`}
                    </Badge>
                </div>
                <Slider 
                    value={[vesselPrefs.watchDuration || 60]} 
                    min={60} 
                    max={1440} 
                    step={60}
                    onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} 
                />
                <div className="flex justify-between text-[8px] font-black uppercase opacity-40 px-1">
                    <span>1h</span>
                    <span>24h</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-black uppercase text-orange-800/60">Son de l'alarme</span>
                    <div className="flex gap-2 flex-1 justify-end items-center">
                        <Select 
                            value={vesselPrefs.watchSound} 
                            onValueChange={v => setVesselPrefs(prev => ({ ...prev, watchSound: v }))}
                        >
                            <SelectTrigger className="h-9 text-[10px] font-black uppercase w-32 bg-white border-orange-200">
                                <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-orange-600 border border-orange-200" onClick={() => playVesselSound(vesselPrefs.watchSound, true)}>
                            <Play className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4 p-4 border-2 rounded-2xl bg-red-50/30 border-red-100 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-xs font-black uppercase text-red-800">Seuil Batterie Faible</Label>
                    <p className="text-[9px] font-bold text-red-600/60 uppercase">Alerte journal de bord</p>
                </div>
                <Badge variant="outline" className="font-black bg-white border-red-200 text-red-800 h-7 px-3 text-xs">{vesselPrefs.batteryThreshold || 20}%</Badge>
            </div>
            <Slider 
                value={[vesselPrefs.batteryThreshold || 20]} 
                min={5} 
                max={50} 
                step={5}
                onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batteryThreshold: v[0] })} 
            />
        </div>

        <div className="grid gap-3 pt-4 border-t border-dashed">
            <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Sons individuels</p>
            {[
                { key: 'moving', label: 'Mouvement', color: 'text-blue-600' },
                { key: 'stationary', label: 'Mouillage', color: 'text-amber-600' },
                { key: 'offline', label: 'Signal Perdu', color: 'text-red-600' },
                { key: 'emergency', label: 'Assistance', color: 'text-red-600' },
                { key: 'tactical', label: 'Signalement Tactique', color: 'text-primary' },
                { key: 'battery', label: 'Batterie Faible', color: 'text-red-600' }
            ].map(ev => (
                <div key={ev.key} className={cn("p-3 rounded-xl border-2 flex flex-col gap-3 transition-all", vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings] ? "bg-white" : "bg-muted/30 opacity-60")}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Bell className={cn("size-3", ev.color)} /><span className="text-[10px] font-black uppercase">{ev.label}</span></div>
                        <Switch checked={vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings]} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, notifySettings: { ...vesselPrefs.notifySettings, [ev.key]: v } })} className="scale-75" />
                    </div>
                    <div className="flex gap-2 items-center">
                        <Select disabled={!vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings]} value={vesselPrefs.notifySounds[ev.key as keyof typeof vesselPrefs.notifySounds]} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [ev.key]: v } })}>
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-1"><SelectValue placeholder="Son..." /></SelectTrigger>
                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 bg-muted/10 px-2 py-1 rounded-lg border">
                            <span className="text-[8px] font-black uppercase opacity-60">Boucle</span>
                            <Switch 
                                checked={!!vesselPrefs.notifyLoops?.[ev.key]} 
                                onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, notifyLoops: { ...vesselPrefs.notifyLoops, [ev.key]: v } })} 
                                className="scale-50"
                                disabled={!vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings]}
                            />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 border" onClick={() => playVesselSound(vesselPrefs.notifySounds[ev.key as keyof typeof vesselPrefs.notifySounds], !!vesselPrefs.notifyLoops?.[ev.key])}><Play className="size-3" /></Button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {showLoopAlert && (
          <div className="fixed top-0 left-0 right-0 z-[999] p-4 bg-red-600 text-white shadow-2xl animate-in slide-in-from-top duration-500">
              <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-full animate-pulse">
                          <Volume2 className="size-6" />
                      </div>
                      <div className="flex flex-col">
                          <span className="text-sm font-black uppercase tracking-tighter">Alarme Active</span>
                          <span className="text-[10px] font-bold opacity-80 uppercase leading-none">Signal en boucle</span>
                      </div>
                  </div>
                  <Button 
                    onClick={stopAllSounds} 
                    className="bg-white text-red-600 hover:bg-white/90 font-black uppercase text-xs h-12 px-6 shadow-lg gap-2"
                  >
                      <VolumeX className="size-4" /> ARRÊTER LE SON
                  </Button>
              </div>
          </div>
      )}

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
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white", 
                        vesselStatus === 'landed' ? "bg-green-600 border-green-400/20" : 
                        vesselStatus === 'emergency' ? "bg-red-600 border-red-400/20 animate-pulse" :
                        "bg-primary border-primary-foreground/20")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif
                                </p>
                                {isGhostMode && <Badge variant="outline" className="bg-black/20 text-white border-white/30 text-[8px] font-black uppercase gap-1"><Ghost className="size-2.5"/> Fantôme</Badge>}
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 space-y-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[10px] px-3 h-6 animate-pulse">EN LIGNE</Badge>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                    {vesselStatus === 'moving' ? <Move className="size-3" /> : vesselStatus === 'returning' ? <Navigation className="size-3" /> : vesselStatus === 'landed' ? <Home className="size-3" /> : vesselStatus === 'emergency' ? <ShieldAlert className="size-3" /> : <Anchor className="size-3" />}
                                    {vesselStatus === 'moving' ? 'En mouvement' : vesselStatus === 'returning' ? 'Retour Maison' : vesselStatus === 'landed' ? 'À terre' : vesselStatus === 'emergency' ? 'EN DÉTRESSE' : 'Au mouillage'}
                                </span>
                            </div>
                            {activeVesselInfo && (
                                <div className="flex flex-col pl-1">
                                    <span className="text-[10px] font-black uppercase text-blue-200">ACTIF {activeVesselInfo.durationMin} MIN</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2"><Zap className="size-3" /> Signalisation manuelle</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant={vesselStatus === 'returning' ? 'default' : 'outline'} 
                                className={cn("h-14 font-black uppercase text-[10px] border-2 transition-all active:scale-[0.98] gap-2", 
                                    vesselStatus === 'returning' ? "bg-blue-600 text-white border-blue-400" : "bg-background border-slate-200")} 
                                onClick={() => handleManualStatus('returning')}
                            >
                                <Navigation className={cn("size-4", vesselStatus === 'returning' ? "text-white" : "text-blue-600")} /> 
                                {vesselStatus === 'returning' ? "ANNULER RETOUR" : "Retour Maison"}
                            </Button>
                            <Button 
                                variant={vesselStatus === 'landed' ? 'default' : 'outline'} 
                                className={cn("h-14 font-black uppercase text-[10px] border-2 transition-all active:scale-[0.98] gap-2", 
                                    vesselStatus === 'landed' ? "bg-green-600 text-white border-green-400" : "bg-background border-slate-200")} 
                                onClick={() => handleManualStatus('landed')}
                            >
                                <Home className={cn("size-4", vesselStatus === 'landed' ? "text-white" : "text-green-600")} /> 
                                {vesselStatus === 'landed' ? "ANNULER HOME" : "Home (À terre)"}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2"><Fish className="size-3" /> Signalement Tactique (Flotte)</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {TACTICAL_TYPES.map(t => (
                                <Button 
                                    key={t.id} 
                                    variant="outline" 
                                    className={cn("h-12 flex-col gap-1 p-1 border-2 font-black text-[8px] uppercase transition-all active:scale-95", t.color)}
                                    onClick={() => handleTacticalSignal(t.label)}
                                >
                                    <t.icon className="size-4" />
                                    {t.label}
                                </Button>
                            ))}
                            <Button 
                                variant="outline" 
                                className="h-12 flex-col gap-1 p-1 border-2 font-black text-[8px] uppercase transition-all active:scale-95 bg-teal-600 text-white border-teal-400"
                                onClick={() => photoInputRef.current?.click()}
                            >
                                <Camera className="size-4" />
                                PRISE
                            </Button>
                            <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={handlePhotoCapture} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Button 
                            variant="destructive" 
                            className={cn("w-full h-16 text-lg font-black shadow-2xl border-4 uppercase tracking-tighter gap-3 transition-all active:scale-95", 
                                vesselStatus === 'emergency' && "animate-pulse border-red-400 bg-red-700")} 
                            onClick={() => handleManualStatus('emergency', 'DEMANDE D\'ASSISTANCE')}
                        >
                            <ShieldAlert className="size-8" /> 
                            {vesselStatus === 'emergency' ? "ANNULER ASSISTANCE" : "DEMANDE D'ASSISTANCE"}
                        </Button>

                        <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20" onClick={handleStopSharing}>
                            <X className="size-5" /> Arrêter le partage / Quitter
                        </Button>
                    </div>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                        <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                    </div>
                </div>
              )}

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                        <Settings className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Identité & IDS</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="p-4 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-black uppercase flex items-center gap-2">
                                    <Ghost className="size-4 text-slate-600" /> Mode Fantôme
                                </Label>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Masquer ma position sur les cartes distantes</p>
                            </div>
                            <Switch 
                                checked={isGhostMode} 
                                onCheckedChange={(v) => {
                                    setIsGhostMode(v);
                                    if (user && firestore) updateDoc(doc(firestore, 'users', user.uid), { isGhostMode: v });
                                    if (isSharing) updateVesselInFirestore({ isGhostMode: v });
                                }} 
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label>
                            <Input placeholder="EX: CAPITAINE NEMO" value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold h-12 border-2 uppercase bg-muted/20 text-center" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du navire (Partage Individuel)</Label>
                            <div className="flex gap-2">
                                <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1 bg-muted/20" />
                                <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0" onClick={() => handleSaveId(customSharingId, 'vessel')}><Save className="size-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60 text-blue-600">ID Groupe Flotte C (Partage Collectif)</Label>
                            <div className="flex gap-2">
                                <Input placeholder="ID GROUPE EX: SUD-NC" value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1 bg-muted/20 border-blue-100" />
                                <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0 text-blue-600" onClick={() => handleSaveId(customFleetId, 'fleet')}><Save className="size-4" /></Button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-dashed">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[10px] font-black uppercase opacity-60">Rayon de mouillage (m)</Label>
                                <Badge variant="outline" className="font-black text-[10px] bg-white">{vesselPrefs.mooringRadius || 20}m</Badge>
                            </div>
                            <Slider 
                                value={[vesselPrefs.mooringRadius || 20]} 
                                min={10} 
                                max={200} 
                                step={5} 
                                onValueChange={v => saveVesselPrefs({ ...vesselPrefs, mooringRadius: v[0] })} 
                            />
                        </div>

                        {(vesselIdHistory.length > 0 || fleetIdHistory.length > 0) && (
                            <div className="space-y-4 pt-4 border-t border-dashed">
                                <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Historique des IDs</p>
                                <div className="grid gap-2">
                                    {vesselIdHistory.map(id => (
                                        <div key={`hist-v-${id}`} className="flex items-center justify-between p-2 bg-white border-2 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Ship className="size-3 text-primary opacity-40" />
                                                <code className="font-black text-primary text-xs uppercase">{id}</code>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="size-8" onClick={() => setCustomSharingId(id)}><RefreshCw className="size-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="size-8 text-destructive/40" onClick={() => handleRemoveHistoryId(id, 'vessel')}><X className="size-3.5" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                    {fleetIdHistory.map(id => (
                                        <div key={`hist-f-${id}`} className="flex items-center justify-between p-2 bg-blue-50 border-2 border-blue-100 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Users className="size-3 text-blue-600 opacity-40" />
                                                <code className="font-black text-blue-600 text-xs uppercase">{id}</code>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="size-8 text-blue-600" onClick={() => setCustomFleetId(id)}><RefreshCw className="size-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="size-8 text-destructive/40" onClick={() => handleRemoveHistoryId(id, 'fleet')}><X className="size-3.5" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] border-2 gap-2" onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-primary")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sms-urgence" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 border-2 border-orange-100/50 rounded-xl">
                        <Smartphone className="size-4 text-orange-600" />
                        <span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                            <div className="flex items-center justify-between border-b border-dashed pb-3 mb-2">
                                <div className="space-y-0.5"><Label className="text-xs font-black uppercase text-orange-800">Service d'Urgence</Label><p className="text-[9px] font-bold text-orange-600/60 uppercase">Activer le contact SMS</p></div>
                                <Switch checked={isEmergencyEnabled} onCheckedChange={setIsEmergencyEnabled} />
                            </div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Numéro du contact à terre</Label><Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" /></div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between mb-1"><Label className="text-[10px] font-black uppercase opacity-60">Message personnalisé</Label><Switch checked={isCustomMessageEnabled} onCheckedChange={setIsCustomMessageEnabled} className="scale-75" /></div>
                                <Textarea placeholder="Ex: Problème moteur, besoin aide." value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="border-2 font-medium min-h-[120px]" disabled={!isCustomMessageEnabled} />
                            </div>
                            <div className="space-y-2 pt-2 border-t border-dashed">
                                <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1"><Eye className="size-3" /> Aperçu du message :</p>
                                <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] leading-relaxed text-slate-600">"{smsPreview}"</div>
                            </div>
                            <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] shadow-md">Sauvegarder réglages SMS</Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sender-sounds" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                        <Volume2 className="size-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Notifications & Sons</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">
                    {mode === 'receiver' ? 'SUIVRE LE NAVIRE ID' : 'ID GROUPE FLOTTE C'}
                </Label>
                <div className="flex gap-2">
                    <Input 
                        placeholder={mode === 'receiver' ? "ID EX: BATEAU-1" : "ID GROUPE EX: SUD-NC"} 
                        value={vesselIdToFollow} 
                        onChange={e => setVesselIdToFollow(e.target.value)} 
                        className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1 bg-muted/20" 
                    />
                    <Button variant="outline" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVesselToList} disabled={!vesselIdToFollow.trim()}>
                        <Save className="size-4" />
                    </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-40">
                    {mode === 'fleet' ? 'Membres du Groupe' : 'Ma Flotte'} ({followedVessels?.filter(v => v.isSharing).length || 0})
                </Label>
                <div className="grid gap-2">
                    {mode === 'fleet' ? (
                        <>
                            {followedVessels?.filter(v => !v.isGhostMode || v.status === 'emergency').map(vessel => (
                                <div key={vessel.id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm border-primary/20 bg-primary/5")}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary text-white">
                                            <Navigation className="size-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase">{vessel.displayName}</span>
                                            <span className="text-[8px] font-bold uppercase opacity-60">En ligne</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                                    </div>
                                </div>
                            ))}
                            {(!followedVessels || followedVessels.filter(v => !v.isGhostMode || v.status === 'emergency').length === 0) && (
                                <div className="text-center py-8 border-2 border-dashed rounded-xl opacity-40">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Aucun navire visible dans ce groupe</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {savedVesselIds.map(id => {
                                const vessel = followedVessels?.find(v => v.id === id);
                                const isGhost = vessel?.isGhostMode === true;
                                const isEmergency = vessel?.status === 'emergency';
                                const isActive = vessel?.isSharing === true && (!isGhost || isEmergency);
                                return (
                                    <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm", isActive ? "border-primary/20 bg-primary/5" : "opacity-60")}>
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                {isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-xs uppercase">{vessel?.displayName || id}</span>
                                                <span className="text-[8px] font-bold uppercase opacity-60">
                                                    {isActive ? 'En ligne' : (isGhost && !isEmergency ? 'FANTÔME' : 'Déconnecté')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isActive && <BatteryIconComp level={vessel?.batteryLevel} charging={vessel?.isCharging} />}
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveSavedVessel(id)} className="size-8 text-destructive/40 hover:text-destructive border-2"><Trash2 className="size-3" /></Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="receiver-settings" className="border-none">
                  <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                    <Settings className="size-4 text-primary" />
                    <span className="text-[10px] font-black uppercase">Notifications & Sons</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, zoomControl: false, mapTypeControl: false, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.filter(v => v.isSharing && (!v.isGhostMode || v.status === 'emergency' || v.id === sharingId)).map(vessel => (
                    <React.Fragment key={`vessel-group-${vessel.id}`}>
                        {vessel.status === 'stationary' && vessel.anchorLocation && (
                            <Circle
                                center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }}
                                radius={vessel.mooringRadius || 20}
                                options={{
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.1,
                                    strokeColor: '#3b82f6',
                                    strokeOpacity: 0.5,
                                    strokeWeight: 2,
                                    clickable: false,
                                    editable: false,
                                    zIndex: 1
                                }}
                            />
                        )}

                        {vessel.huntingMarkers?.map(marker => {
                            const type = TACTICAL_TYPES.find(t => t.label === marker.label);
                            const Icon = marker.photoUrl ? Camera : (type?.icon || Fish);
                            return (
                                <OverlayView key={marker.id} position={{ lat: marker.lat, lng: marker.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div 
                                        style={{ transform: 'translate(-50%, -100%)' }} 
                                        className="flex flex-col items-center gap-0.5 cursor-pointer group"
                                        onClick={(e) => {
                                            if (marker.photoUrl) {
                                                e.stopPropagation();
                                                setFullscreenImage({ url: marker.photoUrl, title: marker.label || 'PRISE' });
                                            }
                                        }}
                                    >
                                        <div className={cn("px-1.5 py-0.5 rounded text-[8px] font-black text-white shadow-md border whitespace-nowrap", marker.photoUrl ? "bg-teal-600 border-teal-200" : (type?.color || "bg-slate-800 border-white/20"))}>
                                            {marker.label?.toUpperCase()}
                                        </div>
                                        <div className={cn("p-1 rounded-full border-2 border-white shadow-lg", marker.photoUrl ? "bg-teal-600" : (type?.color || "bg-slate-800"))}>
                                            <Icon className="size-3 text-current" />
                                        </div>
                                    </div>
                                </OverlayView>
                            );
                        })}

                        <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 relative">
                                <div className={cn("px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2", 
                                    vessel.status === 'emergency' ? "bg-red-600 border-red-400 animate-pulse" : "bg-slate-900/90 border-white/20")}>
                                  <span className="truncate max-w-[120px]">
                                    {vessel.status === 'emergency' ? '!!! URGENCE !!!' : (vessel.displayName || vessel.id)}
                                    {vessel.eventLabel && ` | ${vessel.eventLabel}`}
                                    {vessel.isGhostMode && vessel.id === sharingId && " (FANTÔME)"}
                                  </span>
                                  <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-2.5" />
                                </div>
                                <div className={cn("p-2 rounded-full border-2 border-white shadow-xl transition-all", 
                                    vessel.status === 'moving' ? "bg-blue-600" : 
                                    vessel.status === 'returning' ? "bg-indigo-600" :
                                    vessel.status === 'landed' ? "bg-green-600" : 
                                    vessel.status === 'emergency' ? "bg-red-600 animate-pulse scale-125 ring-4 ring-red-500/50" :
                                    "bg-amber-600")}>
                                  {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : 
                                   vessel.status === 'emergency' ? <ShieldAlert className="size-5 text-white" /> :
                                   <Navigation className="size-5 text-white" />}
                                </div>
                            </div>
                        </OverlayView>
                    </React.Fragment>
                ))}

                {mode === 'sender' && vesselStatus === 'stationary' && anchorPos && (
                    <Circle
                        center={anchorPos}
                        radius={vesselPrefs.mooringRadius || 20}
                        options={{
                            fillColor: '#3b82f6',
                            fillOpacity: 0.1,
                            strokeColor: '#3b82f6',
                            strokeOpacity: 0.5,
                            strokeWeight: 2,
                            clickable: false,
                            editable: false,
                            zIndex: 1
                        }}
                    />
                )}

                {mode === 'sender' && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><PulsingDot /></OverlayView>}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5 text-primary" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5" /> MAYDAY</Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
                <div className="border rounded-xl bg-muted/10 overflow-hidden">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="history-tech" className="border-none">
                            <div className="flex items-center justify-between px-3 h-12">
                                <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><Settings className="size-3 mr-2"/> Journal Technique</AccordionTrigger>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={() => handleClearHistory('tech')}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                            </div>
                            <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide px-3">
                                {techHistory.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-primary uppercase text-[10px] leading-none">{h.vesselName}</span>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={cn("font-black uppercase text-[10px] masonry-break-words", 
                                                        h.statusLabel.includes('ASSISTANCE') ? 'text-red-600' :
                                                        h.statusLabel.includes('MOUVEMENT') ? 'text-blue-600' :
                                                        h.statusLabel.includes('MOUILLAGE') ? 'text-orange-600' :
                                                        h.statusLabel.includes('RETOUR') ? 'text-indigo-600' :
                                                        h.statusLabel.includes('TERRE') ? 'text-green-600' :
                                                        'text-slate-800')}>
                                                        {h.statusLabel}
                                                    </span>
                                                    {h.statusDurationMin !== undefined && (
                                                        <span className="text-[8px] font-black text-primary uppercase leading-none">ACTIF {h.statusDurationMin} MIN</span>
                                                    )}
                                                </div>
                                                {h.batteryLevel !== undefined && (
                                                    <span className={cn("flex items-center gap-1 px-1.5 py-1 rounded-md text-[8px] font-black border shadow-sm", h.isCharging ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-500 border-slate-200")}>
                                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />{h.batteryLevel}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 font-bold text-muted-foreground/60 uppercase text-[9px]">
                                                <span>{format(h.time, 'HH:mm:ss')}</span>
                                                {h.accuracy !== undefined && <span>• +/- {h.accuracy}m</span>}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 border-2 px-3 text-[9px] font-black uppercase gap-1" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <div className="border rounded-xl bg-primary/5 overflow-hidden">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="history-tactical" className="border-none">
                            <div className="flex items-center justify-between px-3 h-12">
                                <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><Fish className="size-3 mr-2"/> Journal Tactique</AccordionTrigger>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={() => handleClearHistory('tactical')}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                            </div>
                            <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide px-3">
                                {tacticalHistory.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm border-primary/20">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {h.photoUrl ? (
                                                <div 
                                                    className="size-10 rounded-lg bg-teal-50 border border-teal-100 overflow-hidden shrink-0 cursor-pointer"
                                                    onClick={() => setFullscreenImage({ url: h.photoUrl!, title: h.label })}
                                                >
                                                    <img src={h.photoUrl} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            ) : (
                                                <div className="size-10 rounded-lg bg-slate-50 border flex items-center justify-center shrink-0">
                                                    {React.createElement(TACTICAL_TYPES.find(t => t.label === h.label)?.icon || Fish, { className: "size-5 opacity-20" })}
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-primary uppercase truncate">{h.vesselName}</span>
                                                    <Badge className={cn("text-[8px] font-black h-4 px-1", h.photoUrl ? "bg-teal-600" : "bg-primary")}>{h.label}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 font-bold opacity-40">
                                                    <span>{format(h.time, 'HH:mm:ss')}</span>
                                                    <span className="text-[8px] font-mono">{h.pos.lat.toFixed(5)}, {h.pos.lng.toFixed(5)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 border-2" onClick={() => { 
                                                navigator.clipboard.writeText(`${h.pos.lat.toFixed(6)}, ${h.pos.lng.toFixed(6)}`);
                                                toast({ title: "Coordonnées copiées" });
                                            }}>
                                                <Copy className="size-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 border-2 px-3 text-[9px] font-black uppercase gap-1" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                                        </div>
                                    </div>
                                ))}
                                {tacticalHistory.length === 0 && <p className="text-center py-4 text-[9px] font-bold opacity-30 uppercase italic">Aucun signalement tactique</p>}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>

            <Card className="border-2 bg-slate-50/50 shadow-sm rounded-2xl overflow-hidden mt-2">
                <div className="p-3 border-b bg-muted/20 flex items-center gap-2">
                    <Phone className="size-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Annuaire Maritime NC</h3>
                </div>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2 border-b border-red-100 pb-1">
                            <ShieldAlert className="size-3" /> Urgences
                        </h4>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">COSS NC (Mer)</span>
                                <a href="tel:16" className="text-sm font-black flex items-center gap-2 text-slate-800 hover:text-primary transition-colors">
                                    <Phone className="size-3.5 opacity-40" /> 16
                                </a>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">SAMU (Terre)</span>
                                <a href="tel:15" className="text-sm font-black flex items-center gap-2 text-slate-800 hover:text-primary transition-colors">
                                    <Phone className="size-3.5 opacity-40" /> 15
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 border-b border-blue-100 pb-1">
                            <Waves className="size-3" /> Services
                        </h4>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">Météo Marine</span>
                                <a href="tel:366736" className="text-sm font-black flex items-center gap-2 text-slate-800 hover:text-primary transition-colors">
                                    <Phone className="size-3.5 opacity-40" /> 36 67 36
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 border-b border-indigo-100 pb-1">
                            <Ship className="size-3" /> Ports & Marinas
                        </h4>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">Port Autonome (VHF 12)</span>
                                <a href="tel:255000" className="text-sm font-black flex items-center gap-2 text-slate-800 hover:text-primary transition-colors">
                                    <Phone className="size-3.5 opacity-40" /> 25 50 00
                                </a>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </Card>

      <Dialog open={!!fullscreenImage} onOpenChange={(o) => !o && setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] w-full p-0 bg-black border-none rounded-3xl overflow-hidden shadow-2xl z-[200]">
          <div className="relative w-full h-[80vh] flex flex-col">
            <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 z-[210] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md shadow-lg"><X className="size-6" /></button>
            <div className="flex-1 w-full relative flex items-center justify-center">
              {fullscreenImage && <img src={fullscreenImage.url} className="max-w-full max-h-full object-contain animate-in zoom-in-95 duration-300" alt="" />}
            </div>
            <div className="p-6 bg-gradient-to-t from-black/90 to-transparent shrink-0">
              <DialogHeader><DialogTitle className="text-white font-black uppercase tracking-tighter text-xl text-center">{fullscreenImage?.title}</DialogTitle></DialogHeader>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
