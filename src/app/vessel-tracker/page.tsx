
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
  where,
  Timestamp,
  addDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  VolumeX,
  Check,
  Trash2,
  Home,
  RefreshCw,
  Settings,
  Smartphone,
  Bird,
  Target,
  Compass,
  Fish,
  Camera,
  Ghost,
  Users,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Waves,
  Phone,
  AlertCircle,
  BellRing
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const WINDY_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';

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
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();

  // MODES & NAVIGATION
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [viewMode, setViewMode] = useState<'alpha' | 'beta' | 'gamma'>('alpha');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [wakeLock, setWakeLock] = useState<any>(null);

  // ÉTATS TRACKING
  const [isSharing, setIsSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  
  // ALERTE & SON
  const [activeAlarm, setActiveAlarm] = useState<HTMLAudioElement | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const [audioAuthorized, setAudioAuthorized] = useState(false);

  // REFS STABILITÉ
  const shouldPanOnNextFix = useRef(false); 
  const isSharingRef = useRef(false);
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const startTimeRef = useRef<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const lastTechLogTime = useRef<number>(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // IDENTITÉ & FLOTTE
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  // PRÉFÉRENCES AUDIO & VEILLE
  const [vesselPrefs, setVesselPrefs] = useState({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, assistance: true, birds: true },
    notifySounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte', assistance: 'alerte', birds: 'bip' },
    isWatchEnabled: false,
    watchDuration: 60, // minutes
    batteryThreshold: 20 // percent
  });

  // RÉCUPÉRATION DATA
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);

  const userProfileRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const memoizedSavedVesselIds = useMemo(() => profile?.savedVesselIds || [], [profile?.savedVesselIds]);
  const vesselHistory = useMemo(() => profile?.vesselIdHistory || [], [profile?.vesselIdHistory]);
  const fleetHistory = useMemo(() => profile?.fleetIdHistory || [], [profile?.fleetIdHistory]);
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (mode === 'fleet' && fleetId) {
        return query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true));
    }
    const queryIds = [...memoizedSavedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, memoizedSavedVesselIds, mode, fleetId, isSharing, sharingId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const [techHistory, setTechHistory] = useState<{ status: string, battery: number, accuracy: number, time: Date, duration: string }[]>([]);
  const [tacticalHistory, setTacticalHistory] = useState<{ type: string, lat: number, lng: number, time: Date, wind: number, temp: number, photoUrl?: string | null }[]>([]);

  const soundsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // INITIALISATION AUDIO (Trick Background)
  const initAudioSystem = useCallback(() => {
    if (!silentAudioRef.current && typeof window !== 'undefined') {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
      audio.loop = true;
      audio.play().then(() => {
        silentAudioRef.current = audio;
        setAudioAuthorized(true);
      }).catch(() => {
        setAudioAuthorized(false);
      });
    }
  }, []);

  const playSound = useCallback((soundId: string, loop: boolean = false) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.loop = loop;
      audio.play().catch(() => {});
      if (loop) setActiveAlarm(audio);
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

  const stopAlarm = useCallback(() => {
    if (activeAlarm) {
      activeAlarm.pause();
      activeAlarm.currentTime = 0;
      setActiveAlarm(null);
      setTechHistory(prev => [{
          status: "ALERTE ARRÊTÉE MANUELLEMENT",
          battery: 0,
          accuracy: 0,
          time: new Date(),
          duration: "STOP MANUEL"
      }, ...prev]);
    }
  }, [activeAlarm]);

  // CORE TRACKING LOGIC
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharingRef.current && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo = { batteryLevel: 100, isCharging: false };
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharingRef.current, 
            lastActive: serverTimestamp(),
            fleetId: customFleetId || null,
            isGhostMode: isGhostMode,
            ...batteryInfo,
            ...data 
        };

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});

        // Journal Technique Auto (60s)
        const now = Date.now();
        if (now - lastTechLogTime.current > 60000) {
            const duration = startTimeRef.current ? differenceInMinutes(new Date(), startTimeRef.current) : 0;
            const statusLabel = data.status || vesselStatusRef.current;
            
            const logEntry = {
                status: statusLabel,
                battery: batteryInfo.batteryLevel,
                accuracy: data.accuracy || 0,
                time: new Date(),
                duration: `ACTIF ${duration} MIN`
            };

            setTechHistory(prev => [logEntry, ...prev].slice(0, 50));
            lastTechLogTime.current = now;
        }
    };
    update();
  }, [user, firestore, sharingId, customFleetId, vesselNickname, isGhostMode]);

  // GPS WATCHER
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    setIsInitializing(true);
    shouldPanOnNextFix.current = true;
    if (!startTimeRef.current) startTimeRef.current = new Date();
    isSharingRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed, heading, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, parseFloat(((speed || 0) * 1.94384).toFixed(2)));
            
            setCurrentPos(newPos);
            setCurrentSpeed(Math.round(knotSpeed));
            setCurrentHeading(heading || 0);
            
            if (knotSpeed > 0.5) lastActivityTimeRef.current = Date.now();

            // Breadcrumbs
            const now = Date.now();
            const lastBreadcrumb = lastPosRef.current;
            const distMoved = lastBreadcrumb ? getDistance(latitude, longitude, lastBreadcrumb.lat, lastBreadcrumb.lng) : 10;

            if (distMoved > 2) {
                setBreadcrumbs(prev => {
                    const thirtyMinsAgo = now - 30 * 60 * 1000;
                    return [...prev.filter(p => p.timestamp > thirtyMinsAgo), { lat: latitude, lng: longitude, timestamp: now }];
                });
            }

            if (isFollowMode && googleMap) googleMap.panTo(newPos);

            let nextStatus: VesselStatus['status'] = 'moving';
            if (knotSpeed < 0.2) {
                nextStatus = 'stationary';
            } else if (knotSpeed > 0.5 && anchorPos) {
                const distFromAnchor = getDistance(latitude, longitude, anchorPos.lat, anchorPos.lng);
                if (distFromAnchor > mooringRadius) {
                    nextStatus = 'drifting';
                    if (!activeAlarm) {
                        playSound(vesselPrefs.notifySounds.stationary || 'alerte', true);
                        toast({ variant: 'destructive', title: "ALERTE DÉRIVE", description: "Sortie du périmètre !" });
                    }
                }
            }

            lastPosRef.current = newPos;
            vesselStatusRef.current = nextStatus;
            setVesselStatus(nextStatus);
            updateVesselInFirestore({ location: { latitude, longitude }, status: nextStatus, accuracy: Math.round(accuracy) });
            setIsInitializing(false);
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, mooringRadius, anchorPos, toast, updateVesselInFirestore, googleMap, isFollowMode, playSound, vesselPrefs.notifySounds.stationary, activeAlarm]);

  // Surveillance Veille & Batterie
  useEffect(() => {
    const interval = setInterval(() => {
        if (isSharing) {
            // Batterie
            if ('getBattery' in navigator) {
                (navigator as any).getBattery().then((b: any) => {
                    if (Math.round(b.level * 100) < vesselPrefs.batteryThreshold && !b.isCharging) {
                        playSound(vesselPrefs.notifySounds.offline || 'alerte');
                    }
                });
            }
            // Veille Stratégique
            if (vesselPrefs.isWatchEnabled) {
                const idleMin = (Date.now() - lastActivityTimeRef.current) / 60000;
                if (idleMin >= vesselPrefs.watchDuration) {
                    if (!activeAlarm) playSound(vesselPrefs.notifySounds.stationary || 'alerte', true);
                }
            }
        }
    }, 30000);
    return () => clearInterval(interval);
  }, [isSharing, vesselPrefs, playSound, activeAlarm]);

  const handleStartSharing = async () => {
    initAudioSystem();
    if (!sharingId) { toast({ variant: 'destructive', title: "ID Navire requis" }); return; }
    setIsSharing(true);
    toast({ title: "Partage actif", description: `ID: ${sharingId}` });
  };

  const handleTacticalEvent = async (label: string, photo?: string | null) => {
    if (!firestore || !currentPos || !isSharing) return;
    playSound(vesselPrefs.notifySounds.birds || 'sonar');
    
    let weatherInfo = { wind: 0, temp: 0 };
    try {
        const windyData = await fetchWindyWeather(currentPos.lat, currentPos.lng);
        if (windyData.success) { weatherInfo = { wind: windyData.windSpeed, temp: windyData.temp }; }
    } catch (e) {}

    const newTacticalLog = {
        type: label, photoUrl: photo || null, lat: currentPos.lat, lng: currentPos.lng,
        time: new Date(), wind: weatherInfo.wind, temp: weatherInfo.temp
    };

    setTacticalHistory(prev => [newTacticalLog, ...prev].slice(0, 50));
    updateVesselInFirestore({ eventLabel: label });
  };

  const handleManualStatus = (st: VesselStatus['status'], label?: string) => {
    if (st === 'stationary' && currentPos) setAnchorPos(currentPos);
    else if (st === 'moving') setAnchorPos(null);
    setVesselStatus(st);
    vesselStatusRef.current = st;
    updateVesselInFirestore({ status: st, eventLabel: label || null });
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const pos = currentPos;
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const body = `[${vesselNickname.toUpperCase()}] ${vesselSmsMessage || "Assistance requise."} [${type}] Pos: ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {activeAlarm && (
          <Button variant="destructive" className="fixed top-12 left-4 right-4 z-[300] h-16 font-black uppercase text-sm animate-pulse shadow-2xl border-4 border-white" onClick={stopAlarm}>
              <VolumeX className="size-6 mr-3" /> ARRÊTER LE SON (ALARME ACTIVE)
          </Button>
      )}

      {!audioAuthorized && (
          <Alert className="bg-primary/10 border-primary/20 animate-in fade-in">
              <Zap className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-black uppercase">Interagissez avec la page pour autoriser les alertes sonores.</AlertDescription>
          </Alert>
      )}

      <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('fleet')}>Flotte (C)</Button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <GoogleMap
            mapContainerClassName="w-full h-full"
            defaultCenter={INITIAL_CENTER}
            defaultZoom={12}
            onLoad={(m) => { setGoogleMap(m); }}
            onDragStart={() => setIsFollowMode(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
        >
            {breadcrumbs.length > 1 && (
                <Polyline path={breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 3 }} />
            )}
            {currentPos && (
                <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -50%)' }} className="relative">
                        <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                        <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center" style={{ transform: `rotate(${currentHeading}deg)` }}>
                            <Navigation className="size-3 text-white fill-white" />
                        </div>
                    </div>
                </OverlayView>
            )}
            {anchorPos && (
                <OverlayView position={anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500/80 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                        <Anchor className="size-4 text-white" />
                    </div>
                </OverlayView>
            )}
            {anchorPos && <Circle center={anchorPos} radius={mooringRadius} options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }} />}
        </GoogleMap>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[200]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[200]">
            <Button onClick={() => setIsFollowMode(!isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl", isFollowMode ? "bg-primary text-white" : "bg-white text-slate-400")}>
                {isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!isFollowMode && (
                <Button onClick={() => { setIsFollowMode(true); googleMap?.panTo(currentPos!); }} className="bg-white border-2 shadow-xl h-10 px-3 font-black text-[9px] uppercase text-primary gap-2">
                    <LocateFixed className="size-4" /> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      {mode === 'sender' && (
          <div className="flex flex-col gap-3">
              {isSharing ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-3 bg-white p-1 rounded-2xl">
                          <Button variant="destructive" className="w-full h-16 font-black uppercase text-xs shadow-lg rounded-xl gap-3 bg-red-500 hover:bg-red-600" onClick={() => { handleManualStatus('emergency', 'DEMANDE ASSISTANCE'); sendEmergencySms('SOS'); }}>
                              <AlertCircle className="size-5" /> DEMANDE ASSISTANCE (SOS)
                          </Button>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" className="h-20 border-2 bg-slate-50" onClick={() => handleManualStatus('returning')} disabled={vesselStatus === 'returning'}>
                                  <Navigation className="size-5 text-blue-600 mr-2" /> Retour Maison
                              </Button>
                              <Button variant="outline" className="h-20 border-2 bg-slate-50" onClick={() => handleManualStatus('landed')} disabled={vesselStatus === 'landed'}>
                                  <Home className="size-5 text-green-600 mr-2" /> À terre
                              </Button>
                          </div>
                          
                          <Button variant={vesselStatus === 'stationary' ? 'default' : 'outline'} className={cn("w-full h-14 font-black uppercase text-xs border-2", vesselStatus === 'stationary' ? "bg-orange-500" : "border-orange-200 text-orange-600")} onClick={() => handleManualStatus(vesselStatus === 'stationary' ? 'moving' : 'stationary')}>
                              <Anchor className="size-5 mr-2" /> {vesselStatus === 'stationary' ? 'MOUILLAGE ACTIF' : 'ACTIVER MOUILLAGE'}
                          </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-2xl border-2">
                          {['OISEAUX', 'THON', 'MAHI MAHI', 'TAZARD', 'WAHOO', 'BONITE', 'SARDINES'].map(label => (
                              <Button key={label} variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => handleTacticalEvent(label)}>
                                  {label}
                              </Button>
                          ))}
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-primary/5 text-primary" onClick={() => photoInputRef.current?.click()}>
                              <Camera className="size-5 mr-2" /> PRISE (PHOTO)
                          </Button>
                          <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => handleTacticalEvent('PRISE (PHOTO)', ev.target?.result as string);
                                  reader.readAsDataURL(file);
                              }
                          }} />
                      </div>

                      <Button variant="destructive" className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl" onClick={handleStopSharing}>
                          ARRÊTER LE PARTAGE
                      </Button>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <Button className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3" onClick={handleStartSharing}>
                          <Navigation className="size-6" /> LANCER LE PARTAGE
                      </Button>
                      <div className="p-4 bg-muted/20 rounded-[2.5rem] border-2 space-y-6">
                          <div className="space-y-4">
                              <div className="space-y-1"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">Surnom du navire</Label><Input placeholder="EX: KOOL@PIK" value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} className="font-black text-center h-12 border-2 uppercase bg-white" /></div>
                              <div className="space-y-1"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID Navire (Partage)</Label><Input placeholder="EX: XXX" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase bg-white" /></div>
                          </div>
                          <div className="space-y-2 px-1">
                              <div className="flex justify-between items-center"><Label className="text-[9px] font-black uppercase opacity-60">Rayon de mouillage (m)</Label><Badge variant="outline" className="font-black h-5">{mooringRadius}m</Badge></div>
                              <Slider value={[mooringRadius]} min={10} max={200} step={10} onValueChange={v => setMooringRadius(v[0])} />
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      <div className="space-y-4">
          <Card className="border-2 shadow-sm overflow-hidden bg-muted/10">
              <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="receiver-settings" className="border-none">
                      <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl">
                          <Settings className="size-4 text-primary" />
                          <span className="text-[10px] font-black uppercase">Réglages Notifications & Veille</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-6 px-4">
                          <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                              <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                      <Label className="text-xs font-black uppercase">Alertes Sonores</Label>
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux audio</p>
                                  </div>
                                  <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                              </div>

                              <div className="space-y-3 pt-2 border-t border-dashed">
                                  <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Volume2 className="size-3" /> Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
                                  <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
                              </div>

                              <div className="space-y-4 pt-4 border-t border-dashed">
                                  <p className="text-[9px] font-black uppercase text-muted-foreground">Sons par événement</p>
                                  {['moving', 'stationary', 'offline'].map(key => (
                                      <div key={key} className="flex items-center justify-between gap-4">
                                          <span className="text-[10px] font-bold uppercase flex-1">{key === 'moving' ? 'Mouvement' : key === 'stationary' ? 'Mouillage' : 'Signal Perdu'}</span>
                                          <Select value={vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds]} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [key]: v } })}>
                                              <SelectTrigger className="h-8 text-[9px] font-black w-32 bg-muted/30"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                              <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                                          </Select>
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playSound(vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds])}><Play className="size-3" /></Button>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-4 p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100">
                              <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                      <Label className="text-xs font-black uppercase text-orange-800">Veille Stratégique</Label>
                                      <p className="text-[9px] font-bold text-orange-600/60 uppercase">Alarme si immobile trop longtemps</p>
                                  </div>
                                  <Switch checked={vesselPrefs.isWatchEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isWatchEnabled: v })} />
                              </div>
                              <div className="space-y-2 pt-2 border-t border-orange-100">
                                  <div className="flex justify-between items-center px-1">
                                      <Label className="text-[10px] font-black uppercase text-orange-800/60">Délai</Label>
                                      <Badge variant="outline" className="font-black bg-white">{vesselPrefs.watchDuration} min</Badge>
                                  </div>
                                  <Slider value={[vesselPrefs.watchDuration]} min={15} max={1440} step={15} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, watchDuration: v[0] })} />
                              </div>
                          </div>

                          <div className="space-y-4 p-4 border-2 rounded-2xl bg-red-50/30 border-red-100">
                              <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                      <Label className="text-xs font-black uppercase text-red-800">Seuil Batterie</Label>
                                      <p className="text-[9px] font-bold text-red-600/60 uppercase">Alerte audio si batterie descend sous :</p>
                                  </div>
                                  <Badge variant="outline" className="font-black">{vesselPrefs.batteryThreshold}%</Badge>
                              </div>
                              <Slider value={[vesselPrefs.batteryThreshold]} min={5} max={50} step={5} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batteryThreshold: v[0] })} />
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>
          </Card>

          <Card className="border-2 shadow-sm overflow-hidden bg-muted/10">
              <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="history" className="border-none">
                      <AccordionTrigger className="flex items-center justify-between px-4 h-12 bg-white hover:no-underline border-b">
                          <div className="flex items-center gap-2 font-black uppercase text-[10px]"><Zap className="size-3 text-primary" /> Journal de Bord</div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3">
                          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
                              {techHistory.length > 0 ? techHistory.map((log, i) => (
                                  <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl border-2 text-[9px] font-bold shadow-sm">
                                      <div className="flex flex-col gap-0.5">
                                          <span className="font-black uppercase text-slate-800">{log.status}</span>
                                          <span className="text-primary">{log.duration}</span>
                                      </div>
                                      <div className="flex items-center gap-2 opacity-60">
                                          <span>{format(log.time, 'HH:mm:ss')}</span>
                                          <span>{log.battery}%🔋</span>
                                      </div>
                                  </div>
                              )) : <p className="text-center text-[9px] font-bold uppercase opacity-30 py-4 italic">Aucune donnée technique</p>}
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>
          </Card>
      </div>
    </div>
  );

  async function saveVesselPrefs(newPrefs: any) {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  }
}
