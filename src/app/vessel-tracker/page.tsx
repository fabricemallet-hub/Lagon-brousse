
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
  Ghost,
  Timer
} from 'lucide-react';
import { cn, getDistance, getRegionalNow } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

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

type TechHistoryEntry = {
    vesselId: string;
    vesselName: string;
    statusLabel: string;
    startTime: Date;
    lastUpdateTime: Date;
    pos: google.maps.LatLngLiteral;
    batteryLevel?: number;
    isCharging?: boolean;
    accuracy?: number;
};

export default function VesselTrackerPage() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // 1. ÉTATS DE BASE
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet' | 'both'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapZoom, setMapZoom] = useState<number>(10);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [techHistory, setTechHistory] = useState<TechHistoryEntry[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<{url: string, title: string} | null>(null);
  const [showLoopAlert, setShowLoopAlert] = useState(false);

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

  // 2. REFS DE STABILITÉ (Crucial pour éviter les boucles infinies)
  const isSharingRef = useRef(isSharing);
  const vesselStatusRef = useRef(vesselStatus);
  const lastActiveStatusRef = useRef(vesselStatus);
  const anchorPosRef = useRef(anchorPos);
  const vesselNicknameRef = useRef(vesselNickname);
  const isGhostModeRef = useRef(isGhostMode);
  const vesselPrefsRef = useRef(vesselPrefs);
  const watchIdRef = useRef<number | null>(null);
  const lastFixTimeRef = useRef<number>(Date.now());
  const stabilizationRef = useRef<{ p1: google.maps.LatLngLiteral | null, start: number }>({ p1: null, start: 0 });
  const nextCheckTimeRef = useRef<number>(0);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastClearTimesRef = useRef<Record<string, number>>({});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const shouldPanOnNextFix = useRef(false);

  // 3. RÉCUPÉRATION DES DONNÉES (Définies tôt pour éviter les ReferenceError)
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // On suit les navires enregistrés + soi-même si on partage
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
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

  // Sync des refs
  useEffect(() => {
    isSharingRef.current = isSharing;
    vesselStatusRef.current = vesselStatus;
    anchorPosRef.current = anchorPos;
    vesselNicknameRef.current = vesselNickname;
    isGhostModeRef.current = isGhostMode;
    vesselPrefsRef.current = vesselPrefs;
  }, [isSharing, vesselStatus, anchorPos, vesselNickname, isGhostMode, vesselPrefs]);

  // 4. FONCTIONS UTILITAIRES
  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); } }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const stopAllSounds = useCallback(() => {
    if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
    }
    setShowLoopAlert(false);
  }, []);

  const playVesselSound = useCallback((soundId: string, forceLoop: boolean = false) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null; }
    const sound = availableSounds.find(s => s.id === soundId || s.label.toLowerCase() === soundId.toLowerCase());
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.loop = forceLoop;
      activeAudioRef.current = audio;
      if (forceLoop) setShowLoopAlert(true);
      audio.play().catch(e => console.warn("Audio play blocked or failed:", e));
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharingRef.current && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo: any = {};
        if ('getBattery' in navigator) {
            try {
                const b: any = await (navigator as any).getBattery();
                batteryInfo.batteryLevel = typeof b.level === 'number' ? Math.round(b.level * 100) : 100;
                batteryInfo.isCharging = typeof b.charging === 'boolean' ? b.charging : false;
            } catch (e) {}
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNicknameRef.current || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharingRef.current, 
            isGhostMode: data.isGhostMode !== undefined ? data.isGhostMode : isGhostModeRef.current,
            lastActive: serverTimestamp(),
            mooringRadius: vesselPrefsRef.current.mooringRadius || 20,
            ...batteryInfo,
            ...data 
        };

        if (data.status || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, sharingId]);

  // 5. LOGIQUE SENSEUR ET SIGNAL
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      setIsStabilizing(false);
      return;
    }
    
    if (watchIdRef.current === null) {
        setIsStabilizing(true);
        stabilizationRef.current = { p1: null, start: Date.now() };
        nextCheckTimeRef.current = 0;
        lastFixTimeRef.current = Date.now();

        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const newPos = { lat: latitude, lng: longitude };
            const roundedAccuracy = Math.round(accuracy);
            
            lastFixTimeRef.current = Date.now();
            setCurrentPos(newPos);
            setUserAccuracy(roundedAccuracy);

            const now = Date.now();
            const currentStatus = vesselStatusRef.current;
            const currentMooringRadius = vesselPrefsRef.current.mooringRadius || 20;

            if (currentStatus === 'offline') {
                if (roundedAccuracy < 20) {
                    const recoveredStatus = lastActiveStatusRef.current || 'moving';
                    setVesselStatus(recoveredStatus);
                    updateVesselInFirestore({ status: recoveredStatus, eventLabel: 'SIGNAL RETROUVÉ', location: { latitude, longitude }, accuracy: roundedAccuracy });
                    toast({ title: "Signal Rétabli", description: `Précision : ${roundedAccuracy}m` });
                }
                return;
            }

            if (now - stabilizationRef.current.start < 10000) {
                if (!stabilizationRef.current.p1 && roundedAccuracy < 50) stabilizationRef.current.p1 = newPos;
                if (now - stabilizationRef.current.start > 9000 && stabilizationRef.current.p1) {
                    const dist = getDistance(newPos.lat, newPos.lng, stabilizationRef.current.p1.lat, stabilizationRef.current.p1.lng);
                    const initialStatus = dist < currentMooringRadius ? 'stationary' : 'moving';
                    setVesselStatus(initialStatus);
                    anchorPosRef.current = initialStatus === 'stationary' ? stabilizationRef.current.p1 : null;
                    setAnchorPos(anchorPosRef.current);
                    setIsStabilizing(false);
                    updateVesselInFirestore({ 
                        status: initialStatus, 
                        location: { latitude, longitude }, 
                        accuracy: roundedAccuracy,
                        anchorLocation: anchorPosRef.current ? { latitude: anchorPosRef.current.lat, longitude: anchorPosRef.current.lng } : null
                    });
                    nextCheckTimeRef.current = Date.now() + 30000;
                    toast({ title: initialStatus === 'stationary' ? "Au Mouillage" : "En Mouvement" });
                }
                return;
            }

            if (now > nextCheckTimeRef.current) {
                if (currentStatus !== 'returning' && currentStatus !== 'landed' && currentStatus !== 'emergency') {
                    if (anchorPosRef.current) {
                        const distFromAnchor = getDistance(newPos.lat, newPos.lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
                        if (distFromAnchor > 100) {
                            setVesselStatus('moving'); anchorPosRef.current = null; setAnchorPos(null);
                            updateVesselInFirestore({ status: 'moving', location: { latitude, longitude }, accuracy: roundedAccuracy, anchorLocation: null });
                        } else if (distFromAnchor > currentMooringRadius) {
                            if (currentStatus !== 'drifting') {
                                setVesselStatus('drifting');
                                updateVesselInFirestore({ status: 'drifting', eventLabel: 'À LA DÉRIVE !', location: { latitude, longitude }, accuracy: roundedAccuracy });
                            } else {
                                updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
                            }
                        } else {
                            if (currentStatus !== 'stationary') {
                                setVesselStatus('stationary');
                                updateVesselInFirestore({ status: 'stationary', location: { latitude, longitude }, accuracy: roundedAccuracy });
                            } else {
                                updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
                            }
                        }
                    } else {
                        updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
                    }
                } else {
                    updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
                }
                nextCheckTimeRef.current = Date.now() + 30000;
            } else {
                updateVesselInFirestore({ location: { latitude, longitude }, accuracy: roundedAccuracy });
            }
          },
          (err) => console.warn("GPS Sensor Error:", err.message),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }
  }, [isSharing, mode, updateVesselInFirestore, toast]);

  // Watchdog Signal
  useEffect(() => {
    if (!isSharing || mode !== 'sender') return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastFixTimeRef.current;
      const currentStatus = vesselStatusRef.current;
      const currentAccuracy = userAccuracy || 0;
      
      if (currentStatus !== 'offline' && !isStabilizing && (now - stabilizationRef.current.start > 15000)) {
          let shouldGoOffline = false;
          let reason = '';

          if (currentAccuracy > 100 && elapsed > 10000) { shouldGoOffline = true; reason = 'SIGNAL IMPRÉCIS (>100m) + 10s D\'INACTIVITÉ'; }
          else if (elapsed > 60000) { shouldGoOffline = true; reason = 'SIGNAL GPS PERDU (DÉLAI > 1 MIN)'; }

          if (shouldGoOffline) {
              lastActiveStatusRef.current = currentStatus;
              setVesselStatus('offline');
              updateVesselInFirestore({ status: 'offline', eventLabel: reason });
              toast({ variant: "destructive", title: "Signal Perdu", description: reason });
          }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isSharing, mode, updateVesselInFirestore, toast, userAccuracy, isStabilizing]);

  // Journal Technique Sync
  useEffect(() => {
    if (!followedVessels) return;
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const getTimeMillis = (t: any) => { if (!t) return 0; if (typeof t.toMillis === 'function') return t.toMillis(); if (t.seconds) return t.seconds * 1000; return 0; };
        const lastActiveTime = getTimeMillis(vessel.lastActive);
        const isSignalStale = isSharingActive && (Date.now() - lastActiveTime > 70000);
        const currentStatus = (isSharingActive && !isSignalStale) ? (vessel.status || 'moving') : 'offline';
        const isSelf = vessel.id === sharingId;
        const techClearTime = getTimeMillis(vessel.historyClearedAt);

        if (techClearTime > (lastClearTimesRef.current[vessel.id] || 0)) { setTechHistory(prev => prev.filter(h => h.vesselId !== vessel.id)); lastClearTimesRef.current[vessel.id] = techClearTime; }

        const lastStatus = lastStatusesRef.current[vessel.id];
        const statusTime = vessel.statusChangedAt || vessel.lastActive;
        const timeKey = getTimeMillis(statusTime);
        if (timeKey === 0) return;

        if (lastStatus !== currentStatus || timeKey > (lastUpdatesRef.current[vessel.id] || 0)) {
            const labelMap: Record<string, string> = { moving: 'EN MOUVEMENT', stationary: 'AU MOUILLAGE', offline: isSignalStale ? 'SIGNAL PERDU' : (vessel.eventLabel || 'SIGNAL COUPÉ'), returning: 'RETOUR MAISON', landed: 'À TERRE (HOME)', emergency: 'DEMANDE D\'ASSISTANCE', drifting: 'À LA DÉRIVE !' };
            const label = vessel.eventLabel || labelMap[currentStatus] || currentStatus;
            
            if (mode === 'receiver' || !vessel.isGhostMode || currentStatus === 'emergency' || isSelf) {
                setTechHistory(prev => {
                    if (prev.length > 0 && prev[0].statusLabel === label && prev[0].vesselId === vessel.id) {
                        return [{ ...prev[0], lastUpdateTime: new Date(), pos: { lat: vessel.location?.latitude || 0, lng: vessel.location?.longitude || 0 }, batteryLevel: vessel.batteryLevel, isCharging: vessel.isCharging, accuracy: vessel.accuracy }, ...prev.slice(1)];
                    }
                    return [{ vesselId: vessel.id, vesselName: vessel.displayName || vessel.id, statusLabel: label, startTime: new Date(), lastUpdateTime: new Date(), pos: { lat: vessel.location?.latitude || 0, lng: vessel.location?.longitude || 0 }, batteryLevel: vessel.batteryLevel, isCharging: vessel.isCharging, accuracy: vessel.accuracy }, ...prev].slice(0, 50);
                });
                if (lastStatus && lastStatus !== currentStatus && vesselPrefs.isNotifyEnabled && !isSelf) {
                    const soundKey = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : (currentStatus === 'drifting' ? 'emergency' : currentStatus);
                    if (vesselPrefs.notifySettings[soundKey as keyof typeof vesselPrefs.notifySettings]) playVesselSound(vesselPrefs.notifySounds[soundKey as keyof typeof vesselPrefs.notifySounds] || 'sonar', !!vesselPrefs.notifyLoops?.[soundKey as keyof typeof vesselPrefs.notifySettings]);
                }
            }
            lastStatusesRef.current[vessel.id] = currentStatus; lastUpdatesRef.current[vessel.id] = timeKey;
        }
    });
  }, [followedVessels, vesselPrefs, playVesselSound, sharingId, mode, availableSounds]);

  // Autres handlers
  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || (st === 'returning' ? 'Retour Maison' : st === 'landed' ? 'À terre' : 'Statut mis à jour') });
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp(), statusChangedAt: serverTimestamp() }, { merge: true });
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null); anchorPosRef.current = null; setAnchorPos(null); lastSentStatusRef.current = null;
    setIsStabilizing(false);
    toast({ title: "Partage arrêté" });
  };

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: vesselIdToFollow.trim() ? arrayUnion(vesselIdToFollow.trim().toUpperCase()) : savedVesselIds,
            lastVesselId: customSharingId || cleanId
        });
        if (vesselIdToFollow) setVesselIdToFollow('');
        toast({ title: "Enregistré" });
    } catch (e) {}
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayRemove(id) });
        toast({ title: "Retiré" });
    } catch (e) {}
  };

  const handleClearHistory = async () => {
    setTechHistory([]);
    if (!firestore || !user) return;
    try {
        if (isSharing) await updateDoc(doc(firestore, 'vessels', sharingId), { historyClearedAt: serverTimestamp() });
        toast({ title: "Journal effacé" });
    } catch (e) {}
  };

  const sendEmergencySms = (type: string) => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Contact requis" }); return; }
    const pos = currentPos || followedVessels?.find(v => v.isSharing)?.location;
    const posUrl = pos ? `https://www.google.com/maps?q=${(pos as any).latitude || (pos as any).lat},${(pos as any).longitude || (pos as any).lng}` : "[RECHERCHE GPS...]";
    const body = `[${vesselNickname || 'CAPITAINE'}] ${vesselSmsMessage || "Détresse"} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location.latitude, lng: followedVessels.find(v => v.isSharing)!.location.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const NotificationSettingsUI = () => (
    <div className="space-y-6 p-4 border-2 rounded-2xl bg-card shadow-inner">
        <div className="flex items-center justify-between border-b border-dashed pb-3">
            <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Alertes Audio</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Signaux sonores globaux</p></div>
            <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => { const n = { ...vesselPrefs, isNotifyEnabled: v }; setVesselPrefs(n); updateDoc(doc(firestore!, 'users', user!.uid), { vesselPrefs: n }); }} />
        </div>
        <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Volume2 className="size-3" /> Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
            <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => { const n = { ...vesselPrefs, vesselVolume: v[0] / 100 }; setVesselPrefs(n); updateDoc(doc(firestore!, 'users', user!.uid), { vesselPrefs: n }); }} />
        </div>
        <div className="grid gap-3 pt-4 border-t border-dashed">
            {['moving', 'stationary', 'offline', 'emergency', 'tactical', 'battery'].map(k => (
                <div key={k} className={cn("p-3 rounded-xl border-2 flex flex-col gap-3 transition-all", vesselPrefs.notifySettings[k as keyof typeof vesselPrefs.notifySettings] ? "bg-white" : "bg-muted/30 opacity-60")}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase">{k}</span>
                        <Switch checked={vesselPrefs.notifySettings[k as keyof typeof vesselPrefs.notifySettings]} onCheckedChange={v => { const n = { ...vesselPrefs, notifySettings: { ...vesselPrefs.notifySettings, [k]: v } }; setVesselPrefs(n); updateDoc(doc(firestore!, 'users', user!.uid), { vesselPrefs: n }); }} className="scale-75" />
                    </div>
                    <div className="flex gap-2 items-center">
                        <Select value={vesselPrefs.notifySounds[k as keyof typeof vesselPrefs.notifySounds]} onValueChange={v => { const n = { ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [k]: v } }; setVesselPrefs(n); updateDoc(doc(firestore!, 'users', user!.uid), { vesselPrefs: n }); }}>
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-1"><SelectValue placeholder="Son..." /></SelectTrigger>
                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 border" onClick={() => playVesselSound(vesselPrefs.notifySounds[k as keyof typeof vesselPrefs.notifySounds], !!vesselPrefs.notifyLoops?.[k])}><Play className="size-3" /></Button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  if (isProfileLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {showLoopAlert && (
          <div className="fixed top-0 left-0 right-0 z-[999] p-4 bg-red-600 text-white shadow-2xl animate-in slide-in-from-top duration-500">
              <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-full animate-pulse"><Volume2 className="size-6" /></div>
                      <div className="flex flex-col"><span className="text-sm font-black uppercase tracking-tighter">Alarme Active</span><span className="text-[10px] font-bold opacity-80 uppercase leading-none">Signal en boucle</span></div>
                  </div>
                  <Button onClick={stopAllSounds} className="bg-white text-red-600 hover:bg-white/90 font-black uppercase text-xs h-12 px-6 shadow-lg gap-2"><VolumeX className="size-4" /> ARRÊTER LE SON</Button>
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
                        isStabilizing ? "bg-slate-800 border-white/20 animate-pulse" : 
                        vesselStatus === 'landed' ? "bg-green-600 border-green-400/20" : 
                        vesselStatus === 'emergency' ? "bg-red-600 border-red-400/20 animate-pulse" : 
                        vesselStatus === 'offline' ? "bg-slate-700 border-slate-500 animate-pulse" : 
                        "bg-primary border-primary-foreground/20")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                {isStabilizing ? <RefreshCw className="size-3 animate-spin" /> : <Zap className="size-3 fill-yellow-300 text-yellow-300" />} 
                                {isStabilizing ? "STABILISATION GPS (10s)..." : "Partage Actif"}
                            </p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        {!isStabilizing && (
                            <div className="mt-8 flex items-center gap-3 relative z-10">
                                <Badge variant="outline" className={cn("border-white/30 text-white font-black text-[10px] px-3 h-6", vesselStatus === 'offline' ? "bg-red-500/40" : "bg-green-500/30 animate-pulse")}>{vesselStatus === 'offline' ? 'HORS-LIGNE' : 'EN LIGNE'}</Badge>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                    {vesselStatus === 'moving' ? <Move className="size-3" /> : vesselStatus === 'returning' ? <Navigation className="size-3" /> : vesselStatus === 'landed' ? <Home className="size-3" /> : <Anchor className="size-3" />}
                                    {vesselStatus === 'moving' ? 'En mouvement' : vesselStatus === 'returning' ? 'Retour Maison' : vesselStatus === 'landed' ? 'À terre' : vesselStatus === 'drifting' ? 'À LA DÉRIVE !' : 'Au mouillage'}
                                </span>
                            </div>
                        )}
                    </div>
                    {!isStabilizing && (
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('returning')}><Navigation className="size-4 text-blue-600" /> Retour Maison</Button>
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatus('landed')}><Home className="size-4 text-green-600" /> Home (À terre)</Button>
                        </div>
                    )}
                    <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase shadow-lg gap-3" onClick={handleStopSharing}>
                        <X className="size-5" /> Arrêter le partage
                    </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                    <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                    <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                </div>
              )}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-prefs" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Identité & IDS</span></AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="p-4 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-between">
                            <div className="space-y-0.5"><Label className="text-xs font-black uppercase flex items-center gap-2"><Ghost className="size-4" /> Mode Fantôme</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Masquer ma position pour la Flotte C uniquement</p></div>
                            <Switch checked={isGhostMode} onCheckedChange={(v) => { setIsGhostMode(v); updateDoc(doc(firestore!, 'users', user!.uid), { isGhostMode: v }); if (isSharing) updateVesselInFirestore({ isGhostMode: v }); }} />
                        </div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label><Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-bold h-12 border-2 text-center" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du navire</Label>
                            <div className="flex gap-2"><Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase flex-1" /><Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={() => handleSaveVessel()}><Save className="size-4" /></Button></div>
                        </div>
                        <div className="space-y-3 pt-2 border-t border-dashed">
                            <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase opacity-60">Rayon de mouillage (m)</Label><Badge variant="outline" className="font-black text-[10px]">{vesselPrefs.mooringRadius || 20}m</Badge></div>
                            <Slider value={[vesselPrefs.mooringRadius || 20]} min={10} max={200} step={5} onValueChange={v => { const n = { ...vesselPrefs, mooringRadius: v[0] }; setVesselPrefs(n); updateDoc(doc(firestore!, 'users', user!.uid), { vesselPrefs: n }); }} />
                        </div>
                        <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] border-2 gap-2" onClick={toggleWakeLock}>
                            <Zap className={cn("size-4", wakeLock && "fill-primary")} />
                            {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
                        </Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="sender-sounds" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Volume2 className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Notifications & Sons</span></AccordionTrigger>
                    <AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" /><Button variant="outline" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Save className="size-4" /></Button></div></div>
              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Ma Flotte</Label>
                <div className="grid gap-2">
                    {savedVesselIds.map(id => {
                        const v = followedVessels?.find(v => v.id === id);
                        const isActive = v?.isSharing === true;
                        return (
                            <div key={id} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm", isActive ? "border-primary/20 bg-primary/5" : "opacity-60")}>
                                <div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{isActive ? <Navigation className="size-4" /> : <WifiOff className="size-4" />}</div><div className="flex flex-col"><span className="font-black text-xs">{v?.displayName || id}</span><span className="text-[8px] font-bold uppercase opacity-60">{isActive ? 'En ligne' : 'Déconnecté'}</span></div></div>
                                <div className="flex items-center gap-2">{isActive && <BatteryIconComp level={v?.batteryLevel} charging={v?.isCharging} />}<Button variant="ghost" size="icon" className="size-8 text-destructive/40" onClick={() => handleRemoveSavedVessel(id)}><Trash2 className="size-3" /></Button></div>
                            </div>
                        );
                    })}
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="receiver-sounds" className="border-none"><AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Notifications & Sons</span></AccordionTrigger><AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent></AccordionItem>
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={mapZoom} onLoad={setMap} onZoomChanged={() => map && setMapZoom(map.getZoom() || 10)} options={{ disableDefaultUI: true, zoomControl: false, mapTypeControl: false, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.filter(v => v.isSharing && (mode === 'receiver' || !v.isGhostMode || v.status === 'emergency' || v.id === sharingId)).map(vessel => (
                    <React.Fragment key={`vessel-group-${vessel.id}`}>
                        {(vessel.status === 'stationary' || vessel.status === 'drifting') && vessel.anchorLocation && (
                            <React.Fragment>
                                <Circle center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} radius={vessel.mooringRadius || 20} options={{ fillColor: '#3b82f6', fillOpacity: 0.1, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 2, clickable: false }} />
                                <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center"><div className="p-1 bg-amber-600 rounded-full border border-white shadow-md"><Anchor className="size-3 text-white" /></div></div>
                                </OverlayView>
                            </React.Fragment>
                        )}
                        <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 relative">
                                <div className={cn("px-2 py-1 text-white rounded text-[10px] font-black shadow-lg border whitespace-nowrap flex items-center gap-2", vessel.status === 'emergency' ? "bg-red-600 animate-pulse" : vessel.status === 'drifting' ? "bg-orange-600 animate-bounce" : "bg-slate-900/90")}>
                                  <span className="max-w-[120px]">{vessel.displayName || vessel.id}{vessel.eventLabel && ` | ${vessel.eventLabel}`}</span>
                                  <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-2.5" />
                                </div>
                                <div className={cn("p-2 rounded-full border-2 border-white shadow-xl transition-all", 
                                    vessel.status === 'moving' ? "bg-blue-600" : 
                                    vessel.status === 'returning' ? "bg-indigo-600" : 
                                    vessel.status === 'landed' ? "bg-green-600" : 
                                    vessel.status === 'emergency' ? "bg-red-600 animate-pulse" : 
                                    vessel.status === 'drifting' ? "bg-orange-600 animate-pulse" : "bg-amber-600")}>
                                    <Navigation className="size-5 text-white" />
                                </div>
                            </div>
                        </OverlayView>
                    </React.Fragment>
                ))}
                {mode === 'sender' && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><PulsingDot /></OverlayView>}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5 text-primary" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>
        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2"><Button variant="destructive" className="flex-1 h-14 font-black uppercase shadow-lg text-xs" onClick={() => sendEmergencySms('MAYDAY')}>MAYDAY</Button><Button variant="secondary" className="flex-1 h-14 font-black uppercase shadow-lg text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}>PAN PAN</Button></div>
            <div className="border rounded-xl bg-muted/10 overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><History className="size-3 mr-2"/> Journal Technique</AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHistory}>Effacer</Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide px-3">
                            {techHistory.map((h, i) => {
                                const duration = differenceInMinutes(h.lastUpdateTime, h.startTime);
                                return (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                        <div className="flex flex-col gap-1.5 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-primary truncate">{h.vesselName}</span>
                                                <span className="font-black uppercase shrink-0">{h.statusLabel}</span>
                                            </div>
                                            <div className="flex items-center gap-2 font-bold opacity-40 uppercase text-[9px]">
                                                <span>{format(h.startTime, 'HH:mm')}</span>
                                                {duration > 0 && <span className="text-primary">• depuis {duration} min</span>}
                                                {h.accuracy !== undefined && <span>• +/- {h.accuracy}m</span>}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 border-2 px-3 text-[9px] font-black uppercase shrink-0" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                                    </div>
                                );
                            })}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>

      <Dialog open={!!fullscreenImage} onOpenChange={(o) => !o && setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] w-full p-0 bg-black border-none rounded-3xl overflow-hidden shadow-2xl z-[200]">
          <div className="relative w-full h-[80vh] flex flex-col">
            <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 z-[210] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md shadow-lg"><X className="size-6" /></button>
            <div className="flex-1 w-full relative flex items-center justify-center">
              {fullscreenImage && <img src={fullscreenImage.url} className="max-w-full max-h-full object-contain animate-in zoom-in-95 duration-300" alt="" />}
            </div>
            <div className="p-6 bg-gradient-to-t from-black/90 to-transparent shrink-0 text-center">
              <DialogHeader className="sr-only"><DialogTitle>{fullscreenImage?.title}</DialogTitle><DialogDescription>Photo tactique</DialogDescription></DialogHeader>
              <p className="text-white font-black uppercase tracking-tighter text-xl">{fullscreenImage?.title}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
