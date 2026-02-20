
'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  arrayUnion, 
  arrayRemove, 
  where, 
  addDoc
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
  History as HistoryIcon,
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
  Bird,
  Camera,
  MessageSquare,
  Globe,
  ChevronDown,
  Repeat,
  VolumeX,
  Target,
  Copy,
  Info,
  Clock,
  Compass,
  Fish
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, WindDirection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MAP_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

// --- HELPERS ---
const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 20) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 60) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- MODES & UI ---
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);

  // --- SYNC & ALGO STATE ---
  const [syncCountdown, setSyncCountdown] = useState(60);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [vesselAccuracy, setVesselAccuracy] = useState<number | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(20);
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  
  // Timers
  const immobilityStartTime = useRef<number | null>(null);
  const launchStartTime = useRef<number | null>(null);
  const statusStartTime = useRef<number>(Date.now());
  const [usageMinutes, setUsageDuration] = useState(0);

  // Audio Loops
  const [loopingAudio, setLoopingAudio] = useState<HTMLAudioElement | null>(null);
  const [loopingLabel, setLoopingLabel] = useState<string | null>(null);

  // Prefs & SMS
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  // Journals
  const [techHistory, setTechHistory] = useState<any[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<any[]>([]);

  // Sound Prefs
  const [vesselPrefs, setVesselPrefs] = useState<any>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, emergency: true },
    notifySounds: { moving: 'sonar', stationary: 'ancre', offline: 'alerte', emergency: 'sos' },
    loopSettings: { moving: false, stationary: false, offline: true, emergency: true },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20
  });

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  // --- DATA FETCHING ---
  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const ids = [...savedVesselIds];
    if (isSharing && !ids.includes(sharingId)) ids.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const soundsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => 
    dbSounds?.filter(s => !s.categories || s.categories.includes('Vessel') || s.categories.includes('General'))
    .map(s => ({ id: s.id, label: s.label, url: s.url })) || []
  , [dbSounds]);

  // --- REFS ---
  const watchIdRef = useRef<number | null>(null);
  const mapMarkersRef = useRef<Record<string, { marker: any, circle?: any }>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  // --- FUNCTIONS ---

  const handleRecenter = useCallback(() => {
    if (!map) return;
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.id === sharingId)?.location ? { lat: followedVessels.find(v => v.id === sharingId)!.location!.latitude, lng: followedVessels.find(v => v.id === sharingId)!.location!.longitude } : null);
    if (pos) {
        map.panTo(pos);
        map.setZoom(15);
    }
  }, [map, mode, currentPos, followedVessels, sharingId]);

  const playVesselSound = useCallback((soundId: string, shouldLoop: boolean = false, eventLabel: string = "Alerte") => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
        const audio = new Audio(sound.url);
        audio.volume = vesselPrefs.vesselVolume;
        audio.loop = shouldLoop;
        audio.play().catch(() => {});
        if (shouldLoop) {
            if (loopingAudio) loopingAudio.pause();
            setLoopingAudio(audio);
            setLoopingLabel(eventLabel);
        }
    }
  }, [vesselPrefs, availableSounds, loopingAudio]);

  const stopLooping = () => {
    if (loopingAudio) {
        loopingAudio.pause();
        setLoopingAudio(null);
        setLoopingLabel(null);
    }
  };

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const vesselRef = doc(firestore, 'vessels', sharingId);
    let batteryUpdate = {};
    if ('getBattery' in navigator) {
        const b: any = await (navigator as any).getBattery();
        batteryUpdate = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
    }

    const payload: any = {
        id: sharingId,
        userId: user.uid,
        displayName: vesselNickname || user.displayName || 'Capitaine',
        isSharing: data.isSharing ?? isSharing,
        isGhostMode,
        mooringRadius,
        lastActive: serverTimestamp(),
        status: data.status || vesselStatus,
        ...batteryUpdate,
        ...data
    };

    if (payload.status !== lastSentStatusRef.current || data.eventLabel) {
        payload.statusChangedAt = serverTimestamp();
        lastSentStatusRef.current = payload.status;
    }

    setDoc(vesselRef, payload, { merge: true }).catch(() => {});
    lastSyncTimeRef.current = Date.now();
    setSyncCountdown(60);
  }, [user, firestore, isSharing, sharingId, vesselNickname, isGhostMode, mooringRadius, vesselStatus]);

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    const isDeactivating = vesselStatus === st && label === undefined;
    const nextSt = isDeactivating ? 'moving' : st;
    const nextLabel = isDeactivating ? 'ERREUR INVOLONTAIRE' : label;

    setVesselStatus(nextSt);
    statusStartTime.current = Date.now();
    updateVesselInFirestore({ status: nextSt, eventLabel: nextLabel });
    
    if (nextSt === 'moving') {
        immobilityStartTime.current = null;
        setAnchorPos(null);
    }
    
    playVesselSound('sonar');
    toast({ title: nextLabel || nextSt });
  };

  const handleTacticalSignal = async (type: string, color: string) => {
    if (!user || !firestore || !currentPos) return;
    const signalData = {
        type,
        color,
        location: { latitude: currentPos.lat, longitude: currentPos.lng },
        timestamp: serverTimestamp(),
        vesselName: vesselNickname || user.displayName || 'Capitaine',
        vesselId: sharingId
    };
    
    try {
        await addDoc(collection(firestore, 'vessels', sharingId, 'tactical_signals'), signalData);
        setTacticalHistory(prev => [signalData, ...prev].slice(0, 20));
        playVesselSound('sonar');
        toast({ title: `Signal envoyé : ${type}` });
    } catch (e) {}
  };

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = sharingId.trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayUnion(cleanId),
            lastVesselId: cleanId,
            vesselNickname: vesselNickname
        });
        toast({ title: "ID enregistré sur votre profil" });
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
        toast({ title: "Navire retiré de la liste" });
    } catch (e) {
        console.error(e);
    }
  };

  const handleStopSharing = async () => {
    setIsSharing(false);
    await updateVesselInFirestore({ isSharing: false, status: 'offline' });
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    toast({ title: "Partage arrêté" });
  };

  const saveVesselPrefs = async (newPrefs: any) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
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
        toast({ variant: 'destructive', title: "Erreur sauvegarde SMS" });
    }
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!isEmergencyEnabled || !emergencyContact) {
        toast({ variant: "destructive", title: "Configuration SMS requise", description: "Configurez votre contact dans les réglages d'urgence." });
        return;
    }
    const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const body = `${vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : ""}${isCustomMessageEnabled ? vesselSmsMessage : "Besoin d'assistance."} [${type}] GPS: ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initMap = async () => {
      try {
        if (!document.getElementById('leaflet-js')) {
          const s = document.createElement('script'); s.id = 'leaflet-js'; s.src = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js'; s.async = true;
          document.head.appendChild(s);
        }
        (window as any).W = { apiKey: MAP_KEY };
        if (!document.getElementById('windy-boot')) {
          const s = document.createElement('script'); s.id = 'windy-boot'; s.src = 'https://api.windy.com/assets/map-forecast/libBoot.js'; s.async = true;
          document.head.appendChild(s);
        }

        const check = setInterval(() => {
          if ((window as any).windyInit) {
            clearInterval(check);
            (window as any).windyInit({ key: MAP_KEY, lat: INITIAL_CENTER.lat, lon: INITIAL_CENTER.lng, zoom: 7 }, (api: any) => {
              setMap(api.map); setIsInitialized(true);
            });
          }
        }, 200);
      } catch (e) {}
    };
    initMap();
  }, []);

  // --- GPS WATCHDOG & ALGO ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;

    launchStartTime.current = Date.now();
    setVesselStatus('moving');
    statusStartTime.current = Date.now();
    updateVesselInFirestore({ status: 'moving', eventLabel: 'LANCEMENT EN COURS' });

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            setCurrentPos(newPos);
            setVesselAccuracy(Math.round(accuracy));

            if (isFollowMode && map) map.panTo(newPos);

            // Algorithme Dérive & Immobilité
            if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
                if (!anchorPos) {
                    setAnchorPos(newPos);
                } else {
                    const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
                    
                    if (dist < mooringRadius) {
                        if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
                        const immobilityDuration = (Date.now() - immobilityStartTime.current) / 1000;
                        
                        if (immobilityDuration > 20 && vesselStatus !== 'stationary') {
                            setVesselStatus('stationary');
                            statusStartTime.current = Date.now();
                            updateVesselInFirestore({ status: 'stationary', anchorLocation: { latitude: anchorPos.lat, longitude: anchorPos.lng } });
                        }
                    } else if (dist < 100) {
                        if (vesselStatus === 'stationary') {
                            setVesselStatus('drifting');
                            statusStartTime.current = Date.now();
                            updateVesselInFirestore({ status: 'drifting' });
                        }
                    } else {
                        if (vesselStatus !== 'moving') {
                            setVesselStatus('moving');
                            statusStartTime.current = Date.now();
                            setAnchorPos(newPos);
                            immobilityStartTime.current = null;
                            updateVesselInFirestore({ status: 'moving' });
                        }
                    }
                }
            }
        },
        () => toast({ variant: "destructive", title: "Erreur GPS" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    const countdownInterval = setInterval(() => {
        setSyncCountdown(prev => {
            if (prev <= 1) {
                updateVesselInFirestore({ eventLabel: 'MAJ MINUTE' });
                return 60;
            }
            return prev - 1;
        });
        
        const duration = Math.floor((Date.now() - statusStartTime.current) / 60000);
        setUsageDuration(duration);
    }, 1000);

    return () => {
        clearInterval(countdownInterval);
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, mode, updateVesselInFirestore, map, isFollowMode, mooringRadius, anchorPos, vesselStatus, toast]);

  // --- MARKER MANAGEMENT (Leaflet) ---
  useEffect(() => {
    if (!map || !followedVessels || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    followedVessels.forEach(vessel => {
        const isOffline = (Date.now() - (vessel.lastActive?.toMillis() || 0)) > 70000;
        const isActive = vessel.isSharing && !isOffline;

        if (!isActive || (vessel.isGhostMode && mode === 'fleet' && vessel.userId !== user?.uid)) {
            if (mapMarkersRef.current[vessel.id]) {
                map.removeLayer(mapMarkersRef.current[vessel.id].marker);
                if (mapMarkersRef.current[vessel.id].circle) map.removeLayer(mapMarkersRef.current[vessel.id].circle);
                delete mapMarkersRef.current[vessel.id];
            }
            return;
        }

        const pos = [vessel.location!.latitude, vessel.location!.longitude];
        const statusLabel = vessel.status === 'emergency' ? 'SOS' : vessel.status === 'stationary' ? 'MOUIL' : vessel.status === 'drifting' ? 'DÉRIVE' : vessel.status === 'returning' ? 'RETOUR' : vessel.status === 'landed' ? 'HOME' : 'MOUV';
        const color = vessel.status === 'emergency' ? '#ef4444' : vessel.status === 'stationary' ? '#f97316' : vessel.status === 'drifting' ? '#f97316' : vessel.status === 'returning' ? '#4f46e5' : vessel.status === 'landed' ? '#22c55e' : '#3b82f6';

        const iconHtml = `
            <div class="flex flex-col items-center gap-1">
                <div class="bg-white px-2 py-0.5 rounded shadow-lg border border-slate-200 text-[10px] font-black text-slate-800 whitespace-nowrap">
                    ${vessel.displayName} | ${statusLabel}
                </div>
                <div class="p-2 rounded-full border-4 border-white shadow-2xl ${vessel.status === 'emergency' || vessel.status === 'drifting' ? 'animate-pulse' : ''}" style="background-color: ${color}">
                    <div class="text-white">${vessel.status === 'stationary' ? '⚓' : vessel.status === 'landed' ? '🏠' : '⛵'}</div>
                </div>
            </div>
        `;

        if (!mapMarkersRef.current[vessel.id]) {
            const marker = L.marker(pos, { icon: L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 40] }) }).addTo(map);
            let circle = null;
            if (vessel.status === 'stationary' || vessel.status === 'drifting') {
                const center = vessel.anchorLocation ? [vessel.anchorLocation.latitude, vessel.anchorLocation.longitude] : pos;
                circle = L.circle(center, { radius: vessel.mooringRadius || 20, color: '#3b82f6', fillOpacity: 0.15, weight: 2 }).addTo(map);
            }
            mapMarkersRef.current[vessel.id] = { marker, circle };
        } else {
            const entry = mapMarkersRef.current[vessel.id];
            entry.marker.setLatLng(pos);
            entry.marker.setIcon(L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 40] }));
            
            if (vessel.status === 'stationary' || vessel.status === 'drifting') {
                const center = vessel.anchorLocation ? [vessel.anchorLocation.latitude, vessel.anchorLocation.longitude] : pos;
                if (!entry.circle) entry.circle = L.circle(center, { radius: vessel.mooringRadius || 20, color: '#3b82f6', fillOpacity: 0.15, weight: 2 }).addTo(map);
                else { entry.circle.setLatLng(center); entry.circle.setRadius(vessel.mooringRadius || 20); }
            } else if (entry.circle) {
                map.removeLayer(entry.circle);
                entry.circle = undefined;
            }
        }
    });
  }, [map, followedVessels, mode, user]);

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Besoin d'assistance.";
    return `${nicknamePrefix}${customText} [MAYDAY/PAN PAN] Position : https://www.google.com/maps?q=-21.3,165.5`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {loopingLabel && (
        <div className="fixed top-0 left-0 right-0 z-[300] bg-red-600 text-white p-4 flex items-center justify-between shadow-2xl animate-pulse">
            <div className="flex items-center gap-3">
                <AlertTriangle className="size-6" />
                <span className="font-black uppercase text-sm tracking-widest">{loopingLabel}</span>
            </div>
            <Button onClick={stopLooping} className="bg-white text-red-600 font-black uppercase text-xs h-10 px-6 hover:bg-slate-100">ARRÊTER LE SON</Button>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Globe className="text-primary" /> Boat Tracker
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Navigation NC</p>
        </div>
        <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('fleet')}>Flotte (C)</Button>
        </div>
      </header>

      {mode === 'sender' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {isSharing ? (
            <div className="space-y-4">
              <Card className="bg-primary text-white border-none shadow-xl overflow-hidden relative">
                <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                <CardHeader className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif
                    </p>
                    <Badge onClick={() => updateVesselInFirestore({ eventLabel: 'MAJ GPS FORCÉE' })} className="bg-white/20 border-white/20 text-white font-black text-[10px] h-6 px-3 cursor-pointer active:scale-95 transition-all">
                        SYNC DANS {syncCountdown}S
                    </Badge>
                  </div>
                  <h3 className="text-3xl font-black uppercase mt-2">{sharingId}</h3>
                  <p className="text-xs font-bold opacity-80 mt-1">{vesselNickname || 'Capitaine'}</p>
                </CardHeader>
                <CardFooter className="p-5 pt-0 flex flex-wrap gap-3">
                    <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[10px] h-6 px-3">EN LIGNE</Badge>
                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        {vesselStatus === 'moving' ? <Move className="size-3" /> : <Anchor className="size-3" />}
                        {vesselStatus === 'moving' ? 'En mouvement' : 'Au mouillage'}
                    </span>
                    <span className="text-[10px] font-black uppercase text-blue-200">ACTIF {usageMinutes} MIN</span>
                </CardFooter>
              </Card>

              <Card className="border-2 border-dashed p-4 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">
                    <HistoryIcon className="size-3" /> Signalisation manuelle
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        variant={vesselStatus === 'returning' ? 'default' : 'outline'} 
                        className={cn("h-14 font-black uppercase text-[10px] border-2", vesselStatus === 'returning' && "bg-indigo-600 border-indigo-600")}
                        onClick={() => handleManualStatus('returning', 'RETOUR MAISON')}
                    >
                        <Navigation className="mr-2 size-4" /> {vesselStatus === 'returning' ? 'ANNULER RETOUR' : 'RETOUR MAISON'}
                    </Button>
                    <Button 
                        variant={vesselStatus === 'landed' ? 'default' : 'outline'} 
                        className={cn("h-14 font-black uppercase text-[10px] border-2", vesselStatus === 'landed' && "bg-green-600 border-green-600")}
                        onClick={() => handleManualStatus('landed', 'HOME (À TERRE)')}
                    >
                        <Home className="mr-2 size-4" /> {vesselStatus === 'landed' ? 'ANNULER HOME' : 'HOME (À TERRE)'}
                    </Button>
                </div>
              </Card>

              <Card className="border-2 border-dashed p-4 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">
                    <Target className="size-3" /> Signalement Tactique (Flotte)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { label: 'OISEAUX', icon: Bird, color: 'bg-white text-blue-600 border-blue-600' },
                        { label: 'MARLIN', icon: Fish, color: 'bg-indigo-900 text-white border-indigo-900' },
                        { label: 'THON', icon: Fish, color: 'bg-red-600 text-white border-red-600' },
                        { label: 'TAZARD', icon: Fish, color: 'bg-slate-600 text-white border-slate-600' },
                        { label: 'WAHOO', icon: Fish, color: 'bg-cyan-600 text-white border-cyan-600' },
                        { label: 'BONITE', icon: Fish, color: 'bg-violet-600 text-white border-violet-600' },
                        { label: 'SARDINES', icon: Waves, color: 'bg-emerald-500 text-white border-emerald-500' },
                        { label: 'PRISE', icon: Camera, color: 'bg-teal-600 text-white border-teal-600' }
                    ].map(sig => (
                        <Button 
                            key={sig.label} 
                            onClick={() => handleTacticalSignal(sig.label, sig.color)}
                            className={cn("h-12 flex flex-col items-center justify-center p-1 border-2 transition-all active:scale-95", sig.color)}
                        >
                            <sig.icon className="size-4" />
                            <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5">{sig.label}</span>
                        </Button>
                    ))}
                </div>
              </Card>

              <Button 
                variant={vesselStatus === 'emergency' ? 'destructive' : 'secondary'} 
                className={cn("w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2", vesselStatus === 'emergency' && "animate-pulse border-white/20")} 
                onClick={() => handleManualStatus('emergency', 'DEMANDE ASSISTANCE')}
              >
                <ShieldAlert className="size-6" /> {vesselStatus === 'emergency' ? 'ANNULER ALERTE' : "DEMANDE D'ASSISTANCE"}
              </Button>

              <Button variant="destructive" className="w-full h-14 font-black uppercase text-xs tracking-widest opacity-80" onClick={handleStopSharing}>
                <X className="mr-2 size-4" /> ARRÊTER LE PARTAGE / QUITTER
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <Button className="w-full h-20 text-lg font-black uppercase tracking-widest shadow-xl rounded-2xl gap-4 bg-primary" onClick={() => setIsSharing(true)}>
                <Navigation className="size-8" /> Partager ma position
              </Button>
              <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Surnom du capitaine / navire</Label>
                  <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="Ex: Koolapik" className="h-12 border-2 font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du navire (Partage)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="ID EX: BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow" />
                    <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0 touch-manipulation" onClick={handleSaveVessel}>
                        <Save className="size-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" className="w-full h-12 font-black uppercase text-[10px] gap-2" onClick={handleRecenter}><LocateFixed className="size-4" /> Activer mon GPS</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAP CONTAINER */}
      <div className={cn("relative w-full transition-all bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden", isFullscreen ? "fixed inset-0 z-[150] h-screen w-screen rounded-none" : "h-[550px]")}>
        <div id="windy" className="w-full h-full"></div>
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-900 transition-opacity z-10", isInitialized ? "opacity-0 invisible pointer-events-none" : "opacity-100 visible")}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation Windy API...</p>
        </div>
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className="bg-white/90 backdrop-blur-md border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}
            </Button>
            <Button size="icon" className={cn("bg-white/90 backdrop-blur-md border-2 h-10 w-10 shadow-xl", isFollowMode && "bg-blue-50 border-blue-500 animate-pulse")} onClick={() => setIsFollowMode(!isFollowMode)}>
                <Navigation className={cn("size-5", isFollowMode ? "text-blue-600" : "text-primary")} />
            </Button>
        </div>
        <Button onClick={handleRecenter} className="absolute top-4 right-4 h-10 bg-white/90 backdrop-blur-md border-2 px-3 gap-2 shadow-xl z-[160] font-black uppercase text-[9px] text-primary">
            RECENTRER <LocateFixed className="size-4" />
        </Button>
      </div>

      {/* ACCORDIONS PREFS */}
      <div className="space-y-2">
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="id-ids" className="border-2 rounded-xl bg-muted/10 overflow-hidden mb-2">
                <AccordionTrigger className="px-4 py-3 hover:no-underline font-black uppercase text-[10px] tracking-widest">
                    <div className="flex items-center gap-2"><Settings className="size-4 text-primary" /> Identité & IDS</div>
                </AccordionTrigger>
                <AccordionContent className="p-4 space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[10px] font-black uppercase opacity-60">Rayon de mouillage</Label>
                                <Badge variant="outline" className="font-black bg-white">{mooringRadius}m</Badge>
                            </div>
                            <Slider value={[mooringRadius]} min={10} max={200} step={5} onValueChange={v => setMooringRadius(v[0])} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-xl bg-white">
                            <div className="space-y-0.5"><Label className="text-xs font-black uppercase">Mode Fantôme</Label><p className="text-[8px] font-bold text-muted-foreground uppercase">Masquer pour la flotte (C)</p></div>
                            <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sms-settings" className="border-2 rounded-xl bg-muted/10 overflow-hidden mb-2">
                <AccordionTrigger className="px-4 py-3 hover:no-underline font-black uppercase text-[10px] tracking-widest">
                    <div className="flex items-center gap-2"><Smartphone className="size-4 text-orange-600" /> Réglages SMS d'Urgence</div>
                </AccordionTrigger>
                <AccordionContent className="p-4 space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Contact d'urgence (Terre)</Label>
                            <Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Message personnalisé</Label>
                            <Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="min-h-[80px] border-2" />
                        </div>
                        <div className="p-3 bg-muted/30 rounded-xl border-2 border-dashed text-[10px] italic">
                            Aperçu : {smsPreview}
                        </div>
                        <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] gap-2">
                            <Save className="size-4" /> Enregistrer mes réglages SMS
                        </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tech-log" className="border-2 rounded-xl bg-muted/10 overflow-hidden mb-2">
                <AccordionTrigger className="px-4 py-3 hover:no-underline font-black uppercase text-[10px] tracking-widest">
                    <div className="flex items-center gap-2"><HistoryIcon className="size-4 text-primary" /> Journal Technique</div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t border-dashed">
                    <ScrollArea className="h-64">
                        <div className="divide-y">
                            {techHistory.map((h, i) => (
                                <div key={i} className="p-3 flex items-center justify-between text-[10px] bg-white">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-blue-600">{h.vesselName}</span>
                                            <span className="font-black uppercase text-slate-800">{h.statusLabel}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400 font-bold mt-0.5">
                                            <span>{format(h.time, 'HH:mm:ss')}</span>
                                            <span>• PRÉCISION +/- {h.accuracy || 5}M</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                                            <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-3" />
                                            <span className="font-black text-blue-600">{h.batteryLevel}%</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="size-8 rounded-full border" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}><LocateFixed className="size-4 text-primary" /></Button>
                                    </div>
                                </div>
                            ))}
                            {techHistory.length === 0 && <p className="text-center py-10 text-xs italic opacity-40">Aucun événement enregistré.</p>}
                        </div>
                    </ScrollArea>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>

      {/* ANNUAIRE MARITIME */}
      <Card className="border-2 bg-muted/10 shadow-none rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b bg-muted/5">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4 text-primary" /> Annuaire Maritime NC
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2 border-b pb-1">
              <ShieldAlert className="size-3" /> Urgences
            </h4>
            <div className="space-y-2">
              <a href="tel:16" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">COSS NC (Mer)</span><span className="text-sm font-black group-hover:text-red-600 transition-colors">16</span></a>
              <a href="tel:15" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">SAMU (Terre)</span><span className="text-sm font-black group-hover:text-red-600 transition-colors">15</span></a>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 border-b pb-1">
              <Waves className="size-3" /> Services
            </h4>
            <div className="space-y-2">
              <a href="tel:366736" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">Météo Marine</span><span className="text-sm font-black group-hover:text-blue-600 transition-colors">36 67 36</span></a>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 border-b pb-1">
              <Ship className="size-3" /> Ports & Marinas
            </h4>
            <div className="space-y-2">
              <a href="tel:255000" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">Port Autonome (VHF 12)</span><span className="text-sm font-black group-hover:text-indigo-600 transition-colors">25 50 00</span></a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
