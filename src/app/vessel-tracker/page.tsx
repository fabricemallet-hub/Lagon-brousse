'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useSimulator } from '@/logic/shared/useSimulator';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
import { GoogleMap, OverlayView, Polyline, Circle } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase,
  useCollection
} from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  AlertTriangle,
  BatteryFull, 
  BatteryCharging,
  WifiOff,
  History as HistoryIcon, 
  MapPin, 
  X, 
  Play, 
  RefreshCw, 
  Home, 
  Settings, 
  Smartphone, 
  Bird, 
  Target, 
  Fish, 
  Camera, 
  Ghost, 
  Users, 
  Phone, 
  Waves, 
  Save, 
  Battery,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Volume2,
  Timer,
  Bell,
  Eye,
  EyeOff,
  ClipboardList,
  Lock,
  Unlock,
  TestTube2,
  CloudRain,
  Wind,
  Thermometer,
  CloudLightning,
  Sun,
  Move,
  Copy
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn, getDistance } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { UserAccount, VesselStatus, SoundLibraryEntry } from '@/lib/types';
import { useGoogleMaps } from '@/context/google-maps-context';
import { useToast } from '@/hooks/use-toast';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const TACTICAL_SPECIES = [
    { label: 'MARLIN', icon: Target },
    { label: 'THON', icon: Fish },
    { label: 'TAZARD', icon: Fish },
    { label: 'WAHOO', icon: Fish },
    { label: 'BONITE', icon: Fish },
    { label: 'SARDINES', icon: Waves },
    { label: 'OISEAUX', icon: Bird }
];

const TACTICAL_ICONS: Record<string, any> = {
    'MARLIN': Target,
    'THON': Fish,
    'TAZARD': Fish,
    'WAHOO': Fish,
    'BONITE': Fish,
    'SARDINES': Waves,
    'OISEAUX': Bird,
    'PHOTO': Camera
};

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600 animate-pulse")} />;
  if (level <= 50) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const BatteryLow = (props: any) => <Battery className={props.className} />;
const BatteryMedium = (props: any) => <Battery className={props.className} />;

