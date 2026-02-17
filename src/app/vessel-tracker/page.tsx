'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, deleteDoc, getDoc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
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
  Repeat,
  Bird,
  Fish,
  Flame,
  ChevronDown
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

const tacticalIcons: Record<string, any> = {
    bird: Bird,
    fish: Fish,
    marlin: Zap,
    thon: Fish,
    tazard: Fish,
    wahoo: Fish,
    mahimahi: Fish,
    bonite: Fish,
    sardines: Waves,
    fire: Flame
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

  // --- ÉTATS DU COMPOSANT ---
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [fleetGroupId, setFleetGroupId] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
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
  const lastSentTimeRef = useRef<number>(0);
  const immobilityStartTime = useRef<number | null>(null);

  const currentPosRef = useRef(currentPos);
  const userAccuracyRef = useRef(userAccuracy);
  const vesselStatusRef = useRef(vesselStatus);
  const anchorPosRef = useRef(anchorPos);
  const isSharingRef = useRef(isSharing);

  useEffect(() => { currentPosRef.current = currentPos; }, [currentPos]);
  useEffect(() => { userAccuracyRef.current = userAccuracy; }, [userAccuracy]);
  useEffect(() => { vesselStatusRef.current = vesselStatus; }, [vesselStatus]);
  useEffect(() => { anchorPosRef.current = anchorPos; }, [anchorPos]);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);

  const [receiverSmsNumber, setReceiverSmsNumber] = useState('');
  const [receiverCallNumber, setReceiverCallNumber] = useState('');
  const [receiverCustomMsg, setReceiverSmsMessage] = useState('Requiert assistance immédiate.');
  const [vesselIdForRelay, setVesselIdForRelay] = useState('');

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
  
  const [history, setHistory] = useState<{ vesselId: string, vesselName: string, statusLabel: string, statusCategory: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean, durationMinutes?: number, accuracy?: number, statusStartTime?: number }[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<{ id: string, vesselName: string, label: string, type: string, time: Date, pos: google.maps.LatLngLiteral }[]>([]);
  
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastClearTimesRef = useRef<Record<string, number>>({});
  const lastTacticalClearRef = useRef<Record<string, number>>({});

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

  /**
   * Envoi des données vers Firestore avec throttling pour éviter de saturer le réseau
   * On envoie la position max toutes les 60s SI le statut ne change pas.
   * On envoie INSTANTANÉMENT si le statut change.
   */
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>, forceImmediate = false) => {
    if (!user || !firestore) return;
    const activeSharing = data.isSharing !== undefined ? data.isSharing : isSharingRef.current;
    if (!activeSharing && data.isSharing !== false) return;
    
    const now = Date.now();
    const newStatus = data.status || vesselStatusRef.current;
    const statusChanged = newStatus !== lastSentStatusRef.current;
    const isManualTrigger = data.eventLabel && data.eventLabel.includes('FORCÉ');

    // Throttling : Si même statut et pas forcé, on attend 60s entre deux points GPS
    if (!statusChanged && !forceImmediate && !isManualTrigger && (now - lastSentTimeRef.current < 60000)) {
        return;
    }

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
            isSharing: activeSharing, 
            lastActive: serverTimestamp(),
            mooringRadius: vesselPrefs.mooringRadius || 20,
            groupId: fleetGroupId ? fleetGroupId.toUpperCase() : null,
            isGhostMode: isGhostMode,
            accuracy: userAccuracyRef.current || null,
            status: newStatus,
            ...batteryInfo,
            ...data 
        };

        // Mise à jour du chrono de début de statut si changement réel
        if (data.isSharing === true || statusChanged) {
            updatePayload.statusChangedAt = serverTimestamp();
            lastSentStatusRef.current = newStatus;
        }

        if (!updatePayload.location && currentPosRef.current) {
            updatePayload.location = { latitude: currentPosRef.current.lat, longitude: currentPosRef.current.lng };
        }

        const vesselRef = doc(firestore, 'vessels', sharingId);
        setDoc(vesselRef, updatePayload, { merge: true }).then(() => {
            lastSentTimeRef.current = Date.now();
        }).catch(() => {});
    };
    update();
  }, [user, firestore, sharingId, vesselNickname, vesselPrefs.mooringRadius, fleetGroupId, isGhostMode]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      setIsGhostMode(userProfile.isGhostMode ?? false);
      setVesselNickname(userProfile.vesselNickname || '');
      setCustomSharingId(userProfile.lastVesselId || '');
      if (userProfile.fleetGroupId) setFleetGroupId(userProfile.fleetGroupId);
      if (userProfile.receiverSmsNumber) setReceiverSmsNumber(userProfile.receiverSmsNumber);
      if (userProfile.receiverCallNumber) setReceiverCallNumber(userProfile.receiverCallNumber);
      if (userProfile.receiverCustomMsg) setReceiverSmsMessage(userProfile.receiverCustomMsg);
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
        receiverSmsNumber,
        receiverCallNumber,
        receiverCustomMsg: receiverCustomMsg
    }).then(() => { toast({ title: "Paramètres enregistrés" }); });
  };

  const handleStopSharing = () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    lastSentStatusRef.current = null;
    immobilityStartTime.current = null;
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

  const handleClearTactical = () => {
    setTacticalHistory([]);
    if (isSharing && firestore && user) {
        updateDoc(doc(firestore, 'vessels', sharingId), { tacticalClearedAt: serverTimestamp(), huntingMarkers: [] });
    }
    toast({ title: "Reset Tactique effectué" });
  };

  const addTacticalMarker = (label: string, type: string) => {
    if (!isSharing || !currentPos || !user || !firestore) return;
    const newMarker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: new Date().toISOString(),
        label: label.toUpperCase()
    };
    updateDoc(doc(firestore, 'vessels', sharingId), {
        huntingMarkers: arrayUnion(newMarker),
        eventLabel: `TACTIQUE : ${label.toUpperCase()}`
    }).then(() => {
        playVesselSound('sonar');
        toast({ title: label, description: "Signal envoyé à la flotte" });
    });
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

        const timeKey = getTimeMillis(vessel.lastActive);
        const startTimeKey = getTimeMillis(vessel.statusChangedAt || vessel.lastActive);
        const clearTimeKey = getTimeMillis(vessel.historyClearedAt);
        const tacticalClearKey = getTimeMillis(vessel.tacticalClearedAt);

        if (clearTimeKey > (lastClearTimesRef.current[vessel.id] || 0)) {
            setHistory(prev => prev.filter(h => h.vesselId !== vessel.id));
            lastClearTimesRef.current[vessel.id] = clearTimeKey;
        }

        if (tacticalClearKey > (lastTacticalClearRef.current[vessel.id] || 0)) {
            setTacticalHistory(prev => prev.filter(h => h.vesselName !== (vessel.displayName || vessel.id)));
            lastTacticalClearRef.current[vessel.id] = tacticalClearKey;
        }

        if (vessel.huntingMarkers) {
            vessel.huntingMarkers.forEach(m => {
                setTacticalHistory(prev => {
                    if (prev.some(h => h.id === m.id)) return prev;
                    const type = m.label?.toLowerCase().includes('oiseau') ? 'bird' : 
                                m.label?.toLowerCase().includes('sardine') ? 'sardines' : 'fish';
                    return [{
                        id: m.id,
                        vesselName: vessel.displayName || vessel.id,
                        label: m.label || 'SIGNAL TACTIQUE',
                        type,
                        time: new Date(m.time),
                        pos: { lat: m.lat, lng: m.lng }
                    }, ...prev];
                });
            });
        }

        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastUpdate = lastUpdatesRef.current[vessel.id] || 0;
        const pos = { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
        
        const baseLabel = vessel.eventLabel || statusLabels[currentStatus] || currentStatus.toUpperCase();
        
        if (!baseLabel.includes('TACTIQUE')) {
            setHistory(prev => {
                const lastEntryIdx = prev.findIndex(h => h.vesselId === vessel.id);
                const lastEntry = lastEntryIdx !== -1 ? prev[lastEntryIdx] : null;

                const isManualAction = baseLabel.includes('FORCÉE') || baseLabel.includes('ERREUR') || baseLabel.includes('ASSISTANCE') || baseLabel.includes('REPRISE');
                const wasManualAction = lastEntry?.statusLabel.includes('FORCÉE') || lastEntry?.statusLabel.includes('ERREUR') || lastEntry?.statusLabel.includes('ASSISTANCE') || lastEntry?.statusLabel.includes('REPRISE');

                if (lastEntry && lastEntry.statusCategory === currentStatus && !isManualAction && !wasManualAction) {
                    const newHistory = [...prev];
                    const cleanBaseLabel = lastEntry.statusLabel.split(' (MAJ')[0];
                    newHistory[lastEntryIdx] = {
                        ...lastEntry,
                        statusLabel: `${cleanBaseLabel} (MAJ ${format(new Date(), 'HH:mm')})`,
                        time: new Date(),
                        durationMinutes: differenceInMinutes(new Date(), new Date(startTimeKey)),
                        batteryLevel: vessel.batteryLevel,
                        isCharging: vessel.isCharging
                    };
                    return newHistory;
                }

                if (lastStatus !== currentStatus || timeKey > lastUpdate || isManualAction) {
                    const newEntry = { 
                        vesselId: vessel.id,
                        vesselName: vessel.displayName || vessel.id, 
                        statusLabel: baseLabel, 
                        statusCategory: currentStatus,
                        time: new Date(), 
                        pos, 
                        batteryLevel: vessel.batteryLevel, 
                        isCharging: vessel.isCharging,
                        durationMinutes: differenceInMinutes(new Date(), new Date(startTimeKey)),
                        statusStartTime: startTimeKey
                    };
                    return [newEntry, ...prev].slice(0, 50);
                }
                return prev;
            });
        }

        lastStatusesRef.current[vessel.id] = currentStatus;
        lastUpdatesRef.current[vessel.id] = timeKey;
    });
  }, [followedVessels, mode, vesselPrefs, playVesselSound]);

  /**
   * ALGORITHME DE SURVEILLANCE GPS (ÉMETTEUR)
   * Détection automatique : Mouvement vs Mouillage
   */
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;
    
    const radius = vesselPrefs.mooringRadius || 20;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        const accuracy = Math.round(position.coords.accuracy);
        
        setCurrentPos(newPos);
        setUserAccuracy(accuracy);
        
        if (shouldPanOnNextFix.current && map) { 
            map.panTo(newPos); 
            map.setZoom(15); 
            shouldPanOnNextFix.current = false; 
        }

        const currentStatus = vesselStatusRef.current;
        const currentAnchor = anchorPosRef.current;

        // --- CAS 1 : MODES MANUELS (Priorité Absolue) ---
        if (currentStatus === 'returning' || currentStatus === 'landed' || currentStatus === 'emergency') {
            updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } });
            return;
        }

        // --- CAS 2 : INITIALISATION ANCRE ---
        if (!currentAnchor) {
            setAnchorPos(newPos);
            updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving' }, true);
            return;
        }

        // --- CAS 3 : CALCUL DE LA DISTANCE PAR RAPPORT À L'ANCRE ---
        const dist = getDistance(newPos.lat, newPos.lng, currentAnchor.lat, currentAnchor.lng);

        if (dist > radius) {
            // MOUVEMENT RÉEL DÉTECTÉ (SORTIE DU CERCLE)
            immobilityStartTime.current = null;
            setAnchorPos(newPos); // On déplace l'ancre sur la nouvelle position
            
            if (currentStatus !== 'moving') {
                setVesselStatus('moving');
                updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', eventLabel: null }, true);
            } else {
                updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } });
            }
        } else {
            // IMMOBILITÉ POTENTIELLE (DANS LE CERCLE)
            if (!immobilityStartTime.current) {
                immobilityStartTime.current = Date.now();
                // Feedback silencieux dans le journal pour confirmer la surveillance
                updateVesselInFirestore({ eventLabel: 'ANALYSE IMMOBILITÉ...' }, false);
            }

            // Seuil de confirmation : 20 secondes d'immobilité dans le cercle
            if (Date.now() - immobilityStartTime.current > 20000) {
                if (currentStatus !== 'stationary') {
                    setVesselStatus('stationary');
                    updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'stationary', eventLabel: null }, true);
                } else {
                    updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } });
                }
            } else {
                // On met à jour la position sans changer le statut 'moving'
                updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } });
            }
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, map, toast, vesselPrefs.mooringRadius, updateVesselInFirestore]);

  const handleManualToggle = (st: VesselStatus['status'], label: string) => {
    if (vesselStatus !== st) {
        setPreManualStatus(vesselStatus);
        setVesselStatus(st);
        updateVesselInFirestore({ status: st, eventLabel: label }, true);
    } else {
        const revertTo = preManualStatus || 'moving';
        updateVesselInFirestore({ eventLabel: 'ERREUR INVOLONTAIRE' }, true);
        setTimeout(() => {
            setVesselStatus(revertTo);
            updateVesselInFirestore({ status: revertTo, eventLabel: `${statusLabels[revertTo]} (REPRISE)` }, true);
            setPreManualStatus(null);
        }, 500);
    }
  };

  const handleEmergencyToggle = () => {
    if (vesselStatus !== 'emergency') {
        setPreManualStatus(vesselStatus);
        setVesselStatus('emergency');
        updateVesselInFirestore({ status: 'emergency', eventLabel: 'DEMANDE ASSISTANCE (PROBLÈME)' }, true);
        if (isGhostMode) setIsGhostMode(false);
    } else {
        const revertTo = preManualStatus || 'moving';
        updateVesselInFirestore({ eventLabel: 'ERREUR INVOLONTAIRE' }, true);
        setTimeout(() => {
            setVesselStatus(revertTo);
            updateVesselInFirestore({ status: revertTo, eventLabel: `${statusLabels[revertTo]} (REPRISE)` }, true);
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
    updateVesselInFirestore({ eventLabel: `${statusLabels[vesselStatus]} (POINT FORCÉ)` }, true);
    toast({ title: "Point GPS forcé" });
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
        setSecondsUntilUpdate(prev => {
            if (prev <= 1) {
                updateVesselInFirestore({ eventLabel: null });
                return 60;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSharing, mode, vesselStatus, updateVesselInFirestore]);

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const body = `[${vesselNickname || 'URGENCE'}] ${type} ! Requiert assistance. Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleReceiverRelay = (type: 'SMS' | 'CALL') => {
    const targetVessel = followedVessels?.find(v => v.id === vesselIdForRelay);
    if (!targetVessel && type === 'SMS') { toast({ variant: "destructive", title: "Navire non sélectionné" }); return; }
    if (type === 'CALL') {
        if (!receiverCallNumber) { toast({ variant: "destructive", title: "Numéro d'appel non configuré" }); return; }
        window.location.href = `tel:${receiverCallNumber.replace(/\s/g, '')}`;
    } else {
        if (!receiverSmsNumber) { toast({ variant: "destructive", title: "Numéro SMS non configuré" }); return; }
        const pos = targetVessel?.location;
        const posUrl = pos ? `https://www.google.com/maps?q=${pos.latitude.toFixed(6)},${pos.longitude.toFixed(6)}` : "[INCONNU]";
        const acc = targetVessel?.accuracy ? `+/- ${targetVessel.accuracy}m` : "Inconnue";
        const time = targetVessel?.lastActive ? format(targetVessel.lastActive.toDate(), 'HH:mm') : "--:--";
        const body = `[RELAIS L&B] Navire: ${targetVessel?.displayName || targetVessel?.id}\n${receiverCustomMsg}\nGPS: ${posUrl}\nPrécision: ${acc}\nHeure point: ${time}`;
        window.location.href = `sms:${receiverSmsNumber.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    }
  };

  const saveVesselPrefs = async (newPrefs: any) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayRemove(id) }).catch(() => {});
  };

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

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="tactical-signals" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-primary/5 rounded-xl border-2 border-primary/10">
                                <Zap className="size-4 text-primary" />
                                <span className="text-[10px] font-black uppercase">Signalement Tactique (Oiseaux & Prises)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-blue-600 border-blue-100" onClick={() => addTacticalMarker('OISEAUX', 'bird')}>
                                        <Bird className="size-5" /> Oiseaux
                                    </Button>
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-primary border-primary/10" onClick={() => addTacticalMarker('THON', 'thon')}>
                                        <Fish className="size-5" /> Thon
                                    </Button>
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-orange-600 border-orange-100" onClick={() => addTacticalMarker('MAHI MAHI', 'mahimahi')}>
                                        <Fish className="size-5" /> Mahi Mahi
                                    </Button>
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-primary border-primary/10" onClick={() => addTacticalMarker('TAZARD', 'tazard')}>
                                        <Fish className="size-5" /> Tazard
                                    </Button>
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-primary border-primary/10" onClick={() => addTacticalMarker('WAHOO', 'wahoo')}>
                                        <Fish className="size-5" /> Wahoo
                                    </Button>
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-primary border-primary/10" onClick={() => addTacticalMarker('BONITE', 'bonite')}>
                                        <Fish className="size-5" /> Bonite
                                    </Button>
                                    <Button variant="outline" className="h-14 flex-col gap-1 border-2 font-black uppercase text-[9px] bg-white text-blue-400 border-blue-100" onClick={() => addTacticalMarker('SARDINES / ANCHOIS', 'sardines')}>
                                        <Waves className="size-5" /> Sardines
                                    </Button>
                                </div>
                                <Button variant="ghost" className="w-full h-10 font-black uppercase text-[8px] text-destructive/60 hover:text-destructive border-2 border-dashed border-destructive/10" onClick={handleClearTactical}>
                                    <Trash2 className="size-3 mr-1" /> Reset Tactique (Vider la carte)
                                </Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20" onClick={handleStopSharing}>
                        <X className="size-5" /> Arrêter le partage
                    </Button>
                </div>
              ) : (
                <Button onClick={() => setIsSharing(true)} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base gap-3">
                    <Zap className="size-6 fill-white" /> Lancer le Partage
                </Button>
              )}
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                        <Settings className="size-4" />
                        <span className="text-[10px] font-black uppercase">Identité & IDs</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom</Label><Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="h-12 border-2 font-black text-center uppercase" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID Navire (B)</Label><Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="h-12 border-2 font-black text-center uppercase" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID Groupe Flotte (C)</Label><Input value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="h-12 border-2 font-black text-center uppercase" /></div>
                            <div className="space-y-3 pt-2">
                                <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between">Rayon de Mouillage <span>{vesselPrefs.mooringRadius}m</span></Label>
                                <Slider value={[vesselPrefs.mooringRadius]} min={10} max={200} step={5} onValueChange={v => setVesselPrefs({...vesselPrefs, mooringRadius: v[0]})} />
                            </div>
                            <Button onClick={handleSaveVessel} className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-base">
                                <Save className="size-5 mr-2" /> Enregistrer mes Identifiants
                            </Button>
                        </div>
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
                    <AccordionItem value="receiver-relay" className="border-none">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 border-2 border-orange-100/50 rounded-xl">
                            <ShieldAlert className="size-4 text-orange-600" />
                            <span className="text-[10px] font-black uppercase text-orange-800">Relais Secours & SMS</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-6">
                            <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Navire à secourir (Relais)</Label>
                                    <Select value={vesselIdForRelay} onValueChange={setVesselIdForRelay}>
                                        <SelectTrigger className="h-12 border-2 bg-white font-black uppercase text-xs">
                                            <SelectValue placeholder="Choisir navire..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {followedVessels?.filter(v => v.isSharing).map(v => (
                                                <SelectItem key={v.id} value={v.id} className="text-[10px] font-black uppercase">{v.displayName || v.id}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Numéro Appel</Label>
                                        <Input value={receiverCallNumber} onChange={e => setReceiverCallNumber(e.target.value)} placeholder="196, 18, 15..." className="h-10 border-2 font-black text-center" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Numéro SMS</Label>
                                        <Input value={receiverSmsNumber} onChange={e => setReceiverSmsNumber(e.target.value)} placeholder="Mobile relais..." className="h-10 border-2 font-black text-center" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Message perso (Relais)</Label>
                                    <Textarea value={receiverCustomMsg} onChange={e => setReceiverSmsMessage(e.target.value)} className="border-2 min-h-[80px] text-xs font-medium" />
                                </div>
                                <Button onClick={handleSaveVessel} className="w-full h-10 font-black uppercase text-[9px] tracking-widest gap-2">
                                    <Save className="size-3" /> Sauver les réglages relais
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
                
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="receiver-settings" className="border-none">
                        <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4" /><span className="text-[10px] font-black uppercase">Notifications & Veille</span></AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-6">
                            <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                                <div className="flex items-center gap-2 border-b border-dashed pb-3 mb-2">
                                    <div className="space-y-0.5 flex-1">
                                        <Label className="text-xs font-black uppercase">Alertes Sonores</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux audio</p>
                                    </div>
                                    <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({...vesselPrefs, isNotifyEnabled: v})} />
                                </div>
                                <div className="space-y-3">
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
                                    <Slider value={[vesselPrefs.watchDuration || 60]} min={60} max={1440} step={60} onValueChange={v => setVesselPrefs({...vesselPrefs, watchDuration: v[0]})} />
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
                {followedVessels?.filter(v => v.isSharing && (v.id !== sharingId || mode !== 'sender')).map(vessel => (
                    <React.Fragment key={vessel.id}>
                        {(vessel.status === 'stationary' || vessel.status === 'drifting') && vessel.location && (
                            <Circle 
                                center={{ lat: vessel.location.latitude, lng: vessel.location.longitude }}
                                radius={vessel.mooringRadius || 20}
                                options={{
                                    fillColor: '#3b82f6', fillOpacity: 0.1, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 2, clickable: false, editable: false, zIndex: 1
                                }}
                            />
                        )}
                        <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg flex items-center gap-2">
                                    <span className="truncate max-w-[80px]">{vessel.displayName || vessel.id}</span>
                                    <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                                </div>
                                <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                                    vessel.status === 'moving' ? "bg-blue-600" : 
                                    vessel.status === 'returning' ? "bg-indigo-600" : 
                                    vessel.status === 'landed' ? "bg-green-600" : 
                                    vessel.status === 'stationary' ? "bg-amber-600" : "bg-red-600")}>
                                    {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                                </div>
                            </div>
                        </OverlayView>
                        {vessel.huntingMarkers?.map(m => (
                            <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -50%)' }} className="flex flex-col items-center gap-0.5">
                                    <div className="px-1.5 py-0.5 bg-white/90 backdrop-blur-sm border rounded text-[7px] font-black uppercase shadow-sm mb-0.5 whitespace-nowrap">{m.label}</div>
                                    <div className="p-1.5 rounded-full bg-white border-2 border-primary shadow-lg animate-in zoom-in-50">
                                        {m.label?.toLowerCase().includes('oiseau') ? <Bird className="size-3 text-primary" /> : 
                                         m.label?.toLowerCase().includes('sardine') ? <Waves className="size-3 text-primary" /> :
                                         <Fish className="size-3 text-primary" />}
                                    </div>
                                </div>
                            </OverlayView>
                        ))}
                    </React.Fragment>
                ))}
                {mode === 'sender' && currentPos && (
                    <>
                        {vesselStatus === 'stationary' && anchorPos && (
                            <Circle 
                                center={anchorPos}
                                radius={vesselPrefs.mooringRadius || 20}
                                options={{
                                    fillColor: '#3b82f6', fillOpacity: 0.1, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 2, clickable: false, editable: false, zIndex: 1
                                }}
                            />
                        )}
                        <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div className="relative">
                                <PulsingDot />
                                {vesselStatus === 'stationary' && (
                                    <div style={{ transform: 'translate(-50%, -100%)' }} className="absolute -top-4 flex flex-col items-center gap-1">
                                        <div className="px-2 py-1 bg-amber-600 text-white rounded text-[8px] font-black shadow-lg">MOUILLAGE</div>
                                        <div className="p-1.5 bg-amber-600 rounded-full border-2 border-white shadow-xl">
                                            <Anchor className="size-3 text-white" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </OverlayView>
                    </>
                )}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="h-10 w-10 p-0"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="h-10 w-10" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                {mode === 'sender' ? (
                    <>
                        <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5" /> MAYDAY</Button>
                        <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
                    </>
                ) : (
                    <>
                        <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => handleReceiverRelay('CALL')}><ShieldAlert className="size-5" /> APPEL SECOURS</Button>
                        <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => handleReceiverRelay('SMS')}><Smartphone className="size-5 text-primary" /> ENVOI SMS</Button>
                    </>
                )}
            </div>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history" className="border-none">
                    <div className="flex items-center justify-between px-3 h-12 bg-muted/10 rounded-xl">
                        <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0">Journal de bord unifié</AccordionTrigger>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHistory}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                    </div>
                    <AccordionContent className="space-y-2 pt-4 px-1 max-h-64 overflow-y-auto">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-muted-foreground ml-1">Technique (Statuts)</p>
                                {history.length > 0 ? history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-primary">{h.vesselName}</span>
                                                <span className={cn("font-black uppercase", 
                                                    h.statusLabel.includes('ERREUR') ? 'text-orange-600' : 
                                                    h.statusLabel.includes('ANALYSE') ? 'text-blue-400 animate-pulse' :
                                                    h.statusLabel.includes('MOUILLAGE') ? 'text-amber-600' :
                                                    h.statusLabel.includes('MOUVEMENT') ? 'text-blue-600' :
                                                    h.statusLabel.includes('RETOUR') ? 'text-indigo-600' :
                                                    h.statusLabel.includes('TERRE') ? 'text-green-600' : 'text-slate-800')}>
                                                    {h.statusLabel}
                                                </span>
                                                {h.batteryLevel !== undefined && (
                                                    <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 border border-slate-200">
                                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />
                                                        {h.batteryLevel}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 opacity-40 font-bold">
                                                <span>{format(h.time, 'HH:mm:ss')}</span>
                                                {h.durationMinutes !== undefined && <span>• {h.durationMinutes} min</span>}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 text-[9px] border-2 px-3" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}><MapPin className="size-3 mr-1" /> GPS</Button>
                                    </div>
                                )) : <p className="text-center py-2 opacity-20 uppercase text-[8px] font-black italic">Aucun mouvement</p>}
                            </div>
                            <div className="space-y-2 border-t pt-4">
                                <div className="flex justify-between items-center px-1">
                                    <p className="text-[9px] font-black uppercase text-primary">Tactique (Oiseaux & Prises)</p>
                                    <Button variant="ghost" className="h-6 text-[8px] font-black text-destructive" onClick={handleClearTactical}>Reset Tactique</Button>
                                </div>
                                {tacticalHistory.length > 0 ? tacticalHistory.map((h, i) => {
                                    const Icon = tacticalIcons[h.type] || Fish;
                                    return (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white border-2 border-primary/10 rounded-xl text-[10px] shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-primary/5 rounded-lg"><Icon className="size-4 text-primary" /></div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-black text-slate-800 uppercase">{h.label}</span>
                                                    <span className="text-[8px] font-bold opacity-40 uppercase">{h.vesselName} • {format(h.time, 'HH:mm')}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 border-2" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}><MapPin className="size-3" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 border-2" onClick={() => { navigator.clipboard.writeText(`${h.pos.lat}, ${h.pos.lng}`); toast({ title: "GPS Copié" }); }}><Copy className="size-3" /></Button>
                                            </div>
                                        </div>
                                    );
                                }) : <p className="text-center py-2 uppercase text-[8px] font-black italic opacity-20">Aucun signal tactique</p>}
                            </div>
                        </div>
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
                                        onValueChange={v => setVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [item.key]: v } })}
                                    >
                                        <SelectTrigger className="h-8 text-[9px] font-black uppercase border-none bg-transparent p-0 mt-1"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                        <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        className={cn("size-8 flex items-center justify-center rounded-lg border-2 transition-all active:scale-90", vesselPrefs.repeatSettings?.[item.key] ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent")}
                                        onClick={() => setVesselPrefs({ ...vesselPrefs, repeatSettings: { ...vesselPrefs.repeatSettings, [item.key]: !vesselPrefs.repeatSettings?.[item.key] } })}
                                    >
                                        <Repeat className="size-4" />
                                    </button>
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
