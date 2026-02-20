
'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, getDoc, Timestamp } from 'firebase/firestore';
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
  Compass
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, WindDirection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { fetchWindyWeather } from '@/lib/windy-api';

const MAP_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const IMMOBILITY_THRESHOLD = 20; // mètres
const NAVIGATION_THRESHOLD = 100; // mètres

// --- HELPER COMPONENTS ---
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

  // --- COMPONENT STATE ---
  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);

  // Sync & Algo State
  const [syncCountdown, setSyncCountdown] = useState(60);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [vesselAccuracy, setVesselAccuracy] = useState<number | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(20);
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [statusActiveSince, setStatusActiveSince] = useState<number>(0);

  // Audio State
  const [loopingSound, setLoopingSound] = useState<{ id: string, audio: HTMLAudioElement } | null>(null);
  
  // History
  const [techHistory, setTechHistory] = useState<any[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<any[]>([]);

  // B (Receiver) Relay Settings
  const [relayContact, setRelayContact] = useState('');
  const [relaySmsMessage, setRelaySmsMessage] = useState('Requiert assistance immédiate.');
  const [selectedVesselForRelay, setSelectedVesselForRelay] = useState('');

  // Prefs
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

  // --- REFS ---
  const watchIdRef = useRef<number | null>(null);
  const immobilityTimerRef = useRef<number | null>(null);
  const shouldPanOnNextFix = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const lastFirestorePosRef = useRef<{ lat: number, lng: number } | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // --- HOISTED FUNCTIONS ---
  function handleRecenter() {
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.id === sharingId)?.location ? { lat: followedVessels.find(v => v.id === sharingId)!.location!.latitude, lng: followedVessels.find(v => v.id === sharingId)!.location!.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  }

  const playVesselSound = useCallback((soundKey: string, forceLoop = false) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const soundId = vesselPrefs.notifySounds[soundKey] || soundKey;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      const isLoop = forceLoop || vesselPrefs.loopSettings[soundKey];
      if (isLoop) {
        audio.loop = true;
        if (loopingSound) { loopingSound.audio.pause(); }
        setLoopingSound({ id: soundId, audio });
      }
      audio.play().catch(() => {});
    }
  }, [vesselPrefs, availableSounds, loopingSound]);

  const stopLoopingSound = () => {
    if (loopingSound) {
      loopingSound.audio.pause();
      setLoopingSound(null);
    }
  };

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const vesselRef = doc(firestore, 'vessels', sharingId);
    const snap = await getDoc(vesselRef);
    const existing = snap.exists() ? snap.data() as VesselStatus : null;

    // Check weather cooldown (3h)
    let weatherUpdate = {};
    if (currentPos) {
        const lastWeather = existing?.lastWeatherUpdate;
        const now = Date.now();
        const threeHours = 3 * 60 * 60 * 1000;
        
        if (!lastWeather || (now - (lastWeather as any).toMillis()) > threeHours) {
            const wData = await fetchWindyWeather(currentPos.lat, currentPos.lng);
            if (wData.success) {
                weatherUpdate = {
                    windSpeed: wData.windSpeed,
                    windDir: wData.windDir,
                    wavesHeight: wData.waves,
                    lastWeatherUpdate: serverTimestamp()
                };
            }
        }
    }

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
        ...batteryUpdate,
        ...weatherUpdate,
        ...data
    };

    if (data.status && data.status !== existing?.status) {
        payload.statusChangedAt = serverTimestamp();
    }

    setDoc(vesselRef, payload, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, isGhostMode, mooringRadius, currentPos]);

  const handleSyncNow = () => {
    if (currentPos) {
        updateVesselInFirestore({ 
            location: { latitude: currentPos.lat, longitude: currentPos.lng },
            eventLabel: "MAJ GPS FORCÉE"
        });
        setSyncCountdown(60);
        toast({ title: "Synchronisation forcée effectuée" });
    }
  };

  const handleManualStatus = (st: VesselStatus['status']) => {
    const isDeactivating = vesselStatus === st;
    const newSt = isDeactivating ? 'moving' : st;
    setVesselStatus(newSt);
    
    const label = isDeactivating ? "ERREUR INVOLONTAIRE" : 
                 st === 'returning' ? "RETOUR MAISON" : 
                 st === 'landed' ? "HOME (À TERRE)" : "SOS ASSISTANCE";
    
    updateVesselInFirestore({ status: newSt, eventLabel: label });
    if (newSt === 'emergency') sendEmergencySms('MAYDAY');
    playVesselSound('sonar');
  };

  const sendEmergencySms = (type: string) => {
    if (!profile?.emergencyContact) { toast({ variant: "destructive", title: "Contact requis", description: "Réglez votre contact SMS dans les paramètres." }); return; }
    const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[FIX GPS...]";
    const body = `[${vesselNickname || sharingId}] ${profile.vesselSmsMessage || 'Demande assistance.'} (${type}) Position : ${posUrl}`;
    window.location.href = `sms:${profile.emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleTacticalSignal = (label: string) => {
    if (!currentPos) return;
    updateVesselInFirestore({ 
        eventLabel: label,
        statusChangedAt: serverTimestamp() // Force journalisation
    });
    toast({ title: `Signal envoyé : ${label}` });
    playVesselSound('sonar');
  };

  const handleResetIdentity = async () => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
        vesselNickname: '',
        lastVesselId: '',
        savedVesselIds: []
    });
    setVesselNickname('');
    setCustomSharingId('');
    toast({ title: "Identité réinitialisée" });
  };

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

  const handleSaveSmsSettings = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            emergencyContact: emergencyContact,
            vesselSmsMessage: vesselSmsMessage,
            isEmergencyEnabled: isEmergencyEnabled,
            isCustomMessageEnabled: isCustomMessageEnabled
        });
        toast({ title: "Réglages SMS sauvés" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur" });
    }
  };

  const saveVesselPrefs = async (newPrefs: any) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const handleClearHistory = () => {
    setTechHistory([]);
    setTacticalHistory([]);
    toast({ title: "Journaux effacés" });
  };

  // --- INITIALIZATION & WATCHDOG ---
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

  // Sync Cycle (1 min)
  useEffect(() => {
    if (!isSharing) return;
    const interval = setInterval(() => {
        setSyncCountdown(prev => {
            if (prev <= 1) {
                if (currentPos) {
                    updateVesselInFirestore({ 
                        location: { latitude: currentPos.lat, longitude: currentPos.lng } 
                    });
                }
                return 60;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSharing, currentPos, updateVesselInFirestore]);

  // GPS Watcher
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    setVesselStatus('moving');
    updateVesselInFirestore({ status: 'moving', eventLabel: 'LANCEMENT EN COURS', isSharing: true });

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            if (accuracy > 10) return; // Filter jitter

            const newPos = { lat: latitude, lng: longitude };
            setCurrentPos(newPos);
            setVesselAccuracy(Math.round(accuracy));

            if (isFollowMode && map) map.panTo(newPos);

            // Immobility Detection
            if (vesselStatus !== 'returning' && vesselStatus !== 'landed' && vesselStatus !== 'emergency') {
                if (!anchorPos) { setAnchorPos(newPos); return; }
                const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
                
                if (dist > mooringRadius) {
                    if (dist > NAVIGATION_THRESHOLD) {
                        setVesselStatus('moving'); setAnchorPos(null); immobilityTimerRef.current = null;
                        updateVesselInFirestore({ status: 'moving', anchorLocation: null });
                    } else if (vesselStatus !== 'drifting') {
                        setVesselStatus('drifting');
                        updateVesselInFirestore({ status: 'drifting' });
                    }
                } else {
                    if (!immobilityTimerRef.current) immobilityTimerRef.current = Date.now();
                    if (Date.now() - immobilityTimerRef.current > 20000 && vesselStatus !== 'stationary') {
                        setVesselStatus('stationary');
                        updateVesselInFirestore({ status: 'stationary', anchorLocation: { latitude: anchorPos.lat, longitude: anchorPos.lng } });
                    }
                }
            }
        },
        () => toast({ variant: "destructive", title: "Erreur GPS", description: "Signal perdu." }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mooringRadius, vesselStatus, map, isFollowMode, anchorPos, updateVesselInFirestore, toast]);

  // --- RENDER LOGIC ---
  const activeVessels = useMemo(() => followedVessels?.filter(v => v.isSharing) || [], [followedVessels]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto px-1 pb-32">
      {loopingSound && (
        <div className="fixed top-0 left-0 right-0 z-[300] bg-red-600 text-white p-4 flex items-center justify-between shadow-2xl animate-pulse">
            <div className="flex items-center gap-3">
                <Volume2 className="size-6" />
                <span className="font-black uppercase tracking-tighter">ALERTE EN COURS - SON EN BOUCLE</span>
            </div>
            <Button variant="secondary" className="font-black uppercase" onClick={stopLoopingSound}>ARRÊTER LE SON</Button>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Globe className="text-primary" /> Boat Tracker
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Surveillance Maritime NC</p>
        </div>
        <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>
      </header>

      {mode === 'sender' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {isSharing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <Badge variant="outline" className="h-8 px-4 border-2 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] gap-2 shadow-sm cursor-pointer active:scale-95 transition-all" onClick={handleSyncNow}>
                    <RefreshCw className="size-3 animate-spin" /> PROCHAINE SYNCHRO : {syncCountdown}S
                </Badge>
                {vesselAccuracy && <Badge variant="secondary" className="text-[9px] font-black uppercase">GPS +/- {vesselAccuracy}m</Badge>}
              </div>

              <Card className={cn("text-white border-none shadow-xl overflow-hidden relative transition-all", vesselStatus === 'emergency' ? 'bg-red-600 animate-pulse' : 'bg-primary')}>
                <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                <CardHeader className="p-5 pb-2 relative z-10">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif
                    </p>
                    <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[9px] h-5 px-2 animate-pulse">EN LIGNE</Badge>
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter mt-2">{sharingId}</h3>
                  <p className="text-xs font-bold opacity-80 italic">{vesselNickname || 'Capitaine'}</p>
                </CardHeader>
                <CardContent className="p-5 pt-4 flex items-center gap-6 relative z-10">
                  <div className="flex items-center gap-2">
                    {vesselStatus === 'moving' ? <Move className="size-4" /> : <Anchor className="size-4" />}
                    <span className="text-xs font-black uppercase tracking-widest">
                        {vesselStatus === 'moving' ? 'En mouvement' : vesselStatus === 'stationary' ? 'Au mouillage' : vesselStatus === 'returning' ? 'Retour maison' : 'Dérive !'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-2">
                <Button variant="destructive" className="h-16 font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 text-sm" onClick={() => handleManualStatus('emergency')}>
                  <ShieldAlert className="size-6" /> {vesselStatus === 'emergency' ? 'ANNULER ASSISTANCE' : 'DEMANDE ASSISTANCE (PROBLÈME)'}
                </Button>

                <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-3">
                  <p className="text-[9px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><Settings className="size-3"/> Signalisation Manuelle</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={vesselStatus === 'returning' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] gap-2 border-2" onClick={() => handleManualStatus('returning')}>
                      <Navigation className="size-4" /> {vesselStatus === 'returning' ? 'ANNULER RETOUR' : 'RETOUR MAISON'}
                    </Button>
                    <Button variant={vesselStatus === 'landed' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] gap-2 border-2" onClick={() => handleManualStatus('landed')}>
                      <Home className="size-4" /> {vesselStatus === 'landed' ? 'QUITTER HOME' : 'HOME (À TERRE)'}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-3">
                  <p className="text-[9px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><Zap className="size-3"/> Signalement Tactique (Flotte)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['Oiseaux', 'Marlin', 'Thon', 'Tazard', 'Wahoo', 'Bonite', 'Sardines', 'Prise'].map(sig => (
                      <Button key={sig} variant="outline" className="h-12 flex flex-col items-center justify-center p-1 bg-white border-2" onClick={() => handleTacticalSignal(sig.toUpperCase())}>
                        {sig === 'Prise' ? <Camera className="size-4 mb-1 text-teal-600" /> : sig === 'Oiseaux' ? <Bird className="size-4 mb-1 text-blue-600" /> : <Fish className="size-4 mb-1 text-primary" />}
                        <span className="text-[8px] font-black uppercase">{sig}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <Button variant="ghost" className="h-12 font-black uppercase tracking-widest text-xs border-2 mt-2" onClick={handleStopSharing}>ARRÊTER LE PARTAGE</Button>
              </div>
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
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Rayon de mouillage ({mooringRadius}m)</Label>
                  <Slider value={[mooringRadius]} min={10} max={200} step={5} onValueChange={v => setMooringRadius(v[0])} />
                </div>
                <Button variant="ghost" className="w-full text-destructive font-black uppercase text-[10px] gap-2" onClick={handleResetIdentity}><Trash2 className="size-3" /> Réinitialiser mon identité</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAP SECTION */}
      <div className={cn("relative w-full transition-all bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden", isFullscreen ? "fixed inset-0 z-[150] h-screen w-screen rounded-none" : "h-[500px]")}>
        <div id="windy" className="w-full h-full"></div>
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-900 transition-opacity z-10", isInitialized ? "opacity-0 invisible" : "opacity-100 visible")}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation tactique...</p>
        </div>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className="bg-white/90 backdrop-blur-md border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}
            </Button>
            <Button size="icon" className={cn("bg-white/90 backdrop-blur-md border-2 h-10 w-10 shadow-xl", isFollowMode && "bg-primary text-white border-primary")} onClick={() => setIsFollowMode(!isFollowMode)}>
                <Compass className={cn("size-5", isFollowMode ? "text-white" : "text-primary")} />
            </Button>
        </div>

        <Button onClick={handleRecenter} className="absolute top-4 right-4 h-10 bg-white/90 backdrop-blur-md border-2 px-3 gap-2 shadow-xl z-[160] font-black uppercase text-[9px] text-primary">
            RECENTRER <LocateFixed className="size-4" />
        </Button>

        {activeVessels.map(v => v.location && (
            <OverlayView key={v.id} position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 group">
                    <div className="bg-slate-900 text-white px-2 py-1 rounded text-[10px] font-black shadow-2xl border border-white/20 flex flex-col items-center">
                        <span>{v.displayName} | {v.status === 'moving' ? 'MOUV' : v.status === 'stationary' ? 'MOUIL' : 'SOS'}</span>
                        {v.windSpeed !== undefined && (
                            <div className="flex items-center gap-2 mt-1 border-t border-white/10 pt-1">
                                <span className="text-[8px] text-blue-300">💨 {v.windSpeed} ND</span>
                                <span className="text-[8px] text-cyan-300">🌊 {v.wavesHeight}M</span>
                            </div>
                        )}
                    </div>
                    <div className={cn("p-2 rounded-full border-4 border-white shadow-2xl transition-transform", 
                        v.status === 'emergency' ? 'bg-red-600 scale-125 animate-bounce' : 
                        v.status === 'stationary' ? 'bg-orange-500' : 'bg-primary')}>
                        {v.status === 'stationary' ? <Anchor className="size-6 text-white" /> : <Navigation className="size-6 text-white" />}
                    </div>
                </div>
            </OverlayView>
        ))}
      </div>

      {!isFullscreen && (
        <div className="space-y-4">
          <Card className="border-2 shadow-sm overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="logs" className="border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary"><HistoryIcon className="size-4" /> Journaux de bord</div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-dashed divide-y bg-muted/5">
                        <div className="p-4 space-y-4">
                            <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Journal Technique (Navigation)</p>
                            <div className="space-y-2">
                                {techHistory.map((h, i) => (
                                    <div key={i} className="bg-white p-3 rounded-xl border-2 shadow-sm flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs">{h.vesselName} <span className="text-primary uppercase ml-1">{h.statusLabel}</span></span>
                                            <span className="text-[9px] opacity-40">{format(h.time, 'HH:mm:ss')} • accuracy +/- {h.accuracy}m</span>
                                        </div>
                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 space-y-4 bg-primary/5">
                            <p className="text-[9px] font-black uppercase text-primary">Journal Tactique (Pêche & Prises)</p>
                            <div className="space-y-2">
                                {tacticalHistory.map((h, i) => (
                                    <div key={i} className="bg-white p-3 rounded-xl border-2 border-primary/20 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {h.statusLabel === 'PRISE' ? <Camera className="size-4 text-teal-600" /> : <Fish className="size-4 text-primary" />}
                                            <div className="flex flex-col">
                                                <span className="font-black text-xs text-primary">{h.statusLabel}</span>
                                                <span className="text-[9px] opacity-40">{format(h.time, 'HH:mm:ss')}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase border-2" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Button variant="ghost" className="w-full h-10 text-destructive font-black uppercase text-[10px]" onClick={handleClearHistory}>Effacer l'historique</Button>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          </Card>

          <Card className="border-2 bg-muted/10">
            <CardHeader className="p-4 pb-2 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Phone className="size-4 text-primary" /> Annuaire Maritime NC
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-3 gap-4">
              <div className="space-y-3">
                <h4 className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</h4>
                <div className="flex flex-col gap-2">
                    <a href="tel:16" className="text-xs font-black flex items-center gap-1">COSS 16</a>
                    <a href="tel:15" className="text-xs font-black flex items-center gap-1">SAMU 15</a>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</h4>
                <div className="flex flex-col gap-2">
                    <a href="tel:366736" className="text-xs font-black">MÉTÉO</a>
                    <a href="tel:232100" className="text-xs font-black">PHARES</a>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">Ports</h4>
                <div className="flex flex-col gap-2">
                    <a href="tel:255000" className="text-xs font-black">VHF 12</a>
                    <a href="tel:277197" className="text-xs font-black">MOSELLE</a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