const VesselMarker = ({ vessel }: { vessel: VesselStatus }) => {
    const status = vessel.status || 'moving';
    const heading = vessel.heading || 0;
    
    let Icon = Navigation;
    let bgColor = 'bg-green-600'; 
    let animationClass = '';
    let iconClass = 'size-4 text-white';
    let statusLabel = 'EN ROUTE';

    switch (status) {
        case 'stationary':
            Icon = Anchor; 
            bgColor = 'bg-blue-600';
            statusLabel = 'MOUILLAGE';
            break;
        case 'drifting':
            Icon = AlertTriangle;
            bgColor = 'bg-red-600';
            animationClass = 'animate-blink-red';
            statusLabel = 'DÉRIVE';
            break;
        case 'emergency':
            Icon = ShieldAlert;
            bgColor = 'bg-red-600';
            animationClass = 'animate-pulse-red';
            statusLabel = 'MAYDAY';
            break;
        case 'returning':
            Icon = Navigation;
            bgColor = 'bg-green-600';
            statusLabel = 'RETOUR';
            break;
        case 'landed':
            Icon = Home;
            bgColor = 'bg-green-600';
            statusLabel = 'À TERRE';
            break;
        case 'moving':
        default:
            Icon = Navigation;
            bgColor = 'bg-green-600';
            statusLabel = 'MOUVEMENT';
            break;
    }

    return (
        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 group cursor-pointer z-[1000]">
            <div className="flex flex-col items-center">
                <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex flex-col items-center gap-0.5 min-w-[80px]">
                    <div className="flex items-center gap-2 w-full justify-between">
                        <span className="truncate max-w-[60px]">{vessel.displayName || vessel.id}</span>
                        <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-3" />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 border-t border-white/10 pt-0.5 w-full justify-center">
                        <span className={cn("text-[7px] font-black uppercase tracking-tighter", 
                            status === 'moving' ? "text-green-400" : 
                            status === 'stationary' ? "text-blue-400" : 
                            "text-red-400"
                        )}>
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </div>
            <div 
                className={cn(
                    "p-2 rounded-full border-2 border-white shadow-xl transition-all", 
                    bgColor, 
                    animationClass
                )}
                style={{
                    transform: (status === 'moving' || status === 'returning' || status === 'stationary' || status === 'drifting') ? `rotate(${heading}deg)` : 'none'
                }}
            >
                <Icon className={iconClass} />
            </div>
        </div>
    );
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();
  
  const [appMode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const mapCore = useMapCore();
  const simulator = useSimulator();

  const handlePositionUpdate = useCallback((lat: number, lng: number, status: string) => {
    mapCore.updateBreadcrumbs(lat, lng, status);
    if (mapCore.isFollowMode && mapCore.googleMap) {
        mapCore.googleMap.panTo({ lat, lng });
    }
  }, [mapCore.updateBreadcrumbs, mapCore.isFollowMode, mapCore.googleMap]);

  const handleStopCleanup = useCallback(() => {
    mapCore.clearBreadcrumbs();
  }, [mapCore.clearBreadcrumbs]);

  const emetteur = useEmetteur(
    handlePositionUpdate,
    handleStopCleanup,
    simulator
  );
  
  const recepteur = useRecepteur(emetteur.sharingId);
  const flotte = useFlotte(emetteur.sharingId, emetteur.vesselNickname);
  
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const ids = [...savedVesselIds];
    if (emetteur.isSharing && !ids.includes(emetteur.sharingId)) {
        ids.push(emetteur.sharingId);
    }
    if (ids.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, user, savedVesselIds, emetteur.isSharing, emetteur.sharingId]);

  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const activeAnchorVessel = useMemo(() => {
    if (!followedVessels || mapCore.isCirclesHidden) return null;
    return followedVessels.find(v => v.isSharing && v.id === emetteur.sharingId && v.anchorLocation) 
        || followedVessels.find(v => v.isSharing && v.anchorLocation);
  }, [followedVessels, emetteur.sharingId, mapCore.isCirclesHidden]);

  useEffect(() => {
    if (followedVessels) {
        recepteur.processVesselAlerts(followedVessels);
    }
  }, [followedVessels, recepteur.processVesselAlerts]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasCenteredInitially = useRef(false);

  useEffect(() => {
    if (emetteur.currentPos && !hasCenteredInitially.current && mapCore.googleMap) {
        mapCore.handleRecenter(emetteur.currentPos);
        hasCenteredInitially.current = true;
    }
  }, [emetteur.currentPos, mapCore.googleMap, mapCore.handleRecenter]);

  useEffect(() => {
    const ids = [];
    if (emetteur.isSharing) ids.push(emetteur.sharingId);
    const unsub = mapCore.syncTacticalMarkers(ids);
    return () => unsub();
  }, [emetteur.isSharing, emetteur.sharingId, mapCore.syncTacticalMarkers]);

  const [isLedActive, setIsLedActive] = useState(false);
  useEffect(() => {
    if (emetteur.lastSyncTime > 0) {
      setIsLedActive(true);
      const timer = setTimeout(() => setIsLedActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emetteur.lastSyncTime]);

  const handleRecenter = () => {
    if (emetteur.currentPos) {
        mapCore.handleRecenter(emetteur.currentPos);
    } else {
        toast({ description: "En attente de signal GPS..." });
    }
  };

  const handleCopyLogEntry = (log: any) => {
    if (!log.pos) return;
    const time = format(log.time, 'HH:mm:ss');
    const text = `Lat: ${log.pos.lat.toFixed(6)}, Lng: ${log.pos.lng.toFixed(6)} - [${log.label || log.type || log.statusLabel}] à ${time} - Lien: https://www.google.com/maps?q=${log.pos.lat},${log.pos.lng}`;
    navigator.clipboard.writeText(text).then(() => {
        toast({ title: "POSITION COPIÉE", description: "Format prêt pour SMS/WhatsApp" });
    });
  };

  const windyUrl = useMemo(() => {
    const centerLat = mapCore.googleMap?.getCenter()?.lat() || INITIAL_CENTER.lat;
    const centerLng = mapCore.googleMap?.getCenter()?.lng() || INITIAL_CENTER.lng;
    const currentZoom = mapCore.googleMap?.getZoom() || 11;
    const layer = mapCore.windyLayer === 'wind' ? 'wind' : 
                  mapCore.windyLayer === 'temp' ? 'temp' : 
                  mapCore.windyLayer === 'waves' ? 'waves' : 'wind';
    return `https://embed.windy.com/embed2.html?lat=${centerLat}&lon=${centerLng}&zoom=${currentZoom}&level=surface&overlay=${layer}&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1`;
  }, [mapCore.googleMap, mapCore.windyLayer]);

  const handleStartSharingEnhanced = () => {
    recepteur.initAudio(); 
    emetteur.startSharing();
  };

  const smsPreview = useMemo(() => {
    const nick = emetteur.vesselNickname || 'KOOLAPIK';
    const msg = emetteur.isCustomMessageEnabled && emetteur.vesselSmsMessage ? emetteur.vesselSmsMessage : "Requiert assistance immédiate.";
    return `[${nick.toUpperCase()}] ${msg} [MAYDAY/PAN PAN] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [emetteur.vesselSmsMessage, emetteur.isCustomMessageEnabled, emetteur.vesselNickname]);

  if (loadError) return <div className="p-4 text-destructive">Erreur chargement Google Maps.</div>;
  if (!isLoaded || isProfileLoading) return <Skeleton className="h-96 w-full" />;

  const ackList = Object.entries(recepteur.acknowledgedAlerts);

  return (
    <div className="w-full space-y-4 pb-32 px-1 relative">
      {recepteur.isAlarmActive && (
        <Button 
            className="fixed top-2 left-1/2 -translate-x-1/2 z-[10008] h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase shadow-2xl animate-bounce gap-3 px-8 rounded-full border-4 border-white transition-all active:scale-95"
            onClick={recepteur.stopAllAlarms}
        >
            <Volume2 className="size-6 animate-pulse" /> ARRÊTER LE SON
        </Button>
      )}

      {ackList.length > 0 && !recepteur.isAlarmActive && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[10008] w-max px-4 py-2 bg-slate-900/90 text-white rounded-full border border-white/20 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <ShieldAlert className="size-3 text-orange-500" />
            <span className="text-[9px] font-black uppercase tracking-widest">⚠️ ALERTE ACQUITTEE - Surveillance active</span>
        </div>
      )}

      {simulator.isActive && (
        <div className="fixed top-12 left-0 right-0 h-6 bg-red-600/90 text-white flex items-center justify-center text-[9px] font-black z-[10008] animate-pulse uppercase tracking-widest border-b border-white/20">
            ⚠️ MODE SIMULATION ACTIF ⚠️
        </div>
      )}

      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <Button variant={appMode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setMode('sender'); recepteur.initAudio(); }}>Émetteur (A)</Button>
          <Button variant={appMode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setMode('receiver'); recepteur.initAudio(); }}>Récepteur (B)</Button>
          <Button variant={appMode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setMode('fleet'); recepteur.initAudio(); }}>Flotte (C)</Button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[10006] flex flex-col items-center gap-2">
            <div className="flex bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-2xl">
                <Button
                    variant="ghost" size="sm"
                    className={cn("h-9 px-5 text-[10px] font-black uppercase rounded-lg transition-all", mapCore.viewMode === 'alpha' ? "bg-primary text-white shadow-lg" : "text-white/60")}
                    onClick={() => mapCore.setViewMode('alpha')}
                >MAPS</Button>
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost" size="sm"
                            className={cn("h-9 px-5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2", mapCore.viewMode === 'beta' ? "bg-primary text-white shadow-lg" : "text-white/60")}
                            onClick={() => mapCore.setViewMode('beta')}
                        >
                            MÉTÉO <ChevronDown className="size-3" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 bg-slate-900/95 border-white/20 backdrop-blur-xl rounded-2xl shadow-2xl z-[10007]">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black uppercase text-primary mb-2 px-2 tracking-widest">Calques Actifs</p>
                            {[
                                { id: 'wind', label: 'Vent', icon: Wind, free: true },
                                { id: 'temp', label: 'Température', icon: Thermometer, free: true },
                                { id: 'waves', label: 'Houle', icon: Waves, free: false },
                                { id: 'gust', label: 'Rafales', icon: Zap, free: false },
                                { id: 'rain', label: 'Pluie', icon: CloudRain, free: false },
                                { id: 'thunder', label: 'Orages', icon: CloudLightning, free: false },
                                { id: 'uv', label: 'Index UV', icon: Sun, free: false }
                            ].map(l => (
                                <button
                                    key={l.id}
                                    disabled={!l.free}
                                    onClick={() => mapCore.setWindyLayer(l.id as any)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-2.5 rounded-xl transition-all",
                                        mapCore.windyLayer === l.id ? "bg-primary text-white" : "text-white/60 hover:bg-white/5",
                                        !l.free && "opacity-40 grayscale cursor-not-allowed"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <l.icon className="size-3.5" />
                                        <span className="text-[10px] font-black uppercase">{l.label}</span>
                                    </div>
                                    {!l.free && <Badge className="bg-slate-700 text-[7px] font-black h-4 px-1">PRO 🔒</Badge>}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Button
                    variant="ghost" size="sm"
                    className={cn("h-9 px-5 text-[10px] font-black uppercase rounded-lg transition-all", mapCore.viewMode === 'gamma' ? "bg-primary text-white shadow-lg" : "text-white/60")}
                    onClick={() => mapCore.setViewMode('gamma')}
                >WINDY</Button>

                <div className="w-px h-4 bg-white/10 mx-1 self-center" />
                
                <Button 
                    variant="ghost" size="sm" 
                    className="h-9 px-3 text-[9px] font-black uppercase text-white/60 hover:text-white hover:bg-white/10 flex items-center gap-1.5"
                    onClick={() => {
                        emetteur.clearLogs();
                        toast({ title: "TRACES EFFACÉES", description: "Historique visuel purgé." });
                    }}
                >
                    <Trash2 className="size-3" /> EFFACER
                </Button>
            </div>
        </div>

        {mapCore.isGoogleLoaded ? (
            <div className="relative w-full h-full">
                {mapCore.viewMode === 'beta' && (
                    <div className="absolute inset-0 z-[5] pointer-events-none opacity-50 mix-blend-multiply">
                        <iframe src={windyUrl} className="w-full h-full border-none" />
                    </div>
                )}

                {mapCore.viewMode === 'gamma' && (
                    <div className="absolute inset-0 z-[140] bg-background animate-in fade-in duration-500">
                        <iframe src={windyUrl} className="w-full h-full border-none" />
                    </div>
                )}

                <GoogleMap
                    mapContainerClassName={cn("w-full h-full", mapCore.viewMode === 'gamma' && "opacity-0 pointer-events-none")}
                    defaultCenter={INITIAL_CENTER}
                    defaultZoom={12}
                    onLoad={mapCore.setGoogleMap}
                    onDragStart={() => mapCore.setIsFollowMode(false)}
                    options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
                >
                    {activeAnchorVessel && activeAnchorVessel.anchorLocation && (
                        <React.Fragment key={`mooring-singleton-${activeAnchorVessel.id}`}>
                            <OverlayView 
                                position={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} 
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg z-[800]">
                                    <Anchor className="size-3.5 text-white" />
                                </div>
                            </OverlayView>
                            
                            <Circle 
                                center={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }}
                                radius={activeAnchorVessel.mooringRadius || 100}
                                options={{
                                    strokeColor: activeAnchorVessel.status === 'drifting' ? (mapCore.isFlashOn ? '#ef4444' : '#3b82f6') : '#3b82f6',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 3,
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.15,
                                    clickable: false,
                                    zIndex: 1
                                }}
                            />

                            {activeAnchorVessel.location && (activeAnchorVessel.status === 'stationary' || activeAnchorVessel.status === 'drifting' || activeAnchorVessel.status === 'emergency') && (
                                <Polyline
                                    path={[
                                        { lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude },
                                        { lat: activeAnchorVessel.location.latitude, lng: activeAnchorVessel.location.longitude }
                                    ]}
                                    options={{
                                        strokeColor: activeAnchorVessel.status === 'drifting' ? (mapCore.isFlashOn ? '#ef4444' : '#3b82f6') : '#ef4444',
                                        strokeOpacity: 1.0,
                                        strokeWeight: 3,
                                        zIndex: 2
                                    }}
                                />
                            )}
                        </React.Fragment>
                    )}

                    {followedVessels?.filter(v => v.isSharing).map(vessel => (
                        <OverlayView key={vessel.id} position={{ lat: vessel.location?.latitude || 0, lng: vessel.location?.longitude || 0 }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <VesselMarker vessel={vessel} />
                        </OverlayView>
                    ))}

                    {mapCore.breadcrumbs.length > 1 && (
                        <Polyline 
                            path={mapCore.breadcrumbs} 
                            options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} 
                        />
                    )}

                    {!mapCore.isTacticalHidden && mapCore.tacticalMarkers.map(marker => {
                        const Icon = TACTICAL_ICONS[marker.type] || Fish;
                        return (
                            <OverlayView key={marker.id} position={marker.pos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center group cursor-pointer z-[500]" onClick={() => mapCore.handleRecenter(marker.pos)}>
                                    <div className="px-2 py-1 bg-white/90 backdrop-blur-md rounded border shadow-lg text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                                        {marker.type} - {marker.vesselName} • {format(marker.time, 'HH:mm')}
                                    </div>
                                    <div className="p-1.5 bg-accent rounded-full border-2 border-white shadow-xl">
                                        <Icon className="size-3.5 text-white" />
                                    </div>
                                </div>
                            </OverlayView>
                        );
                    })}
                </GoogleMap>
            </div>
        ) : <Skeleton className="h-full w-full" />}
        
        <div className="absolute top-4 left-4 z-[9999] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>
                {mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button className={cn("size-10 rounded-xl border-2 shadow-xl font-black text-[10px] transition-all", simulator.isActive ? "bg-red-600 text-white border-red-400" : "bg-white/90 text-slate-600 border-slate-200")}>
                        {simulator.isActive ? <RefreshCw className="size-4 animate-spin" /> : "[SIM]"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 rounded-2xl border-none shadow-2xl overflow-hidden z-[10007]" side="right" sideOffset={10}>
                    <div className="bg-slate-900 text-white p-4 border-b">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><TestTube2 className="size-3" /> Console Simulateur</p>
                    </div>
                    <div className="p-4 space-y-4 bg-white">
                        <div className="space-y-3">
                            <Label className="text-[9px] font-black uppercase opacity-40">Position & Vitesse</Label>
                            <Button variant="outline" className="w-full h-10 text-[9px] font-black uppercase border-2 gap-2" onClick={() => {
                                const center = mapCore.googleMap?.getCenter();
                                if (center) {
                                    simulator.teleport({ lat: center.lat(), lng: center.lng() });
                                    mapCore.setIsCirclesHidden(false); 
                                }
                            }}>
                                <MapPin className="size-3" /> Téléporter sur centre carte
                            </Button>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[9px] font-black uppercase"><span>Vitesse</span><span>{simulator.simSpeed} ND</span></div>
                                <Slider value={[simulator.simSpeed]} max={30} onValueChange={v => simulator.setSimSpeed(v[0])} />
                            </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-dashed">
                            <Label className="text-[9px] font-black uppercase text-orange-600">Stress Test Mouillage</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-10 text-[8px] font-black uppercase border-2" onClick={() => {
                                    simulator.nudge(emetteur.anchorPos, emetteur.mooringRadius);
                                    mapCore.setIsCirclesHidden(false);
                                }}>Nudge (90% Rayon)</Button>
                                <Button variant="destructive" className="h-10 text-[8px] font-black uppercase" onClick={() => {
                                    simulator.forceDrift(emetteur.anchorPos, emetteur.mooringRadius);
                                    mapCore.setIsCirclesHidden(false);
                                }}>Forcer Dérive</Button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-dashed">
                            <Label className="text-[9px] font-black uppercase text-red-600">Simulation Pannes</Label>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border-2">
                                    <span className="text-[9px] font-black uppercase">Coupure GPS</span>
                                    <Switch checked={simulator.isGpsCut} onCheckedChange={v => { simulator.setIsGpsCut(v); if(v) simulator.setSimAccuracy(999); }} className="scale-75" />
                                </div>
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border-2">
                                    <span className="text-[9px] font-black uppercase">Coupure Com</span>
                                    <Switch checked={simulator.isComCut} onCheckedChange={simulator.setIsComCut} className="scale-75" />
                                </div>
                            </div>
                        </div>

                        <Button 
                            className="w-full h-12 font-black uppercase text-[10px] bg-red-600 hover:bg-red-700" 
                            onClick={() => {
                                simulator.stopSim();
                                recepteur.stopAllAlarms();
                                emetteur.clearLogs();
                            }}
                        >
                            Désactiver Simulation
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>

        <div className="absolute top-4 right-4 z-[9999] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl transition-all", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}>
                {mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            <Button onClick={handleRecenter} className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white flex items-center justify-center">
                <LocateFixed className="size-5"/>
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
          {appMode === 'sender' && (
              <div className="space-y-4">
                  {emetteur.isSharing ? (
                      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                          <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-primary/20">
                              <CardHeader className="bg-primary/5 p-4 border-b flex flex-row justify-between items-center">
                                  <div className="flex items-center gap-3">
                                      <div className="p-2 bg-primary text-white rounded-lg shadow-sm">
                                          <Navigation className={cn("size-5", emetteur.vesselStatus === 'moving' && "animate-pulse")} />
                                      </div>
                                      <div>
                                          <CardTitle className="text-sm font-black uppercase text-primary leading-none">{emetteur.sharingId}</CardTitle>
                                          <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Capitaine : {emetteur.vesselNickname}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <BatteryIconComp level={emetteur.battery.level * 100} charging={emetteur.battery.charging} className="size-5" />
                                      <div className={cn("size-3 rounded-full bg-green-500 shadow-sm transition-all", isLedActive ? "scale-125 glow" : "opacity-30")} />
                                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 font-black text-[8px] uppercase h-5">LIVE</Badge>
                                  </div>
                              </CardHeader>
                              <CardContent className="p-4 space-y-4">
                                  <div className="grid grid-cols-2 gap-2">
                                      <Button 
                                          variant="outline" 
                                          className={cn("h-14 font-black uppercase text-[10px] border-2 gap-2", 
                                              emetteur.vesselStatus === 'returning' ? "bg-indigo-600 text-white border-indigo-700 shadow-inner" : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                                          )}
                                          onClick={() => emetteur.changeManualStatus('returning', 'RETOUR MAISON')}
                                      >
                                          <Navigation className="size-4" /> Retour Maison
                                      </Button>
                                      <Button 
                                          variant="outline" 
                                          className={cn("h-14 font-black uppercase text-[10px] border-2 gap-2", 
                                              emetteur.vesselStatus === 'landed' ? "bg-green-600 text-white border-green-700 shadow-inner" : "bg-green-50 border-green-100 text-green-700 hover:bg-indigo-100"
                                          )}
                                          onClick={() => emetteur.changeManualStatus('landed', 'HOME À TERRE')}
                                      >
                                          <Home className="size-4" /> Home à Terre
                                      </Button>
                                  </div>

                                  <div className="p-4 bg-orange-50/30 border-2 border-orange-100 rounded-2xl space-y-4">
                                      <div className="flex items-center justify-between">
                                          <Button 
                                              className={cn("h-12 px-6 font-black uppercase text-[10px] gap-2 shadow-lg transition-all active:scale-95", 
                                                  emetteur.vesselStatus === 'stationary' || emetteur.vesselStatus === 'drifting' ? "bg-orange-600 hover:bg-orange-700" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                              )}
                                              onClick={() => {
                                                  if (emetteur.anchorPos) {
                                                      emetteur.changeManualStatus('moving', 'REPRISE NAVIGATION');
                                                  } else {
                                                      emetteur.changeManualStatus('stationary', 'MOUILLAGE ACTIF');
                                                      mapCore.setIsCirclesHidden(false); 
                                                  }
                                              }}
                                          >
                                              <Anchor className="size-4" /> 
                                              {emetteur.anchorPos ? "MOUILLAGE ACTIF" : "ACTIVER MOUILLAGE"}
                                          </Button>
                                          <div className="text-right">
                                              <p className="text-[10px] font-black uppercase text-orange-800">Rayon Dérive</p>
                                              <p className="text-lg font-black text-orange-950 leading-none">{emetteur.mooringRadius}m</p>
                                          </div>
                                      </div>
                                      <div className="px-1">
                                          <Slider 
                                              value={[emetteur.mooringRadius]} 
                                              min={10} 
                                              max={200} 
                                              step={10} 
                                              onValueChange={(v) => emetteur.setMooringRadius(v[0])} 
                                          />
                                          <div className="flex justify-between text-[8px] font-black uppercase opacity-40 mt-1">
                                              <span>10m</span>
                                              <span>200m</span>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 border-t pt-4 border-dashed border-primary/10">
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-blue-50 rounded-lg"><Move className="size-4 text-blue-600" /></div>
                                          <div>
                                              <p className="text-[8px] font-black uppercase text-muted-foreground">Vitesse</p>
                                              <p className="text-sm font-black text-slate-800">{emetteur.currentSpeed} nds</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-slate-50 rounded-lg"><LocateFixed className="size-4 text-slate-600" /></div>
                                          <div>
                                              <p className="text-[8px] font-black uppercase text-muted-foreground">Précision</p>
                                              <p className={cn("text-sm font-black", emetteur.accuracy > 25 ? "text-orange-600" : "text-green-600")}>+/- {emetteur.accuracy}m</p>
                                          </div>
                                      </div>
                                  </div>

                                  <Button 
                                      variant="destructive" 
                                      className="w-full h-16 font-black uppercase text-xs tracking-widest shadow-xl rounded-2xl gap-3 border-4 border-white/20 transition-all active:scale-95" 
                                      onClick={() => {
                                          emetteur.stopSharing();
                                          recepteur.stopAllAlarms();
                                      }}
                                  >
                                      <X className="size-6 bg-white text-red-600 rounded-full p-1" /> ARRÊTER LE PARTAGE
                                  </Button>
                              </CardContent>
                          </Card>
                      </div>
                  ) : (
                      <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-primary/20">
                          <CardHeader className="bg-primary/5 p-5 border-b flex flex-row justify-between items-center">
                              <div>
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                                    <Navigation className="size-4 text-primary" /> Identité &amp; IDs
                                </CardTitle>
                                <CardDescription className="text-[9px] font-bold uppercase mt-0.5">Partage vers Récepteur et Flotte</CardDescription>
                              </div>
                          </CardHeader>
                          <CardContent className="p-5 space-y-5">
                              <div className="space-y-5">
                                  <div className="space-y-1.5">
                                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Mon Surnom</Label>
                                      <Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-12 border-2 font-black text-lg shadow-inner" />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Navire</Label>
                                        <Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ABC-123" className="h-12 border-2 font-black text-center uppercase tracking-widest bg-slate-50" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1 text-indigo-600">ID Flotte C</Label>
                                        <Input value={emetteur.customFleetId} onChange={e => emetteur.setCustomFleetId(e.target.value)} placeholder="GROUPE" className="h-12 border-2 border-indigo-100 font-black text-center uppercase tracking-widest bg-indigo-50/30" />
                                    </div>
                                  </div>

                                  {emetteur.idsHistory.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1">
                                            <HistoryIcon className="size-3" /> Historique des IDs
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {emetteur.idsHistory.map((h, i) => (
                                                <div key={i} className="flex items-center bg-white border-2 rounded-xl overflow-hidden shadow-sm">
                                                    <button 
                                                        onClick={() => emetteur.loadFromHistory(h.vId, h.fId)}
                                                        className="px-3 py-2 text-[9px] font-black uppercase hover:bg-primary/5 transition-colors border-r"
                                                    >
                                                        {h.vId} {h.fId && <span className="text-indigo-600">| {h.fId}</span>}
                                                    </button>
                                                    <button 
                                                        onClick={() => emetteur.removeFromHistory(h.vId)}
                                                        className="px-2 py-2 text-destructive/40 hover:text-destructive hover:bg-red-50 transition-colors"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                  )}

                                  <Button className="w-full h-16 font-black uppercase text-base bg-primary rounded-2xl shadow-xl gap-3 group transition-all active:scale-95" onClick={handleStartSharingEnhanced}>
                                      <Zap className="size-5 fill-white group-hover:animate-pulse" /> Lancer le Partage GPS
                                  </Button>
                              </div>
                          </CardContent>
                      </Card>
                  )}

                  <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="sms-emergency" className="border-none">
                          <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-4 px-5 bg-orange-50 border-2 border-orange-100 rounded-3xl shadow-sm">
                              <div className="flex items-center gap-3">
                                  <div className="p-2 bg-orange-100 rounded-xl">
                                      <Smartphone className="size-5 text-orange-600" />
                                  </div>
                                  <span className="text-[11px] font-black uppercase text-orange-900 tracking-tight">RÉGLAGES D'URGENCE (SMS)</span>
                              </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-6">
                              <div className="p-5 bg-white border-2 rounded-3xl space-y-5 shadow-inner">
                                  <div className="flex items-center justify-between border-b border-dashed pb-4">
                                      <div className="space-y-0.5">
                                          <Label className="text-xs font-black uppercase text-orange-800">Activer le contact SMS</Label>
                                          <p className="text-[9px] font-bold text-orange-600/60 uppercase">Envoi auto lors d'un Mayday/Pan Pan</p>
                                      </div>
                                      <Switch 
                                          checked={emetteur.isEmergencyEnabled} 
                                          onCheckedChange={emetteur.setIsEmergencyEnabled} 
                                          className="data-[state=checked]:bg-blue-600"
                                      />
                                  </div>

                                  <div className={cn("space-y-5 transition-opacity", !emetteur.isEmergencyEnabled && "opacity-40 pointer-events-none")}>
                                      <div className="space-y-1.5">
                                          <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Numéro du contact à terre</Label>
                                          <div className="relative">
                                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                              <Input 
                                                  placeholder="Ex: 742929" 
                                                  value={emetteur.emergencyContact} 
                                                  onChange={e => emetteur.setEmergencyContact(e.target.value)} 
                                                  className="h-12 pl-10 border-2 font-black text-lg"
                                              />
                                          </div>
                                      </div>

                                      <div className="space-y-1.5">
                                          <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Message Personnalisé</Label>
                                          <Textarea 
                                              placeholder="Ex: Problème moteur, besoin aide immédiate." 
                                              value={emetteur.vesselSmsMessage} 
                                              onChange={e => emetteur.setVesselSmsMessage(e.target.value)}
                                              className="border-2 font-medium min-h-[100px] resize-none"
                                          />
                                      </div>

                                      <div className="space-y-2">
                                          <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1">
                                              <Eye className="size-3" /> Aperçu du message :
                                          </p>
                                          <div className="p-4 bg-slate-100 rounded-2xl border-2 border-slate-200 italic text-[10px] font-medium leading-relaxed text-slate-600 shadow-inner">
                                              "{smsPreview}"
                                          </div>
                                      </div>
                                  </div>

                                  <Button 
                                      className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3"
                                      onClick={emetteur.saveSmsSettings}
                                  >
                                      <Save className="size-5" /> SAUVEGARDER RÉGLAGES SMS
                                  </Button>
                              </div>
                          </AccordionContent>
                      </AccordionItem>
                  </Accordion>
              </div>
          )}

          {appMode === 'receiver' && (
              <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-blue-200">
                  <CardHeader className="bg-blue-50 p-5 border-b flex flex-row justify-between items-center">
                      <div>
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-blue-800">
                            <Smartphone className="size-4" /> Suivi Récepteur
                        </CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase mt-0.5">Surveillance à terre</CardDescription>
                      </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID du Navire à suivre</Label>
                          <div className="flex gap-2">
                              <Input 
                                placeholder="ENTREZ L'ID..." 
                                value={vesselIdToFollow} 
                                onChange={e => setVesselIdToFollow(e.target.value)} 
                                className="font-black text-center h-12 border-2 uppercase tracking-widest bg-white flex-grow" 
                              />
                              <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={() => { recepteur.initAudio(); recepteur.savePrefs({ lastFollowedId: vesselIdToFollow.toUpperCase() }); toast({ title: "Suivi activé" }); }}>
                                  <CheckCircle2 className="size-4" />
                              </Button>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          )}
      </div>

      <div id="cockpit-logs" className="fixed bottom-16 left-0 right-0 z-[10001] px-1 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
              {emetteur.isSharing && (
                  <div className="flex gap-2 mb-2 p-2 bg-slate-900/10 backdrop-blur-md rounded-2xl border-2 border-white/20 z-[10002] relative">
                      <Button 
                        variant={emetteur.vesselStatus === 'emergency' ? 'default' : 'destructive'} 
                        className={cn("flex-1 h-16 font-black uppercase text-xs shadow-2xl border-2 transition-all active:scale-95", 
                            emetteur.vesselStatus === 'emergency' ? "bg-red-600 animate-pulse border-white" : "bg-red-700 border-red-400")}
                        onClick={() => emetteur.triggerEmergency('MAYDAY')}
                      >
                          <ShieldAlert className="size-6 mr-2" /> MAYDAY
                      </Button>
                      <Button 
                        variant="secondary" 
                        className={cn("flex-1 h-16 font-black uppercase text-xs shadow-xl border-2 transition-all active:scale-95", 
                            emetteur.vesselStatus === 'emergency' ? "bg-orange-500 text-white" : "bg-slate-700 text-white border-slate-500")}
                        onClick={() => emetteur.triggerEmergency('PAN PAN')}
                      >
                          <AlertTriangle className="size-5 mr-2" /> PAN PAN
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 h-16 font-black uppercase text-[10px] shadow-xl border-2 bg-white text-red-600 border-red-600 transition-all active:scale-95 leading-tight"
                        onClick={() => emetteur.triggerEmergency('ASSISTANCE')}
                      >
                          DEMANDE<br/>ASSISTANCE
                      </Button>
                  </div>
              )}

              <Accordion type="single" collapsible className="bg-white/95 backdrop-blur-md rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.2)] border-x-2 border-t-2 overflow-hidden">
                  <AccordionItem value="logs" className="border-none">
                      <AccordionTrigger className="h-12 px-6 hover:no-underline">
                          <div className="flex items-center gap-3">
                              <ClipboardList className="size-5 text-primary" />
                              <span className="text-sm font-black uppercase tracking-tighter text-slate-800">Cockpit : Journal &amp; Réglages</span>
                              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-[8px] font-black animate-pulse">LIVE</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                          <Tabs defaultValue="tactical" className="w-full">
                              <TabsList className="grid grid-cols-3 h-12 rounded-none bg-muted/20 border-y">
                                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase gap-2"><Fish className="size-3" /> Tactique</TabsTrigger>
                                  <TabsTrigger value="technical" className="text-[10px] font-black uppercase gap-2"><HistoryIcon className="size-3" /> Technique</TabsTrigger>
                                  <TabsTrigger value="settings" className="text-[10px] font-black uppercase gap-2 text-primary"><Settings className="size-3" /> Réglages Sons</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="tactical" className="m-0 bg-white p-4 space-y-4">
                                  <div className="flex items-center justify-between bg-muted/10 p-2 rounded-xl border border-dashed">
                                      <p className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2 px-1">
                                          <Zap className="size-3" /> Grille Tactique
                                      </p>
                                      <Button variant="ghost" size="sm" className="h-7 text-destructive text-[8px] font-black uppercase border border-destructive/10" onClick={emetteur.clearLogs}>
                                          <Trash2 className="size-3 mr-1" /> Effacer
                                      </Button>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                      {TACTICAL_SPECIES.map(spec => (
                                          <Button key={spec.label} variant="outline" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 hover:bg-primary/5 active:scale-95 transition-all" onClick={() => emetteur.addTacticalLog(spec.label)}>
                                              <spec.icon className="size-5 text-primary" />
                                              <span className="text-[8px] font-black">{spec.label}</span>
                                          </Button>
                                      ))}
                                      <Button variant="secondary" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 border-primary/20 shadow-sm" onClick={() => photoInputRef.current?.click()}>
                                          <Camera className="size-5 text-primary" />
                                          <span className="text-[8px] font-black">PRISE</span>
                                      </Button>
                                  </div>
                                  <ScrollArea className="h-48 border-t pt-2 shadow-inner">
                                      <div className="space-y-1">
                                        {emetteur.tacticalLogs.map((log, i) => (
                                            <div key={i} className="p-3 border-b flex justify-between items-center text-[10px] cursor-pointer hover:bg-primary/5 active:bg-primary/10 transition-colors" onClick={() => handleCopyLogEntry(log)}>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-primary/10 rounded-lg"><Fish className="size-3 text-primary"/></div>
                                                    <span className="font-black uppercase text-primary">{log.type}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {log.wind && <span className="font-bold text-blue-600">{log.wind} ND</span>}
                                                    <span className="font-bold opacity-40">{format(log.time, 'HH:mm')}</span>
                                                    <Copy className="size-3 opacity-20" />
                                                </div>
                                            </div>
                                        ))}
                                      </div>
                                  </ScrollArea>
                              </TabsContent>

                              <TabsContent value="technical" className="m-0 bg-slate-50/50 p-4">
                                  <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border-2 shadow-sm">
                                      <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-1.5"><LocateFixed className="size-3 text-primary" /><span className="text-[10px] font-black uppercase text-primary">GPS FIX</span></div>
                                      </div>
                                      <Button variant="ghost" size="sm" className="h-7 text-destructive text-[8px] font-black uppercase border border-destructive/10" onClick={emetteur.clearLogs}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                                  </div>
                                  <ScrollArea className="h-48 shadow-inner">
                                      <div className="space-y-2">
                                          <div className="p-2 border rounded-lg bg-green-50 text-[10px] font-black uppercase text-green-700">Système v71.0 prêt - Purge Auto Active</div>
                                          {emetteur.techLogs.map((log, i) => (
                                              <div key={i} className="p-2 border rounded-lg bg-white flex justify-between items-center text-[9px] shadow-sm cursor-pointer hover:bg-slate-100" onClick={() => handleCopyLogEntry(log)}>
                                                  <div className="flex flex-col gap-0.5">
                                                      <span className={cn("font-black uppercase", log.label.includes('ÉNERGIE') ? 'text-red-600' : 'text-slate-800')}>{log.label}</span>
                                                      <span className="text-[7px] opacity-40 font-bold">{log.details}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-bold opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                                                      <Copy className="size-3 opacity-20" />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </ScrollArea>
                              </TabsContent>

                              <TabsContent value="settings" className="m-0 bg-white p-4 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-hide relative">
                                  <div className="sticky top-0 z-20 bg-white pb-4 border-b mb-2">
                                      <Button 
                                          className="w-full h-14 font-black uppercase tracking-widest shadow-xl gap-3 rounded-2xl bg-primary hover:bg-primary/90 text-white"
                                          onClick={async () => {
                                              const ok = await recepteur.savePrefsToFirestore();
                                              if (ok) {
                                                  toast({ 
                                                      title: "RÉGLAGES VALIDÉS", 
                                                      description: "Vos préférences sonores ont été enregistrées.",
                                                      variant: "default"
                                                  });
                                              } else {
                                                  toast({ 
                                                      variant: "destructive",
                                                      title: "Erreur",
                                                      description: "La sauvegarde a échoué."
                                                  });
                                              }
                                          }}
                                          disabled={recepteur.isSaving}
                                      >
                                          {recepteur.isSaving ? <RefreshCw className="size-5 animate-spin" /> : <CheckCircle2 className="size-6" />}
                                          ENREGISTRER ET VALIDER
                                      </Button>
                                  </div>

                                  <div className="flex items-center justify-between bg-primary/5 p-4 rounded-2xl border-2 border-primary/10">
                                      <div className="space-y-0.5">
                                          <Label className="text-xs font-black uppercase">Activer les signaux sonores globaux</Label>
                                          <p className="text-[8px] font-bold text-muted-foreground uppercase">Pilotage général du thread audio</p>
                                      </div>
                                      <Switch checked={recepteur.vesselPrefs.isNotifyEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isNotifyEnabled: v })} />
                                  </div>

                                  <div className="space-y-3">
                                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                          <Volume2 className="size-3" /> Volume (Intensity {Math.round(recepteur.vesselPrefs.volume * 100)}%)
                                      </Label>
                                      <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} step={1} onValueChange={v => recepteur.updateLocalPrefs({ volume: v[0] / 100 })} />
                                  </div>

                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-slate-50">
                                      <div className="flex items-center justify-between">
                                          <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Timer className="size-3" /> Veille Stratégique</Label>
                                          <Switch checked={recepteur.vesselPrefs.isWatchEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isWatchEnabled: v })} />
                                      </div>
                                      <div className={cn("space-y-4", !recepteur.vesselPrefs.isWatchEnabled && "opacity-40 pointer-events-none")}>
                                          <div className="space-y-2">
                                              <div className="flex justify-between text-[9px] font-black uppercase"><span>Seuil d'immobilité</span><span>{recepteur.vesselPrefs.watchDuration >= 60 ? `${Math.floor(recepteur.vesselPrefs.watchDuration / 60)}h` : `${recepteur.vesselPrefs.watchDuration}m`}</span></div>
                                              <Slider value={[recepteur.vesselPrefs.watchDuration]} min={60} max={1440} step={60} onValueChange={v => recepteur.updateLocalPrefs({ watchDuration: v[0] })} />
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <Select value={recepteur.vesselPrefs.watchSound} onValueChange={v => recepteur.updateLocalPrefs({ watchSound: v })}>
                                                  <SelectTrigger className="h-9 text-[10px] font-black uppercase w-full bg-white border-2">
                                                      <SelectValue placeholder="Son de veille..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.label} className="text-[10px] uppercase font-black">{s.label}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                              
                                              <div className="flex items-center gap-1 bg-white border-2 rounded-lg px-2 h-9">
                                                  <span className="text-[8px] font-black uppercase text-slate-400">Loop</span>
                                                  <Switch checked={recepteur.vesselPrefs.watchLoop} onCheckedChange={v => recepteur.updateLocalPrefs({ watchLoop: v })} className="scale-50" />
                                              </div>
                                              
                                              <Button variant="ghost" size="icon" className="h-9 w-9 border-2" onClick={() => recepteur.playSound('watch')}><Play className="size-3" /></Button>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="space-y-2 p-4 border-2 rounded-2xl bg-red-50/20 border-red-100">
                                      <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2"><Battery className="size-3" /> Seuil Batterie Faible</Label>
                                      <div className="flex items-center gap-4">
                                          <Slider className="flex-1" value={[recepteur.vesselPrefs.batteryThreshold]} min={5} max={90} step={5} onValueChange={v => recepteur.updateLocalPrefs({ batteryThreshold: v[0] })} />
                                          <Badge variant="outline" className="font-black text-xs bg-white">{recepteur.vesselPrefs.batteryThreshold}%</Badge>
                                      </div>
                                  </div>

                                  <div className="space-y-3 pt-2 border-t border-dashed">
                                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                          <HistoryIcon className="size-3" /> Réglages Individuels (Trigger Logic)
                                      </p>
                                      <div className="grid gap-3">
                                          {Object.entries(recepteur.vesselPrefs.alerts || {}).map(([key, config]) => (
                                              <div key={key} className="p-3 border-2 rounded-xl space-y-3 bg-slate-50/50 shadow-sm">
                                                  <div className="flex items-center justify-between">
                                                      <Label className="text-[9px] font-black uppercase text-slate-700 flex items-center gap-2">
                                                          <Bell className="size-3" /> {key === 'moving' ? 'MOUVEMENT' : key === 'stationary' ? 'MOUILLAGE / DÉRIVE' : key === 'offline' ? 'SIGNAL PERDU' : key === 'assistance' ? 'ASSISTANCE' : key === 'tactical' ? 'SIGNAL TACTIQUE' : 'BATTERIE FAIBLE'}
                                                      </Label>
                                                      <Switch checked={config.enabled} onCheckedChange={v => recepteur.updateLocalPrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, enabled: v } } })} className="scale-75" />
                                                  </div>
                                                  <div className={cn("flex items-center gap-2", !config.enabled && "opacity-40")}>
                                                      <Select value={config.sound} onValueChange={v => recepteur.updateLocalPrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, sound: v } } })}>
                                                          <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-1 bg-white border-2">
                                                              <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                              {recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.label} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}
                                                          </SelectContent>
                                                      </Select>
                                                      <div className="flex items-center gap-1 bg-white border-2 rounded-lg px-2 h-8">
                                                          <span className="text-[8px] font-black uppercase text-slate-400">Loop</span>
                                                          <Switch checked={config.loop} onCheckedChange={v => recepteur.updateLocalPrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, loop: v } } })} className="scale-50" />
                                                      </div>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8 border-2" onClick={() => recepteur.playSound(key as any)}><Play className="size-3" /></Button>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </TabsContent>
                          </Tabs>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>
          </div>
      </div>
    </div>
  );
}
