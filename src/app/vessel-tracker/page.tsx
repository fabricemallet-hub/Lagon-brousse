
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
  deleteDoc
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
  Layers,
  Lock,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const WINDY_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';

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

  // APP MODES
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [viewMode, setViewMode] = useState<'alpha' | 'beta' | 'gamma'>('alpha');
  
  // TRACKING STATES
  const [isSharing, setIsSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);

  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  
  // WINDY STATES
  const [windyLayer, setWindyLayer] = useState<'wind' | 'waves' | 'radar'>('wind');
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);
  const windyAPI = useRef<any>(null);
  const windyStore = useRef<any>(null);
  const windyLeafletMap = useRef<any>(null);
  const isWindyInitializing = useRef(false);
  const windyRetryCount = useRef(0);

  // REFS FOR STABILITY
  const shouldPanOnNextFix = useRef(false); 
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const isSharingRef = useRef(false);
  const anchorPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lowSpeedStartTime = useRef<number | null>(null);
  const isFollowModeRef = useRef(true);

  // IDENTITY
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [mooringRadius, setMooringRadius] = useState(100);
  
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  // AUDIO
  const [vesselPrefs, setVesselPrefs] = useState({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte' },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20
  });

  // Sync Refs
  useEffect(() => { isFollowModeRef.current = isFollowMode; }, [isFollowMode]);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const fleetId = useMemo(() => customFleetId.trim().toUpperCase(), [customFleetId]);

  const userProfileRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const memoizedSavedVesselIds = useMemo(() => profile?.savedVesselIds || [], [profile?.savedVesselIds]);
  
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

  const soundsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  // --- LOGIQUE WINDY & RENDU ---
  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || viewMode === 'alpha' || isWindyInitializing.current) return;

    const bootSequentially = async () => {
        isWindyInitializing.current = true;
        const check = () => typeof (window as any).L !== 'undefined' && typeof (window as any).windyInit !== 'undefined';
        let attempts = 0;
        while (!check() && attempts < 50) { await new Promise(r => setTimeout(r, 200)); attempts++; }

        if (check()) {
            const options = {
                key: WINDY_KEY,
                lat: currentPos?.lat || INITIAL_CENTER.lat,
                lon: currentPos?.lng || INITIAL_CENTER.lng,
                zoom: googleMap?.getZoom() || 12,
                layer: windyLayer,
            };

            try {
                (window as any).windyInit(options, (windyApi: any) => {
                    const { map, store } = windyApi;
                    windyAPI.current = windyApi;
                    windyStore.current = store;
                    windyLeafletMap.current = map;
                    setIsWindyLoaded(true);
                    isWindyInitializing.current = false;
                    windyRetryCount.current = 0;
                    
                    setTimeout(() => map.invalidateSize(), 800);

                    googleMap?.addListener('idle', () => {
                        if (viewMode === 'beta' && windyLeafletMap.current) {
                            const center = googleMap.getCenter();
                            if (center) windyLeafletMap.current.setView([center.lat(), center.lng()], googleMap.getZoom());
                        }
                    });
                });
            } catch (err) {
                console.error("Windy Init Error:", err);
                isWindyInitializing.current = false;
                if (windyRetryCount.current < 3) {
                    windyRetryCount.current++;
                    setTimeout(initWindy, 2000 * windyRetryCount.current);
                }
            }
        } else {
            isWindyInitializing.current = false;
        }
    };
    bootSequentially();
  }, [viewMode, currentPos, googleMap, windyLayer]);

  useEffect(() => {
    if (viewMode !== 'alpha' && !isWindyLoaded) {
        const lScript = document.createElement('script');
        lScript.src = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js';
        lScript.async = true;
        document.head.appendChild(lScript);

        const wScript = document.createElement('script');
        wScript.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
        wScript.async = true;
        document.head.appendChild(wScript);

        lScript.onload = () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.css';
            document.head.appendChild(link);
        };
        wScript.onload = () => initWindy();
    }
  }, [viewMode, isWindyLoaded, initWindy]);

  useEffect(() => {
    if (isWindyLoaded && windyStore.current) {
        windyStore.current.set('overlay', windyLayer);
    }
  }, [windyLayer, isWindyLoaded]);

  // Forcer le redimensionnement de Google Maps lors du retour en mode Alpha
  useEffect(() => {
    if (viewMode === 'alpha' && googleMap) {
        const timer = setTimeout(() => {
            google.maps.event.trigger(googleMap, 'resize');
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [viewMode, googleMap]);

  // --- TRACKING CORE ---
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharingRef.current && data.isSharing !== false)) return;
    
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
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharingRef.current, 
            lastActive: serverTimestamp(),
            fleetId: customFleetId || null,
            isGhostMode: isGhostMode,
            ...batteryInfo,
            ...data 
        };

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, sharingId, customFleetId, vesselNickname, isGhostMode]);

  const handleStopSharing = useCallback(async () => {
    setIsSharing(false);
    isSharingRef.current = false;
    setIsInitializing(false);
    
    if (user && firestore) {
        await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }).catch(() => {});
    }

    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  }, [user, firestore, toast, sharingId]);

  // GPS WATCHER
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) return;
    
    setIsInitializing(true);
    shouldPanOnNextFix.current = true;
    if (!startTimeRef.current) startTimeRef.current = new Date();

    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed, heading, accuracy } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            const knotSpeed = Math.max(0, parseFloat(((speed || 0) * 1.94384).toFixed(2)));
            
            setCurrentPos(newPos);
            setCurrentSpeed(Math.round(knotSpeed));
            setCurrentHeading(heading || 0);
            
            if (isFollowModeRef.current && googleMap) {
                googleMap.panTo(newPos);
                if (shouldPanOnNextFix.current) {
                    googleMap.setZoom(15);
                    shouldPanOnNextFix.current = false;
                }
            }

            let nextStatus: VesselStatus['status'] = 'moving';
            if (knotSpeed < 0.2) nextStatus = 'stationary';
            else if (knotSpeed > 0.5 && anchorPosRef.current) {
                if (getDistance(latitude, longitude, anchorPosRef.current.lat, anchorPosRef.current.lng) > 20) nextStatus = 'drifting';
            }

            updateVesselInFirestore({ location: { latitude, longitude }, status: nextStatus, accuracy: Math.round(accuracy) });
        },
        () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isSharing, toast, updateVesselInFirestore, googleMap]);

  const handleRecenter = () => {
    setIsFollowMode(true);
    if (currentPos && googleMap) {
        googleMap.panTo(currentPos);
        googleMap.setZoom(15);
    }
    toast({ title: "Verrouillage GPS activé" });
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); } }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  return (
    <div className="w-full space-y-4 pb-32">
      <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px]" onClick={() => setMode('fleet')}>Flotte (C)</Button>
      </div>

      <div 
        className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}
        style={{ height: isFullscreen ? '100dvh' : '500px' }}
      >
        <div 
            id="windy" 
            className={cn(
                "absolute inset-0 z-10 transition-opacity duration-500", 
                viewMode === 'alpha' ? "hidden opacity-0 pointer-events-none" : "block"
            )} 
            style={{ opacity: viewMode === 'beta' ? 0.6 : 1, width: '100%', height: '100%' }} 
        />
        
        <GoogleMap
            mapContainerClassName="w-full h-full"
            defaultCenter={INITIAL_CENTER}
            defaultZoom={12}
            onLoad={(m) => { setGoogleMap(m); setTimeout(() => google.maps.event.trigger(m, 'resize'), 800); }}
            onDragStart={() => setIsFollowMode(false)}
            options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
        >
            {currentPos && (
                <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
                        <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                        <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center" style={{ transform: `rotate(${currentHeading}deg)` }}>
                            <Navigation className="size-3 text-white fill-white" />
                        </div>
                    </div>
                </OverlayView>
            )}
            {followedVessels?.map(v => v.id !== sharingId && v.location && (
                <OverlayView key={v.id} position={{ lat: v.location.latitude, lng: v.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <Badge className="bg-slate-900/90 text-white border-white/20 whitespace-nowrap text-[8px] font-black">{v.displayName || v.id}</Badge>
                        <div className="p-1.5 rounded-full bg-primary border-2 border-white shadow-xl"><Navigation className="size-3 text-white" /></div>
                    </div>
                </OverlayView>
            ))}
        </GoogleMap>
        
        {/* BOUTONS FLOTTANTS MAP - Z-INDEX SUPÉRIEUR POUR GARANTIR LE CLIC */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[200]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border-2 shadow-xl">
                <Button variant={viewMode === 'alpha' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('alpha')}>Alpha</Button>
                <Button variant={viewMode === 'beta' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('beta')}>Béta</Button>
                <Button variant={viewMode === 'gamma' ? "default" : "ghost"} size="sm" className="h-8 text-[8px] font-black uppercase" onClick={() => setViewMode('gamma')}>Gamma</Button>
            </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[200]">
            <Button 
                onClick={() => setIsFollowMode(!isFollowMode)} 
                className={cn("h-10 w-10 border-2 shadow-xl p-0", isFollowMode ? "bg-primary text-white" : "bg-white/90 text-slate-400")}
            >
                {isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!isFollowMode && currentPos && (
                <Button onClick={handleRecenter} className="bg-white text-primary border-2 shadow-xl h-10 font-black text-[10px] uppercase gap-2 px-3 animate-in fade-in slide-in-from-right-2">
                    <LocateFixed className="size-4" /> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-1">
          {isSharing ? (
              <Button variant="destructive" className="w-full h-16 font-black uppercase shadow-xl rounded-2xl border-4 border-white/20 gap-3" onClick={handleStopSharing}>
                  <X className="size-6" /> ARRÊTER LE PARTAGE
              </Button>
          ) : (
              <Button className="w-full h-16 text-sm font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3" onClick={() => setIsSharing(true)}>
                  <Navigation className="size-6" /> LANCER LE PARTAGE
              </Button>
          )}
      </div>

      <Card className="border-2 shadow-sm bg-muted/10 overflow-hidden">
          <Tabs defaultValue="tactical">
              <TabsList className="grid w-full grid-cols-2 h-12 rounded-none border-b bg-white">
                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase gap-2"><Target className="size-3" /> Cockpit Tactique</TabsTrigger>
                  <TabsTrigger value="tech" className="text-[10px] font-black uppercase gap-2"><Smartphone className="size-3" /> Télémétrie Tech</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tactical" className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => { toast({ title: "MARLIN signalé" }); updateVesselInFirestore({ eventLabel: "MARLIN" }); }}><Fish className="size-4 text-blue-600" /> MARLIN</Button>
                      <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => { toast({ title: "THON signalé" }); updateVesselInFirestore({ eventLabel: "THON" }); }}><Fish className="size-4 text-red-600" /> THON</Button>
                      <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => { toast({ title: "TAZARD signalé" }); updateVesselInFirestore({ eventLabel: "TAZARD" }); }}><Fish className="size-4 text-emerald-600" /> TAZARD</Button>
                      <Button variant="outline" className="h-16 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => { toast({ title: "OISEAUX signalés" }); updateVesselInFirestore({ eventLabel: "OISEAUX" }); }}><Bird className="size-4 text-slate-600" /> OISEAUX</Button>
                  </div>
              </TabsContent>

              <TabsContent value="tech" className="p-4 space-y-4">
                  <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white border-2 rounded-xl">
                          <div className="space-y-0.5"><p className="text-[9px] font-black uppercase opacity-40">Identité Navire</p><p className="font-black text-xs">{sharingId}</p></div>
                          <Badge variant="outline" className="h-5 text-[8px] font-black uppercase">{vesselStatus}</Badge>
                      </div>
                      <Accordion type="single" collapsible>
                          <AccordionItem value="settings" className="border-none">
                              <AccordionTrigger className="bg-white border-2 rounded-xl px-4 py-2 hover:no-underline"><Settings className="size-4 mr-2" /><span className="text-[10px] font-black uppercase">Réglages IDs & Flotte</span></AccordionTrigger>
                              <AccordionContent className="pt-4 space-y-4">
                                  <div className="space-y-1.5">
                                      <Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID Flotte C (Partage Amis)</Label>
                                      <Input placeholder="EX: MA-BANDE" value={customFleetId} onChange={e => setCustomFleetId(e.target.value)} className="h-11 border-2 font-black uppercase" />
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white border-2 rounded-xl">
                                      <div className="space-y-0.5"><Label className="text-[10px] font-black uppercase">Mode Fantôme</Label><p className="text-[8px] font-bold text-muted-foreground uppercase">Masquer pour la Flotte C</p></div>
                                      <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                                  </div>
                                  <Button className="w-full h-12 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => toast({ title: "Préférences mémorisées" })}><Save className="size-4" /> Sauver les réglages</Button>
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                  </div>
              </TabsContent>
          </Tabs>
      </Card>
    </div>
  );
}
