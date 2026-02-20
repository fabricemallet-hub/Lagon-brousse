
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

  // UI States
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  // Audio State
  const [loopingSound, setLoopingSound] = useState<{ id: string, audio: HTMLAudioElement } | null>(null);
  
  // History
  const [techHistory, setTechHistory] = useState<any[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<any[]>([]);

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
  const mapMarkersRef = useRef<Record<string, { marker: any, circle?: any }>>({});

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

  // --- FUNCTIONS ---
  const handleRecenter = useCallback(() => {
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.id === sharingId)?.location ? { lat: followedVessels.find(v => v.id === sharingId)!.location!.latitude, lng: followedVessels.find(v => v.id === sharingId)!.location!.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  }, [mode, currentPos, followedVessels, sharingId, map]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const vesselRef = doc(firestore, 'vessels', sharingId);
    const snap = await getDoc(vesselRef);
    const existing = snap.exists() ? snap.data() as VesselStatus : null;

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
        ...data
    };

    if (data.status && data.status !== existing?.status) {
        payload.statusChangedAt = serverTimestamp();
    }

    setDoc(vesselRef, payload, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, isGhostMode, mooringRadius]);

  const handleStopSharing = async () => {
    setIsSharing(false);
    await updateVesselInFirestore({ isSharing: false, status: 'offline' });
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label });
    toast({ title: label || st });
  };

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayUnion(cleanId),
            lastVesselId: cleanId
        });
        setVesselIdToFollow('');
        toast({ title: "ID enregistré" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur sauvegarde" });
    }
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
        savedVesselIds: arrayRemove(id)
    });
    toast({ title: "Navire retiré" });
  };

  const handleResetIdentity = async () => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
        vesselNickname: '',
        lastVesselId: ''
    });
    setVesselNickname('');
    setCustomSharingId('');
    toast({ title: "Identité réinitialisée" });
  };

  const handleSaveSmsSettings = async () => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid), {
        emergencyContact,
        vesselSmsMessage,
        isEmergencyEnabled,
        isCustomMessageEnabled
    });
    toast({ title: "Réglages SMS sauvés" });
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); } catch (err) {} }
  };

  // --- INITIALIZATION WINDY ---
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

  // --- MARKER MANAGEMENT (NATIVE LEAFLET) ---
  useEffect(() => {
    if (!map || !followedVessels || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    followedVessels.forEach(vessel => {
        if (!vessel.location || !vessel.isSharing) {
            if (mapMarkersRef.current[vessel.id]) {
                map.removeLayer(mapMarkersRef.current[vessel.id].marker);
                if (mapMarkersRef.current[vessel.id].circle) map.removeLayer(mapMarkersRef.current[vessel.id].circle);
                delete mapMarkersRef.current[vessel.id];
            }
            return;
        }

        const pos = [vessel.location.latitude, vessel.location.longitude];
        const statusLabels: Record<string, string> = { moving: 'MOUV', stationary: 'MOUIL', emergency: 'SOS', returning: 'RETOUR', landed: 'HOME' };
        const label = statusLabels[vessel.status] || 'ACTIF';
        const color = vessel.status === 'emergency' ? '#ef4444' : vessel.status === 'stationary' ? '#f97316' : '#3b82f6';

        // Custom HTML Marker Icon
        const iconHtml = `
            <div class="flex flex-col items-center gap-1 group">
                <div class="bg-slate-900 text-white px-2 py-1 rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap">
                    ${vessel.displayName} | ${label}
                </div>
                <div class="p-2 rounded-full border-4 border-white shadow-xl transition-transform" style="background-color: ${color}">
                    <div class="text-white">${vessel.status === 'stationary' ? '⚓' : '⛵'}</div>
                </div>
            </div>
        `;

        if (!mapMarkersRef.current[vessel.id]) {
            const marker = L.marker(pos, {
                icon: L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 40] })
            }).addTo(map);
            
            let circle = null;
            if (vessel.status === 'stationary' || vessel.status === 'drifting') {
                circle = L.circle(vessel.anchorLocation ? [vessel.anchorLocation.latitude, vessel.anchorLocation.longitude] : pos, {
                    radius: vessel.mooringRadius || 20,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.15
                }).addTo(map);
            }

            mapMarkersRef.current[vessel.id] = { marker, circle };
        } else {
            const { marker, circle } = mapMarkersRef.current[vessel.id];
            marker.setLatLng(pos);
            marker.setIcon(L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 40] }));
            
            if (circle) {
                if (vessel.status === 'stationary' || vessel.status === 'drifting') {
                    circle.setLatLng(vessel.anchorLocation ? [vessel.anchorLocation.latitude, vessel.anchorLocation.longitude] : pos);
                    circle.setRadius(vessel.mooringRadius || 20);
                } else {
                    map.removeLayer(circle);
                    mapMarkersRef.current[vessel.id].circle = undefined;
                }
            } else if (vessel.status === 'stationary' || vessel.status === 'drifting') {
                mapMarkersRef.current[vessel.id].circle = L.circle(vessel.anchorLocation ? [vessel.anchorLocation.latitude, vessel.anchorLocation.longitude] : pos, {
                    radius: vessel.mooringRadius || 20,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.15
                }).addTo(map);
            }
        }
    });
  }, [map, followedVessels]);

  // GPS Watcher
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            setCurrentPos(newPos);
            setVesselAccuracy(Math.round(accuracy));
            if (isFollowMode && map) map.panTo(newPos);
        },
        () => toast({ variant: "destructive", title: "Signal perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, map, isFollowMode, toast]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto px-1 pb-32">
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
              <Card className="bg-primary text-white border-none shadow-xl overflow-hidden relative">
                <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                <CardHeader className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif
                    </p>
                    <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[9px] h-5 px-2 animate-pulse">EN LIGNE</Badge>
                  </div>
                  <h3 className="text-3xl font-black uppercase mt-2">{sharingId}</h3>
                  <p className="text-xs font-bold opacity-80 italic">{vesselNickname || 'Capitaine'}</p>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                        <Move className="size-4" />
                        <span className="text-xs font-black uppercase">{vesselStatus === 'moving' ? 'En mouvement' : 'Au mouillage'}</span>
                    </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-2">
                <Button variant="destructive" className="h-16 font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 text-sm" onClick={() => handleManualStatus('emergency', 'SOS ASSISTANCE')}>
                  <ShieldAlert className="size-6" /> SOS ASSISTANCE
                </Button>

                <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Commandes Manuelles</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={vesselStatus === 'returning' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 bg-white" onClick={() => handleManualStatus('returning')}>
                      <Navigation className="size-4 mr-2" /> Retour Maison
                    </Button>
                    <Button variant={vesselStatus === 'landed' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 bg-white" onClick={() => handleManualStatus('landed')}>
                      <Home className="size-4 mr-2" /> Home (À terre)
                    </Button>
                  </div>
                </div>

                <Button variant="ghost" className="h-12 font-black uppercase text-xs border-2" onClick={handleStopSharing}>ARRÊTER LE PARTAGE</Button>
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
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du navire (Optionnel)</Label>
                  <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="L&B-001" className="h-12 border-2 font-black" />
                </div>
                <Button variant="ghost" className="w-full text-destructive font-black uppercase text-[10px] gap-2" onClick={handleResetIdentity}><Trash2 className="size-3" /> Réinitialiser mon identité</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAP CONTAINER */}
      <div className={cn("relative w-full transition-all bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden", isFullscreen ? "fixed inset-0 z-[150] h-screen w-screen rounded-none" : "h-[500px]")}>
        <div id="windy" className="w-full h-full"></div>
        
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-900 transition-opacity z-10", isInitialized ? "opacity-0 invisible pointer-events-none" : "opacity-100 visible")}>
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
      </div>

      <Card className="border-2 shadow-sm">
        <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><HistoryIcon className="size-4" /> Journal de bord technique</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="h-48">
                <div className="divide-y">
                    {techHistory.map((h, i) => (
                        <div key={i} className="p-3 flex items-center justify-between text-[10px]">
                            <div className="flex flex-col">
                                <span className="font-black text-primary">{h.vesselName}</span>
                                <span className="font-bold uppercase">{h.statusLabel}</span>
                            </div>
                            <span className="text-muted-foreground">{format(h.time, 'HH:mm:ss')}</span>
                        </div>
                    ))}
                    {techHistory.length === 0 && <p className="text-center py-10 text-xs italic opacity-40">Aucun événement enregistré.</p>}
                </div>
            </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
