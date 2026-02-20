
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
  getDoc
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Globe,
  ChevronDown,
  Repeat,
  Target,
  Compass,
  Fish,
  Radio,
  Sun,
  Activity,
  LayoutGrid,
  Wind,
  Plus,
  Minus,
  Thermometer,
  CloudRain,
  Lock,
  Unlock
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// CONFIGURATION WINDY (CLÉ DE PRODUCTION UNIQUE)
const MAP_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 20) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 60) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const WINDY_LAYERS = [
    { id: 'wind', icon: Wind, label: 'Vent' },
    { id: 'radar', icon: Radio, label: 'Radar' },
    { id: 'gust', icon: Wind, label: 'Rafales' },
    { id: 'temp', icon: Thermometer, label: 'Temp.' },
    { id: 'rain', icon: CloudRain, label: 'Pluie' },
    { id: 'waves', icon: Waves, label: 'Houle' },
    { id: 'pressure', icon: Activity, label: 'Pression' },
    { id: 'uv', icon: Sun, label: 'UV' },
];

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);

  const [activeOverlay, setActiveOverlay] = useState('wind');
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [pickerData, setPickerData] = useState<any>(null);
  const [vesselValueAtPos, setVesselValueAtPos] = useState<string>('--');

  const [syncCountdown, setSyncCountdown] = useState(60);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [technicalLogs, setTechnicalLogs] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: {lat: number, lng: number}, batteryLevel?: number, isCharging?: boolean }[]>([]);

  const [vesselPrefs, setVesselPrefs] = useState<any>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, emergency: true },
    notifySounds: { moving: 'sonar', stationary: 'ancre', offline: 'alerte', emergency: 'sos' },
    batteryThreshold: 20
  });

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

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

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    const lat = currentPos?.lat.toFixed(6) || '-21.3';
    const lng = currentPos?.lng.toFixed(6) || '165.5';
    return `${nicknamePrefix}${customText} Position : https://www.google.com/maps?q=${lat},${lng}`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname, currentPos]);

  const watchIdRef = useRef<number | null>(null);
  const mapMarkersRef = useRef<Record<string, { marker: any, circle?: any }>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // GESTION DU CALQUE AVEC OPTIMISATION PRODUCT (RAFALES)
  const handleLayerChange = useCallback((layerId: string) => {
    if (!(window as any).W) return;
    const store = (window as any).W.store;
    
    if (layerId === 'gust') {
        store.set('overlay', 'wind');
        store.set('product', 'gust');
    } else {
        store.set('overlay', layerId);
        // Si on quitte les rafales, Windy gère généralement le reset du produit, 
        // mais on peut forcer le produit par défaut si nécessaire
    }
    
    setActiveOverlay(layerId);
    setIsLayersOpen(false);
    toast({ title: `Calque : ${layerId.toUpperCase()}` });
  }, [toast]);

  const toggleSatellite = () => {
    if (!(window as any).W) return;
    const store = (window as any).W.store;
    const current = store.get('overlay');
    const next = current === 'radar' ? 'wind' : 'radar';
    handleLayerChange(next);
  };

  const handleRecenter = useCallback(() => {
    if (!map) return;
    const activeVessel = followedVessels?.find(v => v.id === sharingId);
    const pos = mode === 'sender' ? currentPos : (activeVessel?.location ? { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude } : null);
    if (pos) {
        map.setView([pos.lat, pos.lng], 18, { animate: true });
        toast({ title: "Recentrage Tactique" });
    }
  }, [map, mode, currentPos, followedVessels, sharingId, toast]);

  const handleZoomIn = () => map?.zoomIn();
  const handleZoomOut = () => map?.zoomOut();

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    if (!cleanId) return;
    updateDoc(doc(firestore, 'users', user.uid), {
        savedVesselIds: arrayUnion(cleanId),
        lastVesselId: cleanId
    }).then(() => {
        setVesselIdToFollow('');
        toast({ title: "Navire enregistré" });
    });
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    updateDoc(doc(firestore, 'users', user.uid), {
        savedVesselIds: arrayRemove(id)
    });
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

  const playVesselSound = useCallback((soundId: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
        const audio = new Audio(sound.url);
        audio.volume = vesselPrefs.vesselVolume;
        audio.play().catch(() => {});
    }
  }, [vesselPrefs, availableSounds]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const vesselRef = doc(firestore, 'vessels', sharingId);
    let batteryUpdate: any = {};
    if ('getBattery' in navigator) {
        const b: any = await (navigator as any).getBattery();
        batteryUpdate = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
    }

    const payload: any = {
        id: sharingId,
        userId: user.uid,
        displayName: vesselNickname || user.displayName || 'Capitaine',
        isSharing: data.isSharing ?? isSharing,
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
    setSyncCountdown(60);
  }, [user, firestore, isSharing, sharingId, vesselNickname, vesselStatus]);

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
            try {
                (window as any).windyInit({ 
                  key: MAP_KEY, 
                  lat: INITIAL_CENTER.lat, 
                  lon: INITIAL_CENTER.lng, 
                  zoom: 13,
                  labels: true 
                }, (api: any) => {
                  const { map, store } = api;
                  setMap(map);
                  map.setMaxZoom(18);
                  store.set('overlay', 'wind');
                  setActiveOverlay('wind');
                  setIsInitialized(true);

                  const picker = (window as any).W.picker;
                  picker.on('pickerOpened', (data: any) => {
                      setPickerData(data);
                      if (data.overlay === 'wind') setVesselValueAtPos(`${Math.round(data.wind * 1.94384)} kts`);
                      else if (data.overlay === 'waves') setVesselValueAtPos(`${data.waves.toFixed(1)}m`);
                      else setVesselValueAtPos('--');
                  });
                  picker.on('pickerClosed', () => setPickerData(null));
                });
            } catch (initErr) {
                console.error("Windy Critical Init Error:", initErr);
                toast({ variant: 'destructive', title: "Erreur Carte", description: "Impossible d'initialiser Windy." });
            }
          }
        }, 200);
      } catch (e) {}
    };
    initMap();
  }, [toast]);

  // OPTIMISATION : Ecouteurs d'événements passifs sur le conteneur de la carte
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    
    const options = { passive: true };
    const noop = () => {};
    
    el.addEventListener('wheel', noop, options);
    el.addEventListener('touchstart', noop, options);
    
    return () => {
        el.removeEventListener('wheel', noop);
        el.removeEventListener('touchstart', noop);
    };
  }, [isInitialized]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            setCurrentPos(newPos);
            setCurrentSpeed(Math.max(0, Math.round((speed || 0) * 1.94384)));

            if (isFollowMode && map) map.panTo(newPos);

            if (!anchorPos) setAnchorPos(newPos);
            else {
                const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
                if (dist > 20 && vesselStatus === 'stationary') {
                    setVesselStatus('moving');
                    updateVesselInFirestore({ status: 'moving' });
                }
            }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    const countdownInterval = setInterval(() => {
        setSyncCountdown(prev => {
            if (prev <= 1) {
                updateVesselInFirestore({ eventLabel: 'SYNC AUTO' });
                return 60;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        clearInterval(countdownInterval);
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, mode, updateVesselInFirestore, map, isFollowMode, anchorPos, vesselStatus]);

  useEffect(() => {
    if (!map || !followedVessels || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    followedVessels.forEach(vessel => {
        const isOffline = (Date.now() - (vessel.lastActive?.toMillis() || 0)) > 70000;
        const currentStatus = isOffline ? 'OFFLINE' : (vessel.status === 'emergency' ? 'SOS' : vessel.status === 'stationary' ? 'MOUIL' : 'MOUV');
        
        if (!vessel.isSharing || isOffline) {
            if (mapMarkersRef.current[vessel.id]) {
                map.removeLayer(mapMarkersRef.current[vessel.id].marker);
                if (mapMarkersRef.current[vessel.id].circle) map.removeLayer(mapMarkersRef.current[vessel.id].circle);
                delete mapMarkersRef.current[vessel.id];
            }
            return;
        }

        const pos = [vessel.location!.latitude, vessel.location!.longitude];
        const color = vessel.status === 'emergency' ? '#ef4444' : vessel.status === 'stationary' ? '#f97316' : '#3b82f6';

        const iconHtml = `
            <div class="flex flex-col items-center gap-1">
                <div class="bg-slate-900/90 text-white px-2 py-1 rounded text-[10px] font-black shadow-2xl border border-white/20 flex flex-col items-center backdrop-blur-md">
                    <span>${vessel.displayName} | ${currentStatus}</span>
                    <span class="text-[8px] flex items-center gap-1 opacity-70">
                        ${vessel.batteryLevel ?? 100}% ${vessel.isCharging ? '⚡' : ''}
                    </span>
                </div>
                <div class="p-2.5 rounded-full border-4 border-white shadow-2xl" style="background-color: ${color}">
                    <div class="text-white text-xl">${vessel.status === 'stationary' ? '⚓' : '⛵'}</div>
                </div>
            </div>
        `;

        if (!mapMarkersRef.current[vessel.id]) {
            const marker = L.marker(pos, { icon: L.divIcon({ html: iconHtml, className: '', iconSize: [60, 80], iconAnchor: [30, 80] }) }).addTo(map);
            mapMarkersRef.current[vessel.id] = { marker };
        } else {
            const entry = mapMarkersRef.current[vessel.id];
            entry.marker.setLatLng(pos);
            entry.marker.setIcon(L.divIcon({ html: iconHtml, className: '', iconSize: [60, 80], iconAnchor: [30, 80] }));
        }

        // Journal technique
        const lastStatus = lastStatusesRef.current[vessel.id];
        if (lastStatus && lastStatus !== currentStatus) {
            setTechnicalLogs(prev => [{
                vesselName: vessel.displayName || vessel.id,
                statusLabel: currentStatus,
                time: new Date(),
                pos: vessel.location ? { lat: vessel.location.latitude, lng: vessel.location.longitude } : INITIAL_CENTER,
                batteryLevel: vessel.batteryLevel,
                isCharging: vessel.isCharging
            }, ...prev].slice(0, 50));
        }
        lastStatusesRef.current[vessel.id] = currentStatus;
    });
  }, [map, followedVessels]);

  const handleManualStatusSet = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label });
    playVesselSound('sonar');
    toast({ title: label });
  };

  const handleStopSharingInternal = () => {
    setIsSharing(false);
    updateVesselInFirestore({ isSharing: false, status: 'offline' });
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
  };

  const toggleWakeLockInternal = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); } }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const sendEmergencySmsInternal = (type: string) => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Contact requis" }); return; }
    const body = `${smsPreview} [${type}]`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2"><Globe className="text-primary" /> Cockpit Navigation</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pilot Interface v22.2</p>
        </div>
        <div className="flex bg-slate-900/10 p-1 rounded-xl border-2">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>
      </header>

      <div className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4"><Navigation className="size-32" /></div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-xl shadow-lg animate-pulse"><Ship className="size-6 text-white" /></div>
                  <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-primary">MON BATEAU</h2>
                      <div className="flex items-center gap-3 mt-1">
                          <p className="text-xl font-black tracking-tighter">{currentSpeed} <span className="text-[10px] opacity-60">Kts</span></p>
                          <div className="h-4 w-px bg-white/20" />
                          <p className="text-[10px] font-mono text-slate-400">
                              {currentPos ? `${currentPos.lat.toFixed(4)}°S / ${currentPos.lng.toFixed(4)}°E` : 'RECHERCHE GPS...'}
                          </p>
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-6 border-l border-white/10 pl-6 h-full">
                  <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black uppercase text-slate-500">Capteur Windy</span>
                      <p className="text-sm font-black text-blue-400 uppercase">{activeOverlay} : {vesselValueAtPos}</p>
                  </div>
                  <Badge variant="outline" className="border-green-500/50 text-green-400 font-black text-[9px]">SIGNAL ACTIF</Badge>
              </div>
          </div>
      </div>

      <div ref={mapContainerRef} className={cn("relative w-full transition-all bg-slate-950 rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden", isFullscreen ? "fixed inset-0 z-[150] h-screen w-screen rounded-none" : "h-[600px]")}>
        <div id="windy" className="w-full h-full"></div>
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-950 transition-opacity z-10", isInitialized ? "opacity-0 invisible pointer-events-none" : "opacity-100 visible")}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Chargement Windy...</p>
        </div>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[160]">
            <Button size="icon" className={cn("bg-slate-900/90 text-white backdrop-blur-md border-2 h-12 w-12 shadow-2xl transition-all", isLayersOpen ? "border-primary" : "border-white/10")} onClick={() => setIsLayersOpen(!isLayersOpen)}>
                <LayoutGrid className="size-6" />
            </Button>
            
            {isLayersOpen && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-left-4 duration-300">
                    {WINDY_LAYERS.map(layer => (
                        <Button key={layer.id} size="icon" className={cn("size-12 rounded-full shadow-xl border-2 transition-all backdrop-blur-lg", activeOverlay === layer.id ? "bg-primary border-white scale-110" : "bg-slate-900/80 border-white/10")} onClick={() => handleLayerChange(layer.id)}>
                            <layer.icon className="size-5 text-white" />
                        </Button>
                    ))}
                </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
                <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}</Button>
                
                <Button size="icon" className={cn("bg-white border-2 h-10 w-10 shadow-xl", activeOverlay === 'radar' ? "border-primary bg-primary/10" : "border-slate-200")} onClick={toggleSatellite}>
                    <Globe className={cn("size-5", activeOverlay === 'radar' ? "text-primary" : "text-slate-400")} />
                </Button>

                <Button size="icon" className={cn("bg-white border-2 h-10 w-10 shadow-xl", isFollowMode ? "border-blue-500 bg-blue-50" : "border-slate-200")} onClick={() => setIsFollowMode(!isFollowMode)}>
                    {isFollowMode ? <Lock className="size-5 text-blue-600" /> : <Unlock className="size-5 text-slate-400" />}
                </Button>
                
                <Button onClick={handleRecenter} className="h-10 bg-primary text-white border-2 border-white/20 px-3 gap-2 shadow-xl font-black uppercase text-[9px]">RECENTRER <LocateFixed className="size-4" /></Button>
                
                <div className="flex flex-col gap-1 mt-2">
                    <Button size="icon" className="bg-slate-900/80 text-white border-2 border-white/10 h-10 w-10 shadow-xl" onClick={handleZoomIn}><Plus className="size-5" /></Button>
                    <Button size="icon" className="bg-slate-900/80 text-white border-2 border-white/10 h-10 w-10 shadow-xl" onClick={handleZoomOut}><Minus className="size-5" /></Button>
                </div>
            </div>
        </div>

        {pickerData && (
            <div className="absolute bottom-6 left-6 right-6 z-[160] animate-in slide-in-from-bottom-4 duration-300">
                <Card className="bg-slate-900/95 backdrop-blur-xl border-2 border-primary/30 text-white shadow-2xl overflow-hidden rounded-3xl">
                    <CardHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg"><Target className="size-4 text-primary" /></div>
                            <div><CardTitle className="text-xs font-black uppercase tracking-widest">INFO POINT</CardTitle><CardDescription className="text-[8px] font-bold text-slate-400 uppercase">Données locales</CardDescription></div>
                        </div>
                        <button onClick={() => (window as any).W.picker.close()} className="p-1.5 hover:bg-white/10 rounded-full"><X className="size-4" /></button>
                    </CardHeader>
                    <CardContent className="p-4 grid grid-cols-2 gap-4">
                        <div className="space-y-1"><span className="text-[8px] font-black uppercase text-slate-500">Coordonnées</span><p className="text-xs font-mono font-bold">{pickerData.lat.toFixed(4)} / {pickerData.lon.toFixed(4)}</p></div>
                        <div className="space-y-1 text-right"><span className="text-[8px] font-black uppercase text-primary">Valeur</span><p className="text-lg font-black text-primary">{activeOverlay.toUpperCase()} : {vesselValueAtPos}</p></div>
                    </CardContent>
                </Card>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
            {mode === 'sender' ? (
                <div className="space-y-4">
                    {isSharing ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <Card className={cn("text-white border-none shadow-xl overflow-hidden relative", vesselStatus === 'landed' ? "bg-green-600" : "bg-primary")}>
                                <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                                <CardHeader className="p-5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300" /> Partage Actif</p>
                                        <Badge onClick={() => updateVesselInFirestore({ eventLabel: 'MAJ FORCÉE' })} className="bg-white/20 border-white/20 text-white font-black text-[10px] h-6 px-3 cursor-pointer">SYNC {syncCountdown}S</Badge>
                                    </div>
                                    <h3 className="text-3xl font-black mt-2 uppercase">{vesselNickname || sharingId}</h3>
                                </CardHeader>
                            </Card>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => handleManualStatusSet('returning', 'RETOUR MAISON')}><Navigation className="mr-2 size-4" /> RETOUR MAISON</Button>
                                <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => handleManualStatusSet('landed', 'HOME (À TERRE)')}><Home className="mr-2 size-4" /> HOME (À TERRE)</Button>
                            </div>
                            <Button variant="destructive" className="w-full h-14 font-black uppercase text-xs tracking-widest" onClick={handleStopSharingInternal}>
                                <X className="mr-2 size-4" /> ARRÊTER LE PARTAGE
                            </Button>
                        </div>
                    ) : (
                        <Button className="w-full h-20 text-lg font-black uppercase tracking-widest shadow-xl rounded-2xl gap-4" onClick={() => setIsSharing(true)}><Navigation className="size-8" /> Partager ma position</Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label><div className="flex gap-2"><Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" /><Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={handleSaveVessel} disabled={!vesselIdToFollow.trim()}><Check className="size-4" /></Button></div></div>
                    {savedVesselIds.map(id => (
                        <div key={id} className="flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm">
                            <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg text-primary"><Ship className="size-4" /></div><span className="font-black text-xs uppercase">{id}</span></div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveSavedVessel(id)} className="size-8 text-destructive/40 hover:text-destructive border-2"><Trash2 className="size-3" /></Button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <Card className="border-2 shadow-sm overflow-hidden bg-card h-full">
            <CardHeader className="p-4 border-b bg-muted/5 flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><HistoryIcon className="size-3" /> Journal de bord technique</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black text-destructive" onClick={() => setTechnicalLogs([])}><Trash2 className="size-3 mr-1" /> Effacer</Button>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-64">
                    <div className="divide-y">
                        {technicalLogs.map((h, i) => (
                            <div key={i} className="p-3 flex items-center justify-between text-[10px] hover:bg-muted/30 transition-colors">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                        <span className={cn("font-black", h.statusLabel === 'SOS' ? 'text-red-600 animate-pulse' : '')}>{h.statusLabel}</span>
                                        <BatteryIconComp level={h.batteryLevel} charging={h.isCharging} className="size-2.5" />
                                    </div>
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(h.time, 'HH:mm:ss')}</span>
                                </div>
                                <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => { map?.setView([h.pos.lat, h.pos.lng], 18); }}>GPS</Button>
                            </div>
                        ))}
                        {technicalLogs.length === 0 && <p className="p-8 text-center text-[10px] font-black uppercase opacity-20 italic">Aucun événement</p>}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
      </div>

      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="sms-config" className="border-none">
              <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50 border-2 border-orange-100 rounded-xl"><Smartphone className="size-4 text-orange-600" /><span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span></AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <div className="p-4 bg-white border-2 rounded-2xl space-y-4 shadow-inner">
                      <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">Contact d'urgence (Terre)</Label><Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black" /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">Message personnalisé</Label><Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="min-h-[80px] border-2" /></div>
                      <div className="p-3 bg-muted/30 rounded-xl border-2 border-dashed text-[10px] italic">Aperçu : {smsPreview}</div>
                      <Button onClick={handleSaveSmsSettings} className="w-full h-12 font-black uppercase text-[10px] gap-2"><Save className="size-4" /> Enregistrer réglages SMS</Button>
                  </div>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      <Card className="border-2 bg-muted/10 shadow-none rounded-2xl overflow-hidden mt-4">
        <CardHeader className="p-4 pb-2 border-b bg-muted/5">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4 text-primary" /> Annuaire Maritime NC
            </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2 border-b pb-1"><ShieldAlert className="size-3" /> Urgences</h4><div className="space-y-2"><a href="tel:16" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">COSS NC (Mer)</span><span className="text-sm font-black group-hover:text-red-600 transition-colors">16</span></a><a href="tel:15" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">SAMU (Terre)</span><span className="text-sm font-black group-hover:text-red-600 transition-colors">15</span></a></div></div>
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 border-b pb-1"><Waves className="size-3" /> Services</h4><div className="space-y-2"><a href="tel:366736" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">Météo Marine</span><span className="text-sm font-black group-hover:text-blue-600 transition-colors">36 67 36</span></a></div></div>
          <div className="space-y-3"><h4 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 border-b pb-1"><Ship className="size-3" /> Ports</h4><div className="space-y-2"><a href="tel:255000" className="flex flex-col group"><span className="text-[9px] font-bold text-muted-foreground uppercase">Port Autonome</span><span className="text-sm font-black group-hover:text-indigo-600 transition-colors">25 50 00</span></a></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
