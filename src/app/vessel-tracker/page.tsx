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
  Clock
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

const INITIAL_CENTER = { lat: -22.27, lng: 166.45 };
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

export default function VesselTrackerPage() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
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
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const processedEventKeysRef = useRef<Set<string>>(new Set());
  const isFirstFixRef = useRef<boolean>(true);

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
  
  const [history, setHistory] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean }[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastEventsRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastBatteryLevelsRef = useRef<Record<string, number>>({});
  const lastChargingStatesRef = useRef<Record<string, boolean>>({});
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

  useEffect(() => {
    if (mode !== 'receiver' || !vesselPrefs.isWatchEnabled || !followedVessels || activeWatchAlarm) return;

    const interval = setInterval(() => {
        followedVessels.forEach(vessel => {
            if (vessel.isSharing && vessel.status === 'stationary' && vessel.statusChangedAt) {
                const startTime = vessel.statusChangedAt.toMillis ? vessel.statusChangedAt.toMillis() : (vessel.statusChangedAt.seconds ? vessel.statusChangedAt.seconds * 1000 : 0);
                if (startTime === 0) return;
                
                const now = Date.now();
                const diffMinutes = (now - startTime) / (1000 * 60);

                if (diffMinutes >= vesselPrefs.watchDuration) {
                    const soundId = vesselPrefs.watchSound;
                    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
                    if (sound && !activeWatchAlarm) {
                        const audio = new Audio(sound.url);
                        audio.volume = vesselPrefs.vesselVolume;
                        audio.loop = true;
                        audio.play().catch(e => console.error("Alarm play error:", e));
                        setActiveWatchAlarm(audio);
                        toast({ 
                            variant: "destructive", 
                            title: "ALERTE VEILLE !", 
                            description: `${vessel.displayName || vessel.id} est immobile depuis plus de ${Math.floor(diffMinutes / 60)}h.` 
                        });
                    }
                }
            }
        });
    }, 30000); 

    return () => clearInterval(interval);
  }, [mode, vesselPrefs, followedVessels, activeWatchAlarm, availableSounds, toast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('lb_vessel_history_v4');
      const savedClearTimes = localStorage.getItem('lb_vessel_clear_times_v4');
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          const formatted = parsed.map((h: any) => ({
            ...h,
            time: new Date(h.time)
          }));
          setHistory(formatted);
        } catch (e) {
          console.error("Failed to parse history", e);
        }
      }
      if (savedClearTimes) {
        try {
          lastClearTimesRef.current = JSON.parse(savedClearTimes);
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lb_vessel_history_v4', JSON.stringify(history));
      localStorage.setItem('lb_vessel_clear_times_v4', JSON.stringify(lastClearTimesRef.current));
    }
  }, [history]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) {
        setVesselPrefs(prev => ({
          ...prev,
          ...userProfile.vesselPrefs,
          notifySettings: { ...prev.notifySettings, ...userProfile.vesselPrefs.notifySettings },
          notifySounds: { ...prev.notifySounds, ...userProfile.vesselPrefs.notifySounds }
        }));
      }
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

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            lastActive: serverTimestamp(),
            ...batteryInfo,
            ...data 
        };

        if (data.status || lastSentStatusRef.current === null || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
            if (data.status) lastSentStatusRef.current = data.status;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname]);

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
        toast({ variant: 'destructive', title: "Erreur sauvegarde" });
    }
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayRemove(id)
        });
        toast({ title: "Navire retiré" });
    } catch (e) {}
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    if (st === 'moving' || st === 'emergency') {
        immobilityStartTime.current = null;
        setAnchorPos(null);
    }
    toast({ title: label || (st === 'emergency' ? 'ALERTE ASSISTANCE' : 'Statut mis à jour') });
  };

  const handleBirdsSignal = async (targetId?: string) => {
    const vesselId = targetId || sharingId;
    if (!vesselId || !user || !firestore) return;
    if (!currentPos) {
        toast({ variant: "destructive", title: "GPS Requis", description: "Position introuvable." });
        return;
    }

    const now = new Date();
    const timeLabel = format(now, 'HH:mm');
    const newMarker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: timeLabel
    };
    try {
        const vesselRef = doc(firestore, 'vessels', vesselId);
        await updateDoc(vesselRef, {
            huntingMarkers: arrayUnion(newMarker),
            status: 'moving',
            eventLabel: mode === 'sender' ? `CHASSE - OISEAUX À ${timeLabel}` : `CHASSE (SIGNAL B) À ${timeLabel}`,
            statusChangedAt: serverTimestamp()
        });
        toast({ title: "Point de CHASSE marqué" });
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setIsReceiverGpsActive(false);
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    lastSentStatusRef.current = null;
    isFirstFixRef.current = true;
    toast({ title: "Partage arrêté" });
  };

  const handleClearHistory = async () => {
    setHistory([]);
    processedEventKeysRef.current.clear();
    if (typeof window !== 'undefined') localStorage.removeItem('lb_vessel_history_v4');
    if (!firestore || !user) return;
    try {
        if (isSharing) {
            await updateDoc(doc(firestore, 'vessels', sharingId), { 
              historyClearedAt: serverTimestamp(), 
              huntingMarkers: [] 
            });
            lastClearTimesRef.current[sharingId] = Date.now();
            if (typeof window !== 'undefined') localStorage.setItem('lb_vessel_clear_times_v4', JSON.stringify(lastClearTimesRef.current));
        }
        toast({ title: "Journal réinitialisé" });
    } catch (e) {}
  };

  const handleSaveSmsSettings = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled
        });
        toast({ title: "Réglages SMS sauvés" });
    } catch (e) {}
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  useEffect(() => {
    if (!followedVessels) return;

    const newEntries: any[] = [];
    let hasAlert = false;

    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const statusTime = vessel.statusChangedAt || vessel.lastActive;
        const currentEvent = vessel.eventLabel || '';
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
            lastClearTimesRef.current[vessel.id] = clearTimeKey;
        }

        if (timeKey === 0) return;
        
        const eventUniqueKey = `${vessel.id}-${timeKey}-${currentStatus}-${currentEvent}`;
        if (processedEventKeysRef.current.has(eventUniqueKey)) return;
        processedEventKeysRef.current.add(eventUniqueKey);

        const lastStatus = lastStatusesRef.current[vessel.id];
        const lastEvent = lastEventsRef.current[vessel.id] || '';
        
        const statusChanged = lastStatus !== currentStatus;
        const eventChanged = currentEvent !== lastEvent;

        const pos = { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng };
        const statusLabels: Record<string, string> = { moving: 'EN MOUVEMENT', stationary: 'AU MOUILLAGE', offline: 'SIGNAL PERDU', returning: 'RETOUR MAISON', landed: 'À TERRE (HOME)', emergency: 'DEMANDE ASSISTANCE' };

        const label = currentEvent || statusLabels[currentStatus] || currentStatus;
        
        newEntries.push({ 
            vesselName: vessel.displayName || vessel.id, 
            statusLabel: label, 
            time: new Date(), 
            pos, 
            batteryLevel: currentBattery, 
            isCharging: currentCharging 
        });
        
        if (mode === 'receiver' && lastStatus && vesselPrefs.isNotifyEnabled) {
            if (currentStatus === 'emergency' && statusChanged) {
                if (vesselPrefs.notifySettings.emergency) {
                  playVesselSound(vesselPrefs.notifySounds.emergency || 'alerte');
                  hasAlert = true;
                }
            } else if (currentEvent.includes('CHASSE') && eventChanged) {
                if (vesselPrefs.notifySettings.birds) {
                  playVesselSound(vesselPrefs.notifySounds.birds || 'sonar');
                }
            } else if (statusChanged) {
                const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : currentStatus;
                if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) {
                    playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar');
                }
            }
        }
        
        lastStatusesRef.current[vessel.id] = currentStatus;
        lastEventsRef.current[vessel.id] = currentEvent;
        lastUpdatesRef.current[vessel.id] = timeKey;

        const lastBattery = lastBatteryLevelsRef.current[vessel.id] ?? 100;
        if (lastBattery >= (vesselPrefs.batteryThreshold || 20) && currentBattery < (vesselPrefs.batteryThreshold || 20)) {
            if (mode === 'receiver' && vesselPrefs.isNotifyEnabled) {
                playVesselSound(vesselPrefs.batterySound || 'alerte');
            }
        }
        lastBatteryLevelsRef.current[vessel.id] = currentBattery;
        lastChargingStatesRef.current[vessel.id] = currentCharging;
    });

    if (newEntries.length > 0) {
        setHistory(prev => [...newEntries, ...prev].slice(0, 50));
    }
    if (hasAlert) {
        const lastVessel = followedVessels.find(v => v.status === 'emergency');
        if (lastVessel) toast({ variant: 'destructive', title: lastVessel.displayName || lastVessel.id, description: "DEMANDE ASSISTANCE !" });
    }
  }, [followedVessels, mode, vesselPrefs, playVesselSound, toast]);

  useEffect(() => {
    const shouldRunGps = (mode === 'sender' && isSharing) || (mode === 'receiver' && isReceiverGpsActive);
    if (!shouldRunGps || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      if (!shouldRunGps) { 
        setCurrentPos(null);
        isFirstFixRef.current = true;
      }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        
        if (mode === 'sender') {
            const currentST = lastSentStatusRef.current;
            
            if (isFirstFixRef.current) {
                setAnchorPos(newPos);
                updateVesselInFirestore({ 
                    location: { latitude: newPos.lat, longitude: newPos.lng }, 
                    status: 'moving', 
                    isSharing: true,
                    eventLabel: 'MAJ DE LA POSITION'
                });
                immobilityStartTime.current = Date.now(); 
                isFirstFixRef.current = false;
                return;
            }

            if (currentST !== 'returning' && currentST !== 'landed' && currentST !== 'emergency') {
                const dist = getDistance(newPos.lat, newPos.lng, anchorPos!.lat, anchorPos!.lng);
                const now = Date.now();
                const timeDiff = now - (immobilityStartTime.current || 0);

                if (dist > IMMOBILITY_THRESHOLD_METERS) {
                  setVesselStatus('moving'); 
                  setAnchorPos(newPos); 
                  immobilityStartTime.current = null;
                  updateVesselInFirestore({ 
                    location: { latitude: newPos.lat, longitude: newPos.lng }, 
                    status: 'moving', 
                    isSharing: true, 
                    eventLabel: null 
                  });
                } else if (timeDiff > 30000 && currentST !== 'stationary') {
                  setVesselStatus('stationary'); 
                  updateVesselInFirestore({ 
                    status: 'stationary', 
                    eventLabel: null 
                  });
                }
            } else { 
                updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } }); 
            }
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, isReceiverGpsActive, mode, anchorPos, updateVesselInFirestore, map, toast]);

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const handleRecenter = () => {
    let pos = null;
    if (mode === 'sender') { pos = currentPos; } 
    else {
        if (isReceiverGpsActive && currentPos) { pos = currentPos; } 
        else {
            const activeVessel = followedVessels?.find(v => v.isSharing);
            if (activeVessel?.location) { pos = { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude }; }
        }
    }
    if (pos && map) { map.panTo(pos); map.setZoom(15); } 
    else { shouldPanOnNextFix.current = true; if (mode === 'receiver' && !isReceiverGpsActive) setIsReceiverGpsActive(true); }
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!isEmergencyEnabled || !emergencyContact) return;
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    const body = `${nicknamePrefix}${customText} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  if (loadError) return <div className="p-4 text-destructive">Erreur Google Maps.</div>;
  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {activeWatchAlarm && (
        <div className="fixed top-12 left-0 right-0 z-[200] p-4 bg-red-600 animate-pulse text-white shadow-2xl flex flex-col items-center gap-2">
            <p className="font-black text-center uppercase tracking-tighter text-lg">ALERTE : IMMOBILITÉ PROLONGÉE !</p>
            <Button variant="outline" className="bg-white text-red-600 font-black h-12 uppercase w-full border-none shadow-xl" onClick={stopWatchAlarm}>ARRÊTER L'ALARME DE VEILLE</Button>
        </div>
      )}

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
                        vesselStatus === 'landed' ? "bg-green-600 border-green-400/20" : 
                        vesselStatus === 'emergency' ? "bg-red-600 border-red-400/20 animate-pulse" :
                        "bg-primary border-primary-foreground/20")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10 text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage en cours
                            </p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className={cn("border-white/40 text-white font-black text-[10px] px-3 h-6", vesselStatus === 'emergency' ? "bg-red-700 animate-bounce" : "bg-green-500/30 animate-pulse")}>
                              {vesselStatus === 'emergency' ? 'ALERTE ACTIVE' : 'EN LIGNE'}
                            </Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                {vesselStatus === 'moving' ? <Move className="size-3" /> : vesselStatus === 'returning' ? <Navigation className="size-3" /> : vesselStatus === 'landed' ? <Home className="size-3" /> : vesselStatus === 'emergency' ? <AlertCircle className="size-3" /> : <Anchor className="size-3" />}
                                {vesselStatus === 'moving' ? 'En mouvement' : vesselStatus === 'returning' ? 'Retour Maison' : vesselStatus === 'landed' ? 'À terre' : vesselStatus === 'emergency' ? 'Assistance' : 'Au mouillage'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                        <Button variant="destructive" className="w-full h-16 font-black uppercase text-[10px] px-2 leading-tight border-2 border-red-400 gap-3 shadow-md animate-pulse" onClick={() => handleManualStatus('emergency')} disabled={vesselStatus === 'emergency'}>
                            <AlertCircle className="size-6 shrink-0" /> DEMANDE ASSISTANCE (PROBLÈME)
                        </Button>
                        <Button variant="outline" className="w-full h-16 font-black uppercase text-[10px] px-2 leading-tight border-2 bg-blue-50 border-blue-200 gap-3 text-blue-700" onClick={() => handleBirdsSignal()}>
                            <Bird className="size-6 shrink-0 animate-bounce" /> REGROUPEMENT D'OISEAUX (CHASSE)
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('returning')} disabled={vesselStatus === 'returning'}><Navigation className="size-4 text-blue-600" /> Retour</Button>
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('landed')} disabled={vesselStatus === 'landed'}><Home className="size-4 text-green-600" /> À terre</Button>
                        </div>
                        <Button variant="ghost" className="w-full h-12 font-black uppercase text-[10px] border-2 border-dashed gap-2 text-orange-600" onClick={() => handleManualStatus('moving', 'REPRISE MODE AUTO')}><RefreshCw className="size-4" /> REPRISE MODE AUTO</Button>
                    </div>
                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3" onClick={handleStopSharing}><X className="size-5" /> ARRÊTER LE PARTAGE</Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label></div>
                        <Switch checked={isSharing} onCheckedChange={(val) => { if (val) setIsSharing(true); else handleStopSharing(); }} />
                    </div>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sender-prefs" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Identité & Surnom</span></AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du navire</Label><div className="flex gap-2"><Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow" /><Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVessel}><Save className="size-4" /></Button></div></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom</Label><Input placeholder="EX: CAPITAINE NEMO" value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold text-center h-12 border-2 uppercase flex-grow w-full" /></div>
                                <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2 gap-2" onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-primary")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sms-settings" className="border-none mt-2">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 border-2 border-orange-100/50 rounded-xl"><Smartphone className="size-4 text-orange-600" /><span className="text-[10px] font-black uppercase">Réglages SMS Urgence</span></AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-6">
                                <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                                    <div className="flex items-center justify-between"><Label className="text-xs font-black uppercase text-orange-800">Service d'Urgence</Label><Switch checked={isEmergencyEnabled} onCheckedChange={setIsEmergencyEnabled} /></div>
                                    <div className={cn("space-y-4 transition-opacity", !isEmergencyEnabled && "opacity-40 pointer-events-none")}>
                                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Numéro d'urgence</Label><Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" disabled={!isEmergencyEnabled} /></div>
                                        <div className="space-y-1.5"><div className="flex items-center justify-between mb-1"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Message perso</Label><Switch checked={isCustomMessageEnabled} onCheckedChange={setIsCustomMessageEnabled} className="scale-75" /></div><Textarea placeholder="Ex: Problème moteur." value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className={cn("border-2 font-medium min-h-[80px]", !isCustomMessageEnabled && "opacity-50")} disabled={!isEmergencyEnabled || !isCustomMessageEnabled} /></div>
                                    </div>
                                    <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] tracking-widest gap-2 shadow-md"><Save className="size-4" /> Enregistrer</Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" /><Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button></div></div>
              {savedVesselIds.length > 0 && (
                <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Flotte suivie</Label>
                    <div className="grid gap-2">
                        {savedVesselIds.map(id => {
                            const vessel = followedVessels?.find(v => v.id === id);
                            const isActive = vessel?.isSharing === true;
                            return (
                                <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl transition-all shadow-sm cursor-pointer", vessel?.status === 'emergency' ? "bg-red-50 border-red-500 animate-pulse" : isActive ? "bg-primary/5 border-primary/20" : "bg-muted/5 opacity-60")} onClick={() => { if (isActive && vessel.location && map) { map.panTo({ lat: vessel.location.latitude, lng: vessel.location.longitude }); map.setZoom(15); } }}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg", vessel?.status === 'emergency' ? "bg-red-600 text-white" : isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{vessel?.status === 'emergency' ? <AlertCircle className="size-4" /> : isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}</div>
                                        <div className="flex flex-col"><span className="font-black text-xs uppercase tracking-tight">{vessel?.displayName || id}</span><span className={cn("text-[8px] font-bold uppercase", vessel?.status === 'emergency' ? 'URGENCE' : isActive ? 'En ligne' : 'Off')}>{vessel?.status === 'emergency' ? 'URGENCE' : isActive ? 'En ligne' : 'Off'}</span></div>
                                    </div>
                                    <div className="flex items-center gap-2">{isActive && <BatteryIconComp level={vessel?.batteryLevel} charging={vessel?.isCharging} />}<Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveSavedVessel(id); }} className="size-8 text-destructive/40 border-2"><Trash2 className="size-3" /></Button></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              )}
              {followedVessels?.some(v => v.isSharing) && (
                <div className="bg-muted/20 p-4 rounded-2xl border-2 border-dashed space-y-3">
                    {!isReceiverGpsActive ? (
                        <Button variant="outline" className="w-full h-12 font-black uppercase text-[10px] border-primary/20 bg-primary/5 text-primary" onClick={() => { setIsReceiverGpsActive(true); shouldPanOnNextFix.current = true; }}><LocateFixed className="size-4 mr-2" /> Activer mon GPS pour signaler</Button>
                    ) : (
                        <div className="flex items-center justify-between px-1"><span className="text-[9px] font-black uppercase text-green-600 flex items-center gap-1"><LocateFixed className="size-3" /> GPS Actif (Moi)</span><Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase underline" onClick={() => setIsReceiverGpsActive(false)}>Off</Button></div>
                    )}
                    <Button variant="outline" className={cn("w-full h-14 font-black uppercase text-[11px] border-2 bg-blue-50 border-blue-200 gap-3 touch-manipulation", !isReceiverGpsActive && "opacity-40")} onClick={() => { const target = followedVessels.find(v => v.isSharing); if (target) handleBirdsSignal(target.id); }}><Bird className="size-6 animate-bounce" /> SIGNALER OISEAUX (CHASSE)</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.map(vessel => (
                    <React.Fragment key={`vessel-markers-${vessel.id}`}>
                        {vessel.isSharing && (
                            <OverlayView position={{ lat: vessel.location.latitude, lng: vessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className={cn("flex flex-col items-center gap-1", vessel.status === 'emergency' && "animate-pulse")}>
                                <div className={cn("px-2 py-1 rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2", vessel.status === 'emergency' ? "bg-red-600 text-white border-white animate-bounce" : "bg-slate-900/90 text-white border-white/20")}>
                                  <span className="truncate max-w-[80px]">{vessel.displayName || vessel.id}</span>
                                  <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} />
                                </div>
                                <div className={cn("p-2 rounded-full border-2 border-white shadow-xl transition-transform", vessel.status === 'moving' ? "bg-blue-600" : vessel.status === 'returning' ? "bg-indigo-600" : vessel.status === 'landed' ? "bg-green-600" : vessel.status === 'emergency' ? "bg-red-600 scale-125" : "bg-amber-600")}>{vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}</div>
                            </div>
                            </OverlayView>
                        )}
                        {vessel.huntingMarkers?.map(marker => (
                            <OverlayView key={marker.id} position={{ lat: marker.lat, lng: marker.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                    <div className="px-2 py-1 bg-blue-600 text-white rounded text-[9px] font-black shadow-lg border border-white/20 whitespace-nowrap">CHASSE {marker.time}</div>
                                    <div className="p-1.5 bg-blue-500 rounded-full border-2 border-white shadow-md"><Bird className="size-3 text-white" /></div>
                                </div>
                            </OverlayView>
                        ))}
                    </React.Fragment>
                ))}
                {(currentPos || (mode === 'sender' && isSharing)) && (
                    <OverlayView position={currentPos || INITIAL_CENTER} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" /></OverlayView>
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
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
            </div>
            <div className="border rounded-xl bg-muted/10 overflow-hidden">
                <Accordion type="single" collapsible className="w-full" defaultValue="history">
                    <AccordionItem value="history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><div className="flex items-center gap-2"><History className="size-3"/> Journal de bord</div></AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive border border-destructive/20" onClick={(e) => { e.stopPropagation(); handleClearHistory(); }}><Trash2 className="size-3 mr-1" /> Reset</Button>
                        </div>
                        <AccordionContent className="space-y-3 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide">
                            {history.length > 0 ? (
                                <div className="space-y-3 px-3">
                                    {history.map((h, i) => (
                                        <div key={i} className={cn(
                                            "flex flex-col p-3 rounded-xl border-2 text-[10px] shadow-sm animate-in fade-in slide-in-from-left-2 gap-2 transition-colors", 
                                            h.statusLabel.includes('ASSISTANCE') ? "bg-red-50 border-red-200" : "bg-white border-slate-100"
                                        )}>
                                            <div className="flex items-center justify-between border-b border-dashed pb-2">
                                                <span className="font-black text-primary truncate max-w-[120px] uppercase">{h.vesselName}</span>
                                                {h.batteryLevel !== undefined && (
                                                    <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 border border-slate-200">
                                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />
                                                        {h.batteryLevel}%
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                    <span className={cn(
                                                        "font-black uppercase text-[11px] leading-tight break-words", 
                                                        h.statusLabel.includes('ASSISTANCE') ? 'text-red-600' : 
                                                        h.statusLabel.includes('CHASSE') ? 'text-blue-600' : 
                                                        h.statusLabel.includes('POSITION') ? 'text-green-600' : 'text-slate-600'
                                                    )}>
                                                        {h.statusLabel}
                                                    </span>
                                                    <span className="text-[9px] font-bold opacity-40 uppercase">{format(h.time, 'dd/MM HH:mm:ss')}</span>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-9 text-[9px] font-black uppercase border-2 px-3 shrink-0 gap-2 bg-background hover:bg-primary/5 active:scale-95" 
                                                    onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}
                                                >
                                                    <MapPin className="size-3 text-primary" /> GPS
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-40 mx-3"><p className="text-[10px] font-black uppercase tracking-widest">Journal vide</p></div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>
    </div>
  );
}
