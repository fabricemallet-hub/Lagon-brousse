
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
  ChevronDown,
  Pencil,
  Repeat,
  Info
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
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet' | 'both'>('sender');
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
  const [preManualStatus, setPreManualStatus] = useState<VesselStatus['status'] | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isFirstFixRef = useRef<boolean>(true);
  const lastMinutePosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const [secondsUntilUpdate, setSecondsUntilUpdate] = useState(60);

  const [isCatchDialogOpen, setIsCatchDialogOpen] = useState(false);
  const [locallyClearedMarkerIds, setLocallyClearedMarkerIds] = useState<string[]>([]);

  const [idHistory, setIdHistory] = useState<{ id: string, type: 'vessel' | 'group' }[]>([]);

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
    notifySettings: { moving: true, stationary: true, offline: true, emergency: true, birds: true },
    notifySounds: { moving: '', stationary: '', offline: '', emergency: '', birds: '', watch: '', battery: '' },
    repeatSettings: { moving: false, stationary: false, offline: false, emergency: true, watch: true, battery: false },
    isWatchEnabled: false,
    watchType: 'stationary',
    watchDuration: 60,
    watchSound: '',
    batteryThreshold: 20,
    mooringRadius: 20
  });
  
  const [history, setHistory] = useState<{ vesselId: string, vesselName: string, statusLabel: string, statusCategory: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean, durationMinutes?: number }[]>([]);
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
    
    if (mode === 'fleet' && fleetGroupId) {
        return query(collection(firestore, 'vessels'), where('groupId', '==', fleetGroupId.trim().toUpperCase()));
    }

    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) {
        queryIds.push(sharingId);
    }
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing, mode, fleetGroupId]);
  
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

    // Repetition check
    if (type && vesselPrefs.repeatSettings?.[type]) {
        // If an alert is already looping, don't start another one or stop current
        if (loopingAudioRef.current) {
            loopingAudioRef.current.pause();
        }

        const audio = new Audio(sound.url);
        audio.volume = vesselPrefs.vesselVolume;
        audio.loop = true;
        loopingAudioRef.current = audio;
        
        // Define Vignette Appearance
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
        
        audio.play().catch(e => console.error("Audio play blocked", e));
    } else {
        const audio = new Audio(sound.url);
        audio.volume = vesselPrefs.vesselVolume;
        audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, vesselPrefs.repeatSettings, availableSounds]);

  useEffect(() => {
    const saved = localStorage.getItem('lb_vessel_id_history');
    if (saved) {
        try { setIdHistory(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      setIsGhostMode(userProfile.isGhostMode ?? false);
      setVesselNickname(userProfile.vesselNickname || '');
      setCustomSharingId(userProfile.lastVesselId || '');
      if (userProfile.vesselSharingTarget) setSharingTarget(userProfile.vesselSharingTarget);
      if (userProfile.fleetGroupId) setFleetGroupId(userProfile.fleetGroupId);
    }
  }, [userProfile]);

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
  }, [user, firestore, isSharing, sharingId, vesselNickname, currentPos, vesselPrefs.mooringRadius, fleetGroupId, isGhostMode]);

  const handleSaveVessel = () => {
    if (!user || !firestore) return;
    const cleanId = customSharingId.trim().toUpperCase();
    const cleanGroupId = fleetGroupId.trim().toUpperCase();
    
    updateDoc(doc(firestore, 'users', user.uid), { 
        lastVesselId: cleanId,
        fleetGroupId: cleanGroupId,
        vesselPrefs: vesselPrefs,
        vesselSharingTarget: sharingTarget,
        isGhostMode: isGhostMode,
        vesselNickname: vesselNickname,
        emergencyContact,
        vesselSmsMessage,
        isEmergencyEnabled,
        isCustomMessageEnabled
    }).then(() => { 
        const newHistory = [...idHistory];
        if (cleanId && !newHistory.some(h => h.id === cleanId && h.type === 'vessel')) {
            newHistory.unshift({ id: cleanId, type: 'vessel' });
        }
        if (cleanGroupId && !newHistory.some(h => h.id === cleanGroupId && h.type === 'group')) {
            newHistory.unshift({ id: cleanGroupId, type: 'group' });
        }
        const limitedHistory = newHistory.slice(0, 10);
        setIdHistory(limitedHistory);
        localStorage.setItem('lb_vessel_id_history', JSON.stringify(limitedHistory));

        toast({ title: "Identifiants enregistrés" }); 
    });
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setSharingTarget('none');
    setIsTargetMenuOpen(false);
    lastSentStatusRef.current = null;
    const vesselRef = doc(firestore, 'vessels', sharingId);
    setDoc(vesselRef, { isSharing: false, lastActive: serverTimestamp() }, { merge: true })
      .then(() => {
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setCurrentPos(null); setAnchorPos(null); isFirstFixRef.current = true;
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

  const saveVesselPrefs = (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const sendEmergencySms = (type: string) => {
    const pos = currentPos || (selfVesselData?.location ? { lat: selfVesselData.location.latitude, lng: selfVesselData.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "Position inconnue";
    const body = `${vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : ""}${isCustomMessageEnabled ? vesselSmsMessage : "Assistance requise."} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleSharingTargetChange = (target: 'none' | 'receiver' | 'fleet' | 'both') => {
    setSharingTarget(target);
    setIsTargetMenuOpen(false);
    if (target === 'none') {
        handleStopSharing();
    } else {
        setIsSharing(true);
        updateVesselInFirestore({ 
            isSharing: true, 
            isPositionHidden: target === 'receiver',
            isPrivateHidden: target === 'fleet' 
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
        setAnchorPos(currentPos);
    }
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || 'Statut mis à jour' });
  };

  const handleManualToggle = (st: VesselStatus['status'], label: string) => {
    if (vesselStatus !== st) {
        setPreManualStatus(vesselStatus);
        handleManualStatus(st, label);
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
        handleManualStatus('emergency', 'DEMANDE ASSISTANCE (PROBLÈME)');
        if (isGhostMode) handleGhostModeToggle(false);
        sendEmergencySms('MAYDAY');
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

  const handleDeleteMarker = async (marker: any) => {
    if (!user || !firestore) return;
    const vId = marker.vesselId || sharingId;
    if (vId === sharingId) {
        updateDoc(doc(firestore, 'vessels', sharingId), {
            huntingMarkers: arrayRemove(marker)
        });
    } else {
        setLocallyClearedMarkerIds(prev => [...prev, marker.id]);
    }
  };

  const handleForceGpsUpdate = () => {
    if (!isSharing || mode !== 'sender') return;
    
    setSecondsUntilUpdate(60);
    
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
                labelToUpdate = 'À LA DÉRIVE';
            } else {
                statusToUpdate = 'moving';
            }
        }
    }

    const finalLabel = labelToUpdate || `${statusLabels[statusToUpdate]} (MAJ FORCÉE ${format(new Date(), 'HH:mm')})`;
    setVesselStatus(statusToUpdate);
    updateVesselInFirestore({ 
        status: statusToUpdate,
        eventLabel: finalLabel
    });

    lastMinutePosRef.current = currentPos;
    toast({ title: "Point GPS forcé", description: "Position synchronisée avec succès." });
  };

  const handleRemoveIdFromHistory = (id: string, type: 'vessel' | 'group') => {
    const updated = idHistory.filter(h => !(h.id === id && h.type === type));
    setIdHistory(updated);
    localStorage.setItem('lb_vessel_id_history', JSON.stringify(updated));
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
        setSecondsUntilUpdate(60);
        return;
    }

    const interval = setInterval(() => {
        setSecondsUntilUpdate(prev => {
            if (prev <= 1) {
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
                            labelToUpdate = 'À LA DÉRIVE';
                        } else {
                            statusToUpdate = 'moving';
                        }
                    }
                }

                const finalLabel = labelToUpdate || `${statusLabels[statusToUpdate]} (MAJ ${format(new Date(), 'HH:mm')})`;
                setVesselStatus(statusToUpdate);
                updateVesselInFirestore({ 
                    status: statusToUpdate,
                    eventLabel: finalLabel
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
                    statusLabel: label,
                    time: new Date(),
                    durationMinutes: differenceInMinutes(new Date(), new Date(timeKey))
                };
                
                // Trigger Watch alert if enabled and duration exceeded
                if (mode === 'receiver' && vesselPrefs.isWatchEnabled && newHistory[lastEntryIdx].durationMinutes! >= (vesselPrefs.watchDuration || 60)) {
                    // Only play once per hour if already triggered? Or just repeat if loop enabled.
                    if (!activeLoopingAlert || activeLoopingAlert.type !== 'watch') {
                        playVesselSound(vesselPrefs.notifySounds.watch || 'alerte', 'watch', vessel.displayName || vessel.id);
                    }
                }

                return newHistory;
            }

            if (lastStatus !== currentStatus || timeKey > lastUpdate || label.includes('ERREUR')) {
                if (mode !== 'sender' && lastStatus && lastStatus !== currentStatus && vesselPrefs.isNotifyEnabled) {
                    const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : (currentStatus === 'emergency' ? 'emergency' : currentStatus);
                    if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) {
                        playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar', soundKey, vessel.displayName || vessel.id);
                    }
                }
                
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

                // Trigger battery alert
                if (mode === 'receiver' && vessel.batteryLevel !== undefined && vessel.batteryLevel <= (vesselPrefs.batteryThreshold || 20) && !vessel.isCharging) {
                    playVesselSound(vesselPrefs.notifySounds.battery || 'battery', 'battery', vessel.displayName || vessel.id);
                }

                return [newEntry, ...prev].slice(0, 50);
            }
            return prev;
        });

        lastStatusesRef.current[vessel.id] = currentStatus;
        lastUpdatesRef.current[vessel.id] = timeKey;
    });
  }, [followedVessels, mode, vesselPrefs, playVesselSound, activeLoopingAlert]);

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
                const startLabel = `${statusLabels['moving']} (DÉMARRAGE À ${format(new Date(), 'HH:mm')})`;
                updateVesselInFirestore({ status: 'moving', isSharing: true, eventLabel: startLabel });
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

  const handleRemoveSavedVessel = (id: string) => {
    if (!user || !firestore) return;
    updateDoc(doc(firestore, 'users', user.uid), {
        savedVesselIds: arrayRemove(id)
    });
  };

  const filteredHistory = useMemo(() => {
    return history.filter(h => mode !== 'sender' || h.vesselId === sharingId);
  }, [history, mode, sharingId]);

  const filteredTactical = useMemo(() => {
    return tacticalMarkers.filter(m => mode !== 'sender' || m.vesselId === sharingId);
  }, [tacticalMarkers, mode, sharingId]);

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    return `${nicknamePrefix}${customText} [MAYDAY/PAN PAN] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {/* ALERTE VIGNETTE (LOOPING) */}
      {activeLoopingAlert && (
        <div className={cn("fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300", activeLoopingAlert.color)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <Card className="relative w-full max-w-md border-4 border-white shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-[2.5rem]">
                <div className="absolute top-0 right-0 p-10 opacity-10 -translate-y-4 translate-x-4">
                    <activeLoopingAlert.icon className="size-48" />
                </div>
                <CardHeader className="text-center pt-10 pb-6 relative z-10">
                    <div className="mx-auto size-20 rounded-full bg-white/20 flex items-center justify-center border-4 border-white mb-4 animate-pulse">
                        <activeLoopingAlert.icon className="size-10 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase text-white tracking-tighter leading-tight drop-shadow-md">
                        {activeLoopingAlert.title}
                    </CardTitle>
                    <CardDescription className="text-white/80 font-bold uppercase text-xs mt-2 tracking-widest">
                        Navire : {activeLoopingAlert.vesselName || 'Inconnu'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-10 px-8 relative z-10">
                    <p className="text-white font-medium leading-relaxed italic mb-8">
                        "{activeLoopingAlert.message}"
                    </p>
                    <Button 
                        onClick={stopLoopingAlert}
                        className="w-full h-20 text-lg font-black uppercase tracking-widest bg-white text-slate-900 hover:bg-slate-100 shadow-2xl rounded-2xl gap-3"
                    >
                        <Check className="size-8" /> COUPER L'ALARME
                    </Button>
                </CardContent>
            </Card>
        </div>
      )}

      {isSharing && mode === 'sender' && (
          <button 
            onClick={handleForceGpsUpdate}
            className="bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase py-1.5 px-4 rounded-full shadow-lg flex items-center gap-2 transition-all active:scale-95 mx-auto w-fit border-2 border-white/20 cursor-pointer"
          >
              <RefreshCw className={cn("size-3", secondsUntilUpdate < 5 && "animate-spin")} /> 
              MAJ GPS DANS {secondsUntilUpdate}S
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
              {isSharing || isTargetMenuOpen ? (
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

                    {isSharing && (
                        <>
                            <Button 
                                variant="destructive" 
                                className={cn(
                                    "w-full h-14 font-black uppercase text-[11px] gap-3 shadow-lg border-2 border-white/20 transition-all",
                                    vesselStatus === 'emergency' ? "bg-slate-800 hover:bg-slate-900 border-red-500" : "bg-red-400 hover:bg-red-500"
                                )}
                                onClick={handleEmergencyToggle}
                            >
                                <AlertCircle className={cn("size-5", vesselStatus === 'emergency' && "animate-pulse")} /> 
                                {vesselStatus === 'emergency' ? "ANNULER L'ASSISTANCE (ERREUR)" : "DEMANDE ASSISTANCE (PROBLÈME)"}
                            </Button>

                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    variant={vesselStatus === 'returning' ? 'default' : 'outline'} 
                                    className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" 
                                    onClick={() => handleManualToggle('returning', 'RETOUR MAISON')}
                                >
                                    <Navigation className="size-4 text-blue-600" /> Retour Maison
                                </Button>
                                <Button 
                                    variant={vesselStatus === 'landed' ? 'default' : 'outline'} 
                                    className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" 
                                    onClick={() => handleManualToggle('landed', 'À TERRE (HOME)')}
                                >
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
                        </>
                    )}
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

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sender-prefs" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                                <Settings className="size-4 text-primary" />
                                <span className="text-[10px] font-black uppercase">Identité & Surnom</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label>
                                        <Input 
                                            placeholder="EX: CAPITAINE NEMO" 
                                            value={vesselNickname} 
                                            onChange={e => setVesselNickname(e.target.value)} 
                                            className="font-bold text-center h-12 border-2 uppercase w-full" 
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 p-4 bg-primary/5 border-2 rounded-2xl border-dashed">
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black uppercase text-primary ml-1">ID du navire (Partage)</Label>
                                            <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest bg-white" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">ID du groupe Flotte (C)</Label>
                                            <Input placeholder="ID EX: ABCD" value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest bg-white" />
                                        </div>

                                        <div className="space-y-4 p-4 border-2 rounded-2xl bg-blue-50/30 border-blue-100">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-xs font-black uppercase text-blue-800">Rayon de Mouillage</Label>
                                                    <p className="text-[9px] font-bold text-blue-600/60 uppercase">Ajuste la détection de dérive</p>
                                                </div>
                                                <Badge variant="outline" className="font-black bg-white">{vesselPrefs.mooringRadius || 20}m</Badge>
                                            </div>
                                            <Slider 
                                                value={[vesselPrefs.mooringRadius || 20]} 
                                                min={10} max={200} step={5}
                                                onValueChange={v => saveVesselPrefs({ ...vesselPrefs, mooringRadius: v[0] })} 
                                            />
                                            <div className="flex justify-between text-[8px] font-black uppercase opacity-40 px-1">
                                                <span>10m</span>
                                                <span>200m</span>
                                            </div>
                                        </div>

                                        <Button onClick={handleSaveVessel} className="w-full h-14 font-black uppercase tracking-widest shadow-xl gap-2">
                                            <Save className="size-5" /> Enregistrer mes identifiants
                                        </Button>
                                    </div>

                                    {idHistory.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground ml-1">Identifiants récents</p>
                                            <div className="grid gap-2">
                                                {idHistory.map((item, idx) => (
                                                    <div key={`${item.id}-${idx}`} className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                                                        <button 
                                                            className="flex-1 text-left flex items-center gap-2"
                                                            onClick={() => {
                                                                if (item.type === 'vessel') setCustomSharingId(item.id);
                                                                else setFleetGroupId(item.id);
                                                                toast({ title: "ID Sélectionné" });
                                                            }}
                                                        >
                                                            <Badge variant="outline" className={cn("text-[7px] font-black uppercase h-4", item.type === 'vessel' ? "text-primary border-primary/20" : "text-blue-600 border-blue-200")}>
                                                                {item.type === 'vessel' ? 'NAV' : 'GRP'}
                                                            </Badge>
                                                            <span className="font-black text-xs uppercase tracking-wider">{item.id}</span>
                                                        </button>
                                                        <Button variant="ghost" size="icon" className="size-8 text-destructive/40 hover:text-destructive" onClick={() => handleRemoveIdFromHistory(item.id, item.type)}>
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2 gap-2" onClick={toggleWakeLock}>
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
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Numéro d'urgence (Contact à terre)</Label>
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
                                </div>
                                <div className="space-y-2 pt-2 border-t border-dashed">
                                    <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1">
                                        <Eye className="size-3" /> Visualisation du SMS envoyé :
                                    </p>
                                    <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] font-medium leading-relaxed text-slate-600">
                                        "{smsPreview}"
                                    </div>
                                </div>
                                <Button onClick={handleSaveVessel} className="w-full h-12 font-black uppercase tracking-widest gap-2 shadow-md">
                                    <Save className="size-4" /> Enregistrer mes réglages
                                </Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
              )}
            </div>
          ) : mode === 'receiver' ? (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                        <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={() => { handleSaveVessel(); setVesselIdToFollow(''); }} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button>
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
                                    <Button variant="ghost" size="icon" className="size-8 text-destructive/40 hover:text-destructive border-2" onClick={() => handleRemoveSavedVessel(id)}><Trash2 className="size-3" /></Button>
                                </div>
                            )
                        })}
                    </div>
                )}

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="receiver-settings" className="border-none">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                            <Settings className="size-4 text-primary" />
                            <span className="text-[10px] font-black uppercase">Veille Stratégique & Batterie</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-6">
                            <div className="space-y-4 p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-black uppercase text-orange-800">Veille Stratégique</Label>
                                        <p className="text-[9px] font-bold text-orange-600/60 uppercase">Alerte si immobile trop longtemps</p>
                                    </div>
                                    <Switch 
                                        checked={vesselPrefs.isWatchEnabled} 
                                        onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isWatchEnabled: v })} 
                                        className="touch-manipulation"
                                    />
                                </div>
                                
                                <div className={cn("space-y-4 pt-2 border-t border-orange-100 transition-opacity", !vesselPrefs.isWatchEnabled && "opacity-40")}>
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-black uppercase text-orange-800/60">Seuil d'immobilité</Label>
                                        <Badge variant="outline" className="font-black bg-white">{vesselPrefs.watchDuration >= 60 ? `${Math.floor(vesselPrefs.watchDuration / 60)}h` : `${vesselPrefs.watchDuration} min`}</Badge>
                                    </div>
                                    <Slider 
                                        value={[vesselPrefs.watchDuration || 60]} 
                                        min={60} max={1440} step={60}
                                        onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} 
                                        disabled={!vesselPrefs.isWatchEnabled}
                                    />
                                    <div className="flex justify-between text-[8px] font-black uppercase opacity-40 px-1"><span>1h</span><span>24h</span></div>
                                    
                                    <div className="space-y-1.5 pt-2 border-t border-dashed border-orange-200">
                                        <Label className="text-[9px] font-black uppercase text-orange-800/60">Son de l'alerte</Label>
                                        <div className="flex gap-2">
                                            <Select 
                                                value={vesselPrefs.notifySounds.watch || ''} 
                                                onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, watch: v } })}
                                                disabled={!vesselPrefs.isWatchEnabled}
                                            >
                                                <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-white border-2 flex-1"><SelectValue placeholder="Choisir un son..." /></SelectTrigger>
                                                <SelectContent>
                                                    {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className={cn("h-9 w-9 border-2 bg-white", vesselPrefs.repeatSettings?.watch ? "text-primary border-primary/20" : "text-muted-foreground opacity-40")}
                                                onClick={() => {
                                                    const newRepeat = { ...vesselPrefs.repeatSettings, watch: !vesselPrefs.repeatSettings?.watch };
                                                    saveVesselPrefs({ ...vesselPrefs, repeatSettings: newRepeat });
                                                }}
                                            >
                                                <Repeat className="size-3.5" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-9 w-9 border-2 bg-white" onClick={() => playVesselSound(vesselPrefs.notifySounds.watch || '', 'watch', 'Test')} disabled={!vesselPrefs.isWatchEnabled}><Play className="size-3" /></Button>
                                        </div>
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
                                />
                                <div className="space-y-1.5 pt-2 border-t border-dashed border-red-200">
                                    <Label className="text-[9px] font-black uppercase text-red-800/60">Son de l'alerte batterie</Label>
                                    <div className="flex gap-2">
                                        <Select 
                                            value={vesselPrefs.notifySounds.battery || ''} 
                                            onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, battery: v } })}
                                        >
                                            <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-white border-2 flex-1"><SelectValue placeholder="Choisir un son..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className={cn("h-9 w-9 border-2 bg-white", vesselPrefs.repeatSettings?.battery ? "text-primary border-primary/20" : "text-muted-foreground opacity-40")}
                                            onClick={() => {
                                                const newRepeat = { ...vesselPrefs.repeatSettings, battery: !vesselPrefs.repeatSettings?.battery };
                                                saveVesselPrefs({ ...vesselPrefs, repeatSettings: newRepeat });
                                            }}
                                        >
                                            <Repeat className="size-3.5" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-9 w-9 border-2 bg-white" onClick={() => playVesselSound(vesselPrefs.notifySounds.battery || '', 'battery', 'Test')}><Play className="size-3" /></Button>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du groupe Flotte (ex: ABCD)</Label>
                    <div className="flex gap-2">
                        <Input placeholder="ENTREZ L'ID DU GROUPE..." value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest w-full" />
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
                </div>
            </div>
          )}

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="sound-prefs" className="border-none">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                <Bell className="size-4 text-primary" />
                <span className="text-[10px] font-black uppercase">Notifications Sonores</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-6">
                <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-black uppercase">Sons actifs</Label>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Alertes audio en direct</p>
                    </div>
                    <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                  </div>

                  <div className={cn("space-y-4", !vesselPrefs.isNotifyEnabled && "opacity-40 pointer-events-none")}>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
                      <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} step={1} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
                    </div>
                    <div className="grid gap-3">
                      {[
                        { key: 'moving', label: 'MOUVEMENT' },
                        { key: 'stationary', label: 'MOUILLAGE' },
                        { key: 'offline', label: 'SIGNAL PERDU' },
                        { key: 'emergency', label: 'URGENCE' },
                        { key: 'watch', label: 'VEILLE STRAT.' },
                        { key: 'battery', label: 'BATTERIE' }
                      ].map(({key, label}) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase flex-1">{label}</span>
                          <Select value={vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds] || ''} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [key]: v } })}>
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-muted/30"><SelectValue placeholder="Son..." /></SelectTrigger>
                            <SelectContent>
                              {availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-8 w-8 rounded-full", vesselPrefs.repeatSettings?.[key] ? "text-primary bg-primary/10" : "text-muted-foreground opacity-40")}
                            onClick={() => {
                                const newRepeat = { ...vesselPrefs.repeatSettings, [key]: !vesselPrefs.repeatSettings?.[key] };
                                saveVesselPrefs({ ...vesselPrefs, repeatSettings: newRepeat });
                            }}
                          >
                            <Repeat className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playVesselSound(vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds] || '', key, 'Test')}><Play className="size-3" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
                                    marker.type ? "bg-blue-600" : "bg-orange-50"
                                )}>
                                    {marker.type ? <Fish className="size-3 text-white" /> : <Bird className="size-3 text-white" />}
                                </div>
                            </div>
                        </OverlayView>
                    );
                })}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0 flex items-center justify-center rounded-md"><LocateFixed className="size-5 text-primary" /></button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 flex items-center justify-center rounded-md">{isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}</button>
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
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive border-2" onClick={() => handleDeleteMarker(m)}><Trash2 className="size-3.5" /></Button>
                                            </div>
                                        </div>
                                    )) : <div className="text-center py-10 opacity-40 uppercase text-[10px] font-black italic">Aucun signal tactique</div>}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>

      {/* Emergency Numbers Section */}
      <Card className="border-2 border-red-100 bg-red-50/10 shadow-none">
        <CardHeader className="p-4 pb-2 border-b border-red-100">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-800">
            <ShieldAlert className="size-4 text-red-600" /> Numéros d'Urgence (NC)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-red-100">
            {/* SECOURS EN MER (MRCC) */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-700">Secours en Mer (MRCC)</span>
                <a href="tel:196" className="text-sm font-black text-red-600 hover:underline">196 (OU VHF 16)</a>
              </div>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl flex gap-3">
                <Info className="size-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[9px] leading-relaxed italic text-red-900 font-medium">
                  Rappelons qu'en mer, c'est le <strong>CANAL 16</strong> de la VHF qui est le moyen le plus approprié pour donner l'alerte et communiquer avec les sauveteurs, le 196 étant plutôt destiné aux appels effectués depuis la terre ferme.
                </p>
              </div>
            </div>

            {/* SAPEURS-POMPIERS */}
            <div className="p-4 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-700">Sapeurs-Pompiers</span>
              <a href="tel:18" className="text-sm font-black text-slate-900 hover:underline">18</a>
            </div>

            {/* SAMU */}
            <div className="p-4 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-700">Urgences Santé / SAMU</span>
              <div className="flex flex-col items-end">
                <a href="tel:15" className="text-sm font-black text-slate-900 hover:underline">15</a>
                <a href="tel:+687787725" className="text-[10px] font-bold text-slate-500 hover:underline">+687 78.77.25</a>
              </div>
            </div>

            {/* SNSM NOUMÉA */}
            <div className="p-4 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-700">SNSM Nouméa</span>
              <a href="tel:252312" className="text-sm font-black text-slate-900 hover:underline">25.23.12</a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
