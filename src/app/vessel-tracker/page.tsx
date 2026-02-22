"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useSimulator } from '@/logic/shared/useSimulator';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
import { useRadarIA } from '@/logic/shared/useRadarIA';
import { GoogleMap, OverlayView, Circle, Polyline } from '@react-google-maps/api';
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
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  serverTimestamp,
  Timestamp
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
  MapPin, 
  X, 
  Play, 
  RefreshCw, 
  Home, 
  Settings, 
  Smartphone, 
  Ghost, 
  Volume2,
  Bell,
  Lock,
  Unlock,
  BatteryLow,
  BatteryMedium,
  History,
  Move,
  Copy,
  ChevronDown,
  ClipboardList,
  Save,
  Target,
  Fish,
  Waves,
  Bird,
  Camera,
  CheckCircle2,
  Clock,
  Battery,
  Compass,
  ZapOff,
  EyeOff,
  Trash2,
  Phone,
  Eye,
  Check,
  Wind,
  Thermometer,
  CloudRain,
  Map as MapIcon
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn, getDistance } from '@/lib/utils';
import { format, subMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { UserAccount, VesselStatus, SoundLibraryEntry, TechLogEntry } from '@/lib/types';
import { useGoogleMaps } from '@/context/google-maps-context';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600 animate-pulse")} />;
  if (level <= 50) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const VesselMarker = ({ vessel, isRollingBack }: { vessel: VesselStatus, isRollingBack?: boolean }) => {
    const status = vessel.status || 'moving';
    let Icon = Navigation;
    let bgColor = 'bg-green-600'; 
    let animationClass = '';
    let statusLabel = 'EN ROUTE';

    if (isRollingBack) {
        bgColor = 'bg-slate-400';
        animationClass = 'animate-pulse';
        statusLabel = 'REVERSION...';
    } else {
        switch (status) {
            case 'stationary': Icon = Anchor; bgColor = 'bg-blue-600'; statusLabel = 'MOUILLAGE'; break;
            case 'drifting': Icon = AlertTriangle; bgColor = 'bg-red-600'; animationClass = 'animate-blink-red'; statusLabel = 'DÉRIVE'; break;
            case 'emergency': Icon = ShieldAlert; bgColor = 'bg-red-600'; animationClass = 'animate-pulse-red'; statusLabel = 'URGENCE'; break;
            case 'returning': Icon = Navigation; bgColor = 'bg-indigo-600'; statusLabel = 'RETOUR'; break;
            case 'landed': Icon = Home; bgColor = 'bg-green-600'; statusLabel = 'À TERRE'; break;
            case 'moving': default: Icon = Navigation; bgColor = 'bg-green-600'; statusLabel = 'MOUVEMENT'; break;
        }
    }

    return (
        <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 group cursor-pointer z-[1000]">
            <div className="flex flex-col items-center">
                <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex flex-col items-center gap-0.5 min-w-[80px]">
                    <div className="flex items-center gap-2 w-full justify-between">
                        <div className="flex items-center gap-1 truncate">
                            {vessel.isGhostMode && <Ghost className="size-2.5 text-primary animate-pulse" />}
                            <span className="truncate max-w-[60px]">{vessel.displayName || vessel.id}</span>
                        </div>
                        <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-3" />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 border-t border-white/10 pt-0.5 w-full justify-center">
                        <span className={cn("text-[7px] font-black uppercase tracking-tighter", 
                            isRollingBack ? "text-slate-300" :
                            statusLabel === 'MOUVEMENT' ? "text-green-400" : 
                            statusLabel === 'MOUILLAGE' ? "text-blue-400" : 
                            statusLabel === 'RETOUR' ? "text-indigo-400" : "text-red-400"
                        )}>
                            {statusLabel} | {vessel.speed !== undefined && `${vessel.speed.toFixed(1)}ND`}
                        </span>
                    </div>
                </div>
            </div>
            <div className={cn("p-2 rounded-full border-2 border-white shadow-xl transition-all", bgColor, animationClass)}>
                <Icon className="size-4 text-white" />
            </div>
        </div>
    );
};

export default function VesselTrackerPage() {
  const { isLoaded, loadError } = useGoogleMaps();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [appMode, setAppMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isAdjustingRadius, setIsAdjustingRadius] = useState(false);
  const [hudMode, setHudMode] = useState<'AUTO' | 'TACTICAL' | 'TECHNICAL'>('AUTO');
  
  // Radius States
  const [tempRadius, setTempRadius] = useState<number>(100);
  const [isConfirmingRadius, setIsConfirmingRadius] = useState(false);
  const radiusTimerRef = useRef<NodeJS.Timeout | null>(null);

  const mapCore = useMapCore();
  const simulator = useSimulator();

  useEffect(() => { setIsMounted(true); }, []);

  const handlePositionUpdate = useCallback((lat: number, lng: number, status: string) => {
    mapCore.updateBreadcrumbs(lat, lng, status);
    if (mapCore.isFollowMode && mapCore.googleMap) { mapCore.googleMap.panTo({ lat, lng }); }
  }, [mapCore]);

  const handleStopCleanup = useCallback(() => { mapCore.clearBreadcrumbs(); }, [mapCore]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  
  const emetteur = useEmetteur(handlePositionUpdate, handleStopCleanup, simulator, userProfile);
  const recepteur = useRecepteur(emetteur.sharingId);
  const flotte = useFlotte(emetteur.sharingId, emetteur.vesselNickname);
  
  const radar = useRadarIA(emetteur.currentPos, emetteur.currentSpeed, emetteur.vesselStatus, isAdjustingRadius);
  
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com', 'kledostyle@hotmail.com', 'kledostyle@outlook.com'];
    const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2', 'koKj5ObSGXYeO1PLKU5bgo8Yaky1'];
    return masterEmails.includes(user.email?.toLowerCase() || '') || masterUids.includes(user.uid) || userProfile?.role === 'admin';
  }, [user, userProfile]);

  const [isImpactProbable, setIsImpactProbable] = useState(false);

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const ids = [...savedVesselIds];
    if (emetteur.isSharing && !ids.includes(emetteur.sharingId)) ids.push(emetteur.sharingId);
    if (ids.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, user, savedVesselIds, emetteur.isSharing, emetteur.sharingId]);

  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  useEffect(() => { 
    if (followedVessels) recepteur.processVesselAlerts(followedVessels, isImpactProbable); 
  }, [followedVessels, recepteur, isImpactProbable]);

  useEffect(() => {
    if (firestore && (followedVessels || emetteur.isSharing)) {
        const ids = followedVessels?.map(v => v.id) || [];
        if (emetteur.sharingId) ids.push(emetteur.sharingId);
        const unsub = mapCore.syncTacticalMarkers(Array.from(new Set(ids)));
        return () => unsub();
    }
  }, [followedVessels, emetteur.isSharing, emetteur.sharingId, firestore, mapCore]);

  // Radius logic
  useEffect(() => {
    setTempRadius(emetteur.mooringRadius);
  }, [emetteur.mooringRadius]);

  const handleRadiusChange = (val: number) => {
    // v122 : On ne met à jour que l'UI locale pendant le glissement
    setTempRadius(val);
    setIsConfirmingRadius(true);
    
    if (radiusTimerRef.current) clearTimeout(radiusTimerRef.current);
    
    radiusTimerRef.current = setTimeout(() => {
        setTempRadius(emetteur.mooringRadius);
        setIsConfirmingRadius(false);
        emetteur.addTechLog('ERREUR', 'Changement de rayon annulé');
        toast({ variant: "destructive", title: "Annulé", description: "Temps de validation écoulé." });
    }, 5000);
  };

  const handleConfirmRadius = () => {
    if (radiusTimerRef.current) clearTimeout(radiusTimerRef.current);
    emetteur.saveMooringRadius(tempRadius);
    setIsConfirmingRadius(false);
  };

  const activeAnchorVessel = useMemo(() => {
    if (mapCore.isCirclesHidden) return null;
    const radiusToUse = isConfirmingRadius ? tempRadius : emetteur.mooringRadius;
    
    if (simulator.isActive && simulator.simPos) {
        const aPos = emetteur.anchorPos || simulator.simPos;
        return { 
            id: 'SANDBOX', status: emetteur.vesselStatus, anchorLocation: { latitude: aPos.lat, longitude: aPos.lng }, 
            location: { latitude: simulator.simPos.lat, longitude: simulator.simPos.lng }, mooringRadius: radiusToUse,
            accuracy: simulator.simAccuracy || 5, speed: simulator.simSpeed, heading: simulator.simBearing, isSim: true
        };
    }
    if (emetteur.isSharing && emetteur.currentPos) {
        const aPos = emetteur.anchorPos || emetteur.currentPos;
        return { 
            id: emetteur.sharingId, status: emetteur.vesselStatus, anchorLocation: { latitude: aPos.lat, longitude: aPos.lng }, 
            location: { latitude: emetteur.currentPos.lat, longitude: emetteur.currentPos.lng }, 
            mooringRadius: radiusToUse, accuracy: emetteur.accuracy, speed: emetteur.currentSpeed, heading: emetteur.currentHeading, isSim: false
        };
    }
    return null;
  }, [simulator, emetteur, mapCore.isCirclesHidden, isConfirmingRadius, tempRadius]);

  const mooringCircleOptions = useMemo(() => {
    if (!activeAnchorVessel) return null;
    const isDrifting = activeAnchorVessel.status === 'drifting';
    return { 
        strokeColor: isDrifting ? '#ef4444' : (activeAnchorVessel.isSim ? '#f97316' : '#3b82f6'), 
        strokeOpacity: (isDrifting && mapCore.isFlashOn) ? 1.0 : (activeAnchorVessel.isSim ? 0.4 : 0.8), 
        strokeWeight: activeAnchorVessel.isSim ? 2 : 3, 
        fillColor: isDrifting ? '#ef4444' : (activeAnchorVessel.isSim ? '#f97316' : '#3b82f6'), 
        fillOpacity: 0.15, clickable: false, zIndex: 1 
    };
  }, [activeAnchorVessel, mapCore.isFlashOn]);

  useEffect(() => {
    if ((emetteur.currentPos || simulator.simPos) && !hasCenteredInitially.current && mapCore.googleMap) {
        const pos = emetteur.currentPos || simulator.simPos;
        if (pos) {
            mapCore.handleRecenter(pos);
            hasCenteredInitially.current = true;
        }
    }
  }, [emetteur.currentPos, simulator.simPos, mapCore]);

  const handleRecenter = () => {
    recepteur.initAudio(); 
    const pos = emetteur.currentPos || simulator.simPos;
    if (pos) mapCore.handleRecenter(pos);
  };

  const handleTactical = useCallback((type: string) => {
    const pos = emetteur.currentPos || simulator.simPos;
    if (pos) {
        flotte.addTacticalLog(type, pos.lat, pos.lng);
    } else {
        toast({ variant: "destructive", title: "GPS Inactif", description: "Position requise pour signaler." });
    }
  }, [emetteur.currentPos, simulator.simPos, flotte, toast]);

  const hudLogs = useMemo(() => {
    const logs = [...emetteur.techLogs];
    const tacticalLabels = ['CHGT STATUT', 'DÉRIVE', 'URGENCE', 'CHGT MANUEL', 'MOUILLAGE', 'POSITION', 'ANNULATION'];
    
    return logs.filter(log => {
        if (hudMode === 'TACTICAL') return tacticalLabels.includes(log.label);
        if (hudMode === 'TECHNICAL') return !tacticalLabels.includes(log.label);
        return true;
    }).slice(0, 8);
  }, [emetteur.techLogs, hudMode]);

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE') => {
    if (!emetteur.isEmergencyEnabled) {
        toast({ variant: "destructive", title: "Service désactivé", description: "Veuillez activer les réglages d'urgence dans vos paramètres." });
        return;
    }
    
    const contact = type === 'ASSISTANCE' ? emetteur.assistanceContact : emetteur.emergencyContact;
    if (!contact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    
    const pos = emetteur.currentPos;
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    
    const nicknamePrefix = emetteur.vesselNickname ? `[${emetteur.vesselNickname.toUpperCase()}] ` : "";
    const customText = (emetteur.isCustomMessageEnabled && emetteur.vesselSmsMessage) ? emetteur.vesselSmsMessage : "Requiert assistance immédiate.";
    const body = `${nicknamePrefix}${customText} [${type}] Position : ${posUrl}`;
    
    window.location.href = `sms:${contact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const hasCenteredInitially = useRef(false);

  return (
    <div className="w-full space-y-4 pb-32 px-1 relative">
      {recepteur.isAlarmActive && (
        <Button className="fixed top-2 left-1/2 -translate-x-1/2 z-[10008] h-14 bg-red-600 text-white font-black uppercase shadow-2xl animate-bounce gap-3 px-8 rounded-full border-4 border-white" onClick={recepteur.stopAllAlarms}>
            <Volume2 className="size-6 animate-pulse" /> ARRÊTER LE SON
        </Button>
      )}

      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <button className={cn("flex-1 font-black uppercase text-[10px] h-12 rounded-lg transition-all", appMode === 'sender' ? "bg-primary text-white" : "hover:bg-white/10")} onClick={() => { setAppMode('sender'); recepteur.initAudio(); }}>Émetteur (A)</button>
          <button className={cn("flex-1 font-black uppercase text-[10px] h-12 rounded-lg transition-all", appMode === 'receiver' ? "bg-primary text-white" : "hover:bg-white/10")} onClick={() => { setAppMode('receiver'); recepteur.initAudio(); }}>Récepteur (B)</button>
          <button className={cn("flex-1 font-black uppercase text-[10px] h-12 rounded-lg transition-all", appMode === 'fleet' ? "bg-primary text-white" : "hover:bg-white/10")} onClick={() => { setAppMode('fleet'); recepteur.initAudio(); }}>Flotte (C)</button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        {/* GHOST HUD v122 - OPTIMISÉ GPU */}
        <div 
            className="absolute top-[35%] right-[10px] z-[999] pointer-events-none flex flex-col items-end gap-2 max-w-[200px]"
            style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        >
            <div className="flex bg-black/40 backdrop-blur-md rounded-lg p-1 border border-white/10 pointer-events-auto shadow-xl group transition-opacity hover:opacity-100 opacity-40">
                {['AUTO', 'TACTICAL', 'TECHNICAL'].map(m => (
                    <button 
                        key={m} 
                        onClick={() => setHudMode(m as any)}
                        className={cn("px-2 py-1 text-[7px] font-black uppercase rounded transition-all", hudMode === m ? "bg-primary text-white" : "text-white/60 hover:bg-white/10")}
                    >
                        {m === 'TACTICAL' ? 'TACT' : m === 'TECHNICAL' ? 'TECH' : m}
                    </button>
                ))}
            </div>
            
            <div className="flex flex-col items-end gap-1 font-mono text-[9px] whitespace-pre transition-all">
                {hudLogs.map((log, i) => {
                    const isTactical = ['CHGT STATUT', 'DÉRIVE', 'URGENCE', 'CHGT MANUEL', 'MOUILLAGE', 'POSITION', 'ANNULATION'].includes(log.label);
                    const isDrift = log.label === 'DÉRIVE' || log.label === 'URGENCE';
                    const isAnnul = log.label === 'ANNULATION';
                    return (
                        <div 
                            key={i} 
                            style={{ textShadow: '1px 1px 2px #000' }}
                            className={cn(
                                "font-black uppercase tracking-tight text-right animate-in fade-in slide-in-from-top-1 duration-300",
                                isTactical ? "text-cyan-400" : "text-white/80",
                                isDrift && "text-red-500 animate-pulse",
                                isAnnul && "text-orange-400"
                            )}
                        >
                            [{format(log.time, 'HH:mm')}] {log.label}: {log.status}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* RADIUS CONTROLLER v122 - OPTIMISÉ FIREBASE */}
        <div className="absolute bottom-[80px] left-4 z-[1001] pointer-events-auto">
            <Card className="bg-black/40 backdrop-blur-md border-white/10 p-3 rounded-xl shadow-2xl flex flex-col items-center gap-3 w-40 animate-in fade-in slide-in-from-left-2">
                <div className="flex justify-between items-center w-full px-1">
                    <span className="text-[8px] font-black uppercase text-white/60 tracking-widest">Rayon</span>
                    <Badge variant="outline" className="bg-primary/20 text-white font-black text-[10px] h-5 border-primary/30">
                        {tempRadius}M
                    </Badge>
                </div>
                <Slider 
                    value={[tempRadius]} 
                    min={10} 
                    max={500} 
                    step={10} 
                    onValueChange={v => setTempRadius(v[0])} // v122 : Uniquement UI locale pendant le glissement
                    onValueCommit={v => handleRadiusChange(v[0])} // v122 : Déclenche la validation logicielle au relâchement
                    className="w-full"
                />
                {isConfirmingRadius && (
                    <Button 
                        onClick={handleConfirmRadius}
                        className="w-full h-8 bg-primary text-white font-black uppercase text-[9px] shadow-lg animate-in zoom-in-95 duration-200 gap-2 rounded-lg"
                    >
                        <Check className="size-3" /> VALIDER
                    </Button>
                )}
            </Card>
        </div>

        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>{mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            
            {/* WINDY SELECTOR v119 */}
            <div className="mt-4 flex flex-col gap-2">
                <Button 
                    size="icon" 
                    className={cn(
                        "h-10 w-10 border-2 shadow-xl rounded-xl transition-all",
                        mapCore.windyLayer === 'none' ? "bg-primary text-white border-primary scale-110" : "bg-white/90 backdrop-blur-md text-slate-600 hover:bg-white"
                    )}
                    onClick={() => {
                        mapCore.setWindyLayer('none');
                        toast({ title: `Vue Google Map Standard` });
                        emetteur.addTechLog('TECHNIQUE', `RETOUR VUE GOOGLE MAP`);
                    }}
                    title="Vue Standard"
                >
                    <MapIcon className="size-5" />
                </Button>

                {[
                    { id: 'wind', icon: Wind, title: 'Vent' },
                    { id: 'waves', icon: Waves, title: 'Mer' },
                    { id: 'temp', icon: Thermometer, title: 'Temp' },
                    { id: 'rain', icon: CloudRain, title: 'Pluie' }
                ].map(layer => (
                    <Button 
                        key={layer.id}
                        size="icon" 
                        className={cn(
                            "h-10 w-10 border-2 shadow-xl rounded-xl transition-all",
                            mapCore.windyLayer === layer.id ? "bg-primary text-white border-primary scale-110" : "bg-white/90 backdrop-blur-md text-slate-600 hover:bg-white"
                        )}
                        onClick={() => {
                            mapCore.setWindyLayer(layer.id as any);
                            toast({ title: `Calque ${layer.title} activé` });
                            emetteur.addTechLog('TECHNIQUE', `CALQUE ${layer.title.toUpperCase()} ACTIVÉ`);
                        }}
                        title={layer.title}
                    >
                        <layer.icon className="size-5" />
                    </Button>
                ))}
            </div>
        </div>

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl transition-all", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}>{mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}</Button>
            <Button onClick={handleRecenter} className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl flex items-center justify-center"><LocateFixed className="size-5"/></Button>
        </div>

        <GoogleMap 
            mapContainerClassName="w-full h-full" 
            defaultCenter={INITIAL_CENTER} 
            defaultZoom={12} 
            onLoad={mapCore.setGoogleMap} 
            onDragStart={() => mapCore.setIsFollowMode(false)} 
            options={{ disableDefaultUI: true, zoomControl: false, mapTypeControl: false, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
        >
            {!emetteur.isTrajectoryHidden && mapCore.breadcrumbs.length > 1 && <Polyline path={mapCore.breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: '#3b82f6', strokeOpacity: 0.6, strokeWeight: 2, zIndex: 1 }} />}
            
            {activeAnchorVessel && activeAnchorVessel.anchorLocation && (
                <Circle 
                    center={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} 
                    radius={activeAnchorVessel.mooringRadius} 
                    options={mooringCircleOptions || {}} 
                />
            )}
            
            {followedVessels?.filter(v => v.isSharing && v.location && v.id !== emetteur.sharingId).map(vessel => (
                <OverlayView key={vessel.id} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <VesselMarker vessel={vessel} />
                </OverlayView>
            ))}

            {(emetteur.isSharing || simulator.isActive) && (emetteur.currentPos || simulator.simPos) && (
                <OverlayView position={emetteur.currentPos || simulator.simPos!} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <VesselMarker isRollingBack={emetteur.isRollingBack} vessel={{ id: emetteur.sharingId, displayName: emetteur.vesselNickname || 'Moi', status: emetteur.vesselStatus, speed: emetteur.currentSpeed, batteryLevel: Math.round(emetteur.battery.level * 100), isCharging: emetteur.battery.charging, isSharing: true, isGhostMode: emetteur.isGhostMode, lastActive: new Date() } as any} />
                </OverlayView>
            )}

            {mapCore.tacticalMarkers.map(marker => (
                <OverlayView key={marker.id} position={marker.pos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center group cursor-pointer z-[100]">
                        <div className="p-1.5 rounded-full bg-white border-2 border-primary shadow-xl">
                            {marker.type === 'OISEAUX' ? <Bird className="size-3 text-primary" /> : 
                             marker.type === 'SARDINES' ? <Waves className="size-3 text-primary" /> :
                             marker.type === 'MARLIN' ? <Target className="size-3 text-primary" /> :
                             marker.type === 'PRISE' ? <Camera className="size-3 text-primary" /> :
                             <Fish className="size-3 text-primary" />}
                        </div>
                    </div>
                </OverlayView>
            ))}
        </GoogleMap>
      </div>

      {(emetteur.isSharing || simulator.isActive) && (
        <div className="grid grid-cols-1 gap-2 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-2 gap-2">
                <Button 
                    variant={emetteur.vesselStatus === 'returning' ? 'default' : 'outline'}
                    className={cn("h-14 font-black uppercase text-[10px] border-2 gap-2 shadow-sm transition-all", emetteur.vesselStatus === 'returning' ? "bg-indigo-600 text-white border-indigo-400" : "bg-white border-indigo-50 text-indigo-700 hover:bg-indigo-50/50")}
                    onClick={() => emetteur.changeManualStatus('returning')}
                >
                    <Navigation className="size-4 text-indigo-600 group-data-[state=active]:text-white" /> RETOUR MAISON
                </Button>
                <Button 
                    variant={emetteur.vesselStatus === 'landed' ? 'default' : 'outline'}
                    className={cn("h-14 font-black uppercase text-[10px] border-2 gap-2 shadow-sm transition-all", emetteur.vesselStatus === 'landed' ? "bg-green-600 text-white border-green-400" : "bg-white border-green-50 text-green-700 hover:bg-green-50/50")}
                    onClick={() => emetteur.changeManualStatus('landed')}
                >
                    <Home className="size-4 text-green-600 group-data-[state=active]:text-white" /> HOME (À TERRE)
                </Button>
            </div>
            <Button 
                variant={emetteur.vesselStatus === 'emergency' ? 'default' : 'outline'}
                className={cn("w-full h-14 font-black uppercase text-xs border-2 gap-3 shadow-sm transition-all", emetteur.vesselStatus === 'emergency' ? "bg-orange-600 text-white border-orange-400" : "bg-white border-orange-50 text-orange-700 hover:bg-orange-50/50")}
                onClick={() => { emetteur.triggerEmergency('ASSISTANCE'); if (emetteur.vesselStatus !== 'emergency') sendEmergencySms('ASSISTANCE'); }}
            >
                <Phone className="size-5 text-orange-600 group-data-[state=active]:text-white" /> BESOIN D'ASSISTANCE
            </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
          <Button 
            variant="destructive" 
            className={cn("h-14 font-black uppercase rounded-2xl shadow-xl gap-3 text-xs border-2 border-white/20 transition-all", emetteur.vesselStatus === 'emergency' ? "ring-4 ring-red-500 animate-pulse" : "")} 
            onClick={() => { emetteur.triggerEmergency('MAYDAY'); if (emetteur.vesselStatus !== 'emergency') sendEmergencySms('MAYDAY'); }}
          >
              <ShieldAlert className="size-5" /> MAYDAY (SOS)
          </Button>
          <Button 
            variant="secondary" 
            className={cn("h-14 font-black uppercase rounded-2xl shadow-lg gap-3 text-xs border-2 border-primary/20 transition-all", emetteur.vesselStatus === 'emergency' ? "opacity-50" : "")} 
            onClick={() => { emetteur.triggerEmergency('PAN PAN'); if (emetteur.vesselStatus !== 'emergency') sendEmergencySms('PAN PAN'); }}
          >
              <AlertTriangle className="size-5 text-primary" /> PAN PAN
          </Button>
      </div>

      <Tabs value={appMode} className="w-full">
        <TabsContent value="sender">
            {emetteur.isSharing ? (
                <div className="space-y-4">
                    <Card className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2", 
                        emetteur.vesselStatus === 'landed' ? "bg-green-600 border-green-400/20" : "bg-primary border-primary-foreground/20")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10 text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage en cours
                            </p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{emetteur.sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{emetteur.vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[10px] px-3 h-6 animate-pulse">EN LIGNE</Badge>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                    {emetteur.vesselStatus === 'moving' ? <Move className="size-3" /> : emetteur.vesselStatus === 'returning' ? <Navigation className="size-3" /> : emetteur.vesselStatus === 'landed' ? <Home className="size-3" /> : <Anchor className="size-3" />}
                                    {emetteur.vesselStatus === 'moving' ? 'En mouvement' : emetteur.vesselStatus === 'returning' ? 'Retour Maison' : emetteur.vesselStatus === 'landed' ? 'À terre' : 'Au mouillage'}
                                </span>
                            </div>
                            <Button variant="destructive" size="sm" className="h-8 font-black uppercase text-[9px] border-2 border-white/20" onClick={emetteur.stopSharing}>Quitter</Button>
                        </div>
                    </Card>
                </div>
            ) : (
                <Card className="border-2 shadow-xl overflow-hidden rounded-[2.5rem] bg-white animate-in fade-in slide-in-from-top-2">
                    <CardHeader className="bg-white border-b p-6">
                        <CardTitle className="text-sm font-black uppercase tracking-tight text-primary flex items-center gap-3">
                            <Navigation className="size-5 text-primary rotate-45" /> IDENTITÉ &amp; PARTAGE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Mon Surnom</Label>
                                <Input 
                                    value={emetteur.vesselNickname} 
                                    onChange={e => emetteur.setVesselNickname(e.target.value)} 
                                    placeholder="KOolapik" 
                                    className="h-14 border-2 font-black text-lg bg-slate-100" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">ID Navire</Label>
                                    <Input 
                                        value={emetteur.customSharingId} 
                                        onChange={e => emetteur.setCustomSharingId(e.target.value)} 
                                        placeholder="XXX" 
                                        className="h-14 border-2 font-black text-center text-sm uppercase bg-slate-100" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-[#8b5cf6] tracking-widest ml-1">ID Flotte</Label>
                                    <Input 
                                        value={emetteur.customFleetId} 
                                        onChange={e => emetteur.setCustomFleetId(e.target.value)} 
                                        placeholder="ABC" 
                                        className="h-14 border-2 font-black text-center text-sm uppercase bg-[#f5f3ff]" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-[#10b981] tracking-widest ml-1">Commentaire Flotte</Label>
                                <Input 
                                    value={emetteur.fleetComment} 
                                    onChange={e => emetteur.setFleetComment(e.target.value)} 
                                    placeholder="TEST ADMIN" 
                                    className="h-14 border-2 font-black text-center text-xs uppercase bg-[#ebf7f3] border-[#d1e9e0]" 
                                />
                            </div>

                            <Button 
                                onClick={emetteur.startSharing} 
                                className="w-full h-16 font-black uppercase tracking-widest text-sm shadow-xl gap-3 rounded-2xl bg-primary hover:bg-primary/90"
                            >
                                <Zap className="size-6 fill-white" /> LANCER LE PARTAGE GPS
                            </Button>
                        </div>

                        <div className="pt-6 border-t border-dashed">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Mes Flottes Enregistrées</p>
                            <div className="grid gap-3">
                                {emetteur.savedFleets.map((fleet, idx) => (
                                    <div key={idx} className="p-4 bg-white border-2 rounded-2xl shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30" onClick={() => { emetteur.setCustomFleetId(fleet.id); if (fleet.comment) emetteur.setFleetComment(fleet.comment); }}>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm text-primary uppercase">{fleet.id}</span>
                                            {fleet.comment && <span className="text-[10px] font-bold text-muted-foreground uppercase">{fleet.comment}</span>}
                                        </div>
                                        <Button variant="ghost" size="icon" className="size-10 text-destructive/40 hover:text-destructive hover:bg-red-50" onClick={(e) => { e.stopPropagation(); emetteur.removeFleet(fleet); }}>
                                            <Trash2 className="size-5" />
                                        </Button>
                                    </div>
                                ))}
                                {emetteur.savedFleets.length === 0 && (
                                    <div className="p-10 text-center border-4 border-dashed rounded-[2.5rem] opacity-20">
                                        <p className="text-[10px] font-black uppercase tracking-widest italic">Aucun groupe favori enregistré</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </TabsContent>
      </Tabs>

      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="cockpit" className="border-none">
              <AccordionTrigger className="h-12 px-6 bg-slate-900 text-white hover:no-underline rounded-2xl shadow-xl">
                  <div className="flex items-center gap-3">
                      <ClipboardList className="size-5 text-primary" />
                      <span className="text-sm font-black uppercase tracking-tighter">COCKPIT : JOURNAL &amp; RÉGLAGES</span>
                  </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <Tabs defaultValue="tactical" className="w-full">
                      <TabsList className={cn("grid h-12 bg-muted/20 border-y rounded-none", isAdmin ? "grid-cols-5" : "grid-cols-4")}>
                          <TabsTrigger value="tactical" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                          <TabsTrigger value="technical" className="text-[10px] font-black uppercase">Journal</TabsTrigger>
                          <TabsTrigger value="settings" className="text-[10px] font-black uppercase">Sons</TabsTrigger>
                          <TabsTrigger value="sms" className="text-[10px] font-black uppercase text-orange-600">SMS</TabsTrigger>
                          {isAdmin && <TabsTrigger value="labo" className="text-[10px] font-black uppercase text-red-600">Labo</TabsTrigger>}
                      </TabsList>
                      
                      <TabsContent value="tactical" className="m-0 p-4 bg-white space-y-6">
                          <div className="grid grid-cols-4 gap-2">
                              {['MARLIN', 'THON', 'TAZARD', 'WAHOO', 'BONITE', 'SARDINES', 'OISEAUX', 'PRISE'].map(type => (
                                  <Button key={type} variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation" onClick={() => handleTactical(type)}>
                                      {type === 'OISEAUX' ? <Bird className="size-5 text-primary" /> : 
                                       type === 'SARDINES' ? <Waves className="size-5 text-primary" /> :
                                       type === 'PRISE' ? <Camera className="size-5 text-primary" /> : <Fish className="size-5 text-primary" />}
                                      <span className="text-[9px] font-black uppercase">{type}</span>
                                  </Button>
                              ))}
                          </div>

                          <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-6 shadow-2xl border border-white/10">
                              <div className="flex items-center gap-2 mb-2">
                                  <Ghost className="size-4 text-primary" />
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Confidentialité Tactique</h4>
                              </div>
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                      <div className="space-y-0.5">
                                          <p className="text-xs font-black uppercase">Mode Fantôme</p>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Invisible pour la Flotte C</p>
                                      </div>
                                      <Switch checked={emetteur.isGhostMode} onCheckedChange={emetteur.toggleGhostMode} />
                                  </div>
                                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                      <div className="space-y-0.5">
                                          <p className="text-xs font-black uppercase">Masquer Tracé</p>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Cache la ligne bleue</p>
                                      </div>
                                      <Switch checked={emetteur.isTrajectoryHidden} onCheckedChange={emetteur.toggleTrajectoryHidden} />
                                  </div>
                              </div>
                              <Button variant="outline" className="w-full h-12 bg-white text-slate-900 font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl border-none" onClick={() => { emetteur.resetTrajectory(); mapCore.clearBreadcrumbs(); toast({ title: "Trajectoire réinitialisée" }); }}>
                                  <History className="size-4" /> Reset Trajectoire
                              </Button>
                          </div>
                      </TabsContent>

                      <TabsContent value="technical" className="m-0 p-4 bg-white">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground">Historique session</p>
                            <Button variant="ghost" size="sm" onClick={emetteur.clearLogs} className="h-6 text-[8px] font-black uppercase text-destructive border border-destructive/20">Purger l'historique</Button>
                        </div>
                        <ScrollArea className="h-48">
                            <div className="space-y-2">
                                {emetteur.techLogs.map((log, i) => {
                                    const isTactical = ['CHGT STATUT', 'DÉRIVE', 'URGENCE', 'CHGT MANUEL', 'MOUILLAGE', 'POSITION', 'ANNULATION'].includes(log.label);
                                    return (
                                        <div key={i} className={cn("p-2 border rounded-lg bg-slate-50 text-[10px] flex justify-between", isTactical && "border-primary/20 bg-primary/5")}>
                                            <span className={cn("font-black uppercase", isTactical ? "text-primary" : "text-slate-700")}>{log.label} - {log.status}</span>
                                            <span className="font-bold opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="settings" className="m-0 p-0 space-y-0 bg-slate-50">
                          <div className="p-4 bg-white border-b sticky top-0 z-10">
                              <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3 bg-primary" onClick={recepteur.savePrefsToFirestore} disabled={recepteur.isSaving}>
                                  {recepteur.isSaving ? <RefreshCw className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} ENREGISTRER ET VALIDER
                              </Button>
                          </div>

                          <ScrollArea className="h-[400px]">
                            <div className="p-4 space-y-6 pb-10">
                                <Card className="border-2 border-primary/10 bg-primary/5 rounded-2xl p-4 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-11px] font-black uppercase text-primary">Alertes Sonores</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Activer les signaux audio</p>
                                    </div>
                                    <Switch checked={recepteur.vesselPrefs.isNotifyEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isNotifyEnabled: v })} />
                                </Card>

                                <div className="space-y-3 px-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><Volume2 className="size-4 text-primary" /> VOLUME</Label>
                                    <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} step={1} onValueChange={v => recepteur.updateLocalPrefs({ volume: v[0] / 100 })} />
                                </div>

                                <div className="grid gap-4 pt-4 border-t border-dashed">
                                    {['moving', 'stationary', 'drifting', 'offline', 'assistance', 'tactical', 'battery'].map(key => {
                                        const config = recepteur.vesselPrefs.alerts[key as keyof typeof recepteur.vesselPrefs.alerts];
                                        if (!config) return null;
                                        return (
                                            <Card key={key} className="border-2 rounded-2xl overflow-hidden shadow-sm bg-white">
                                                <div className="p-3 bg-slate-50 border-b flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Bell className="size-3.5 text-primary" />
                                                        <span className="text-[10px] font-black uppercase">{key}</span>
                                                    </div>
                                                    <Switch 
                                                        checked={config.enabled} 
                                                        onCheckedChange={(v) => {
                                                            const newAlerts = { ...recepteur.vesselPrefs.alerts };
                                                            newAlerts[key as keyof typeof recepteur.vesselPrefs.alerts] = { ...config, enabled: v };
                                                            recepteur.updateLocalPrefs({ alerts: newAlerts });
                                                        }}
                                                    />
                                                </div>
                                                <div className="p-3 flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <Select value={config.sound} onValueChange={(v) => {
                                                            const newAlerts = { ...recepteur.vesselPrefs.alerts };
                                                            newAlerts[key as keyof typeof recepteur.vesselPrefs.alerts] = { ...config, sound: v };
                                                            recepteur.updateLocalPrefs({ alerts: newAlerts });
                                                        }}>
                                                            <SelectTrigger className="h-10 border-2 font-black uppercase text-[10px] bg-slate-50">
                                                                <SelectValue placeholder="Son..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {recepteur.availableSounds.map(s => (
                                                                    <SelectItem key={s.id} value={s.label} className="text-[10px] font-black uppercase">{s.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex items-center gap-2 border-2 rounded-xl px-2 h-10 bg-slate-50">
                                                        <span className="text-[8px] font-black uppercase">LOOP</span>
                                                        <Switch 
                                                            checked={config.loop} 
                                                            onCheckedChange={(v) => {
                                                                const newAlerts = { ...recepteur.vesselPrefs.alerts };
                                                                newAlerts[key as keyof typeof recepteur.vesselPrefs.alerts] = { ...config, loop: v };
                                                                recepteur.updateLocalPrefs({ alerts: newAlerts });
                                                            }}
                                                            className="scale-75"
                                                        />
                                                    </div>
                                                    <Button variant="outline" size="icon" className="h-10 w-10 border-2 bg-white" onClick={() => {
                                                        const sound = recepteur.availableSounds.find(s => s.label === config.sound);
                                                        if (sound) { const audio = new Audio(sound.url); audio.volume = recepteur.vesselPrefs.volume; audio.play(); }
                                                    }}>
                                                        <Play className="size-4 fill-primary text-primary" />
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                          </ScrollArea>
                      </TabsContent>

                      <TabsContent value="sms" className="m-0 p-0 bg-slate-50">
                          <ScrollArea className="h-[500px]">
                              <div className="p-4 space-y-6 pb-10">
                                <Card className="border-2 shadow-lg overflow-hidden rounded-3xl bg-white border-primary/10">
                                    <CardHeader className="bg-slate-50 border-b p-4">
                                        <div className="flex items-center gap-3">
                                            <Smartphone className="size-5 text-orange-600" />
                                            <CardTitle className="text-[11px] font-black uppercase tracking-tight text-slate-800">RÉGLAGES D'URGENCE (SMS)</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-6">
                                        <div className="flex items-center justify-between border-b border-dashed pb-4">
                                            <div className="space-y-0.5">
                                                <Label className="text-xs font-black uppercase text-slate-800">ACTIVER LE CONTACT SMS</Label>
                                                <p className="text-[8px] font-bold text-orange-600 uppercase">ENVOI AUTO LORS D'UN MAYDAY/PAN PAN</p>
                                            </div>
                                            <Switch checked={emetteur.isEmergencyEnabled} onCheckedChange={emetteur.setIsEmergencyEnabled} />
                                        </div>

                                        <div className={cn("space-y-5", !emetteur.isEmergencyEnabled && "opacity-40 pointer-events-none")}>
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">NUMÉRO D'URGENCE (MAYDAY/PAN PAN)</Label>
                                                <div className="relative">
                                                    <Input 
                                                        value={emetteur.emergencyContact} 
                                                        onChange={e => emetteur.setEmergencyContact(e.target.value)} 
                                                        placeholder="Ex: 742929" 
                                                        className="h-12 border-2 bg-slate-100 font-black text-lg pl-10" 
                                                    />
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">NUMÉRO DU CONTACT À TERRE</Label>
                                                <div className="relative">
                                                    <Input 
                                                        value={emetteur.assistanceContact} 
                                                        onChange={e => emetteur.setAssistanceContact(e.target.value)} 
                                                        placeholder="Ex: 742929" 
                                                        className="h-12 border-2 bg-slate-100 font-black text-lg pl-10" 
                                                    />
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-blue-400" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">MESSAGE PERSONNALISÉ</Label>
                                                <Textarea 
                                                    placeholder="Ex: Problème moteur, besoin aide immédiate." 
                                                    value={emetteur.vesselSmsMessage} 
                                                    onChange={e => setVesselSmsMessage(e.target.value)} 
                                                    className="border-2 font-medium min-h-[100px] bg-slate-100 text-sm"
                                                />
                                            </div>

                                            <div className="space-y-2 pt-2 border-t border-dashed">
                                                <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2 ml-1">
                                                    <Eye className="size-3" /> APERÇU DU MESSAGE :
                                                </p>
                                                <div className="p-4 bg-muted/30 border-2 border-dashed border-slate-200 rounded-2xl">
                                                    <p className="text-[9px] font-medium leading-relaxed italic text-slate-600 font-mono">
                                                        {`[${(emetteur.vesselNickname || 'MON NAVIRE').toUpperCase()}] ${emetteur.vesselSmsMessage || 'Besoin assistance.'} à ${format(new Date(), 'HH:mm')} +/- ${emetteur.accuracy}m : https://www.google.com/maps?q=${emetteur.currentPos?.lat || 0},${emetteur.currentPos?.lng || 0}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button onClick={emetteur.handleSaveSmsSettings} className="w-full h-14 bg-primary text-white font-black uppercase text-[11px] tracking-widest shadow-xl rounded-2xl gap-3">
                                                <Save className="size-5" /> SAUVEGARDER RÉGLAGES SMS
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                              </div>
                          </ScrollArea>
                      </TabsContent>

                      {isAdmin && (
                        <TabsContent value="labo" className="m-0 p-4 space-y-6 bg-white">
                            <div className="p-6 border-2 border-dashed border-red-200 rounded-[2.5rem] bg-red-50/20 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Zap className="size-5 text-red-600 fill-red-600" />
                                        <span className="text-sm font-black uppercase tracking-tighter text-red-600">Sandbox Tactique</span>
                                    </div>
                                    <Switch checked={simulator.isActive} onCheckedChange={(v) => simulator.setIsActive(v)} />
                                </div>

                                <div className={cn("space-y-8", !simulator.isActive && "opacity-40 pointer-events-none")}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                    <Move className="size-3" /> Vitesse
                                                </Label>
                                                <span className="text-xs font-black text-red-600">{simulator.simSpeed.toFixed(1)} ND</span>
                                            </div>
                                            <Slider value={[simulator.simSpeed]} max={40} step={0.1} onValueChange={v => simulator.setSimSpeed(v[0])} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                    <Compass className="size-3" /> Cap
                                                </Label>
                                                <span className="text-xs font-black text-red-600">{simulator.simBearing}°</span>
                                            </div>
                                            <Slider value={[simulator.simBearing]} max={360} step={1} onValueChange={v => simulator.setSimBearing(v[0])} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                    <LocateFixed className="size-3" /> Précision (ACC)
                                                </Label>
                                                <span className="text-xs font-black text-red-600">{simulator.simAccuracy}M</span>
                                            </div>
                                            <Slider value={[simulator.simAccuracy]} min={1} max={100} step={1} onValueChange={v => simulator.setSimAccuracy(v[0])} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                    <AlertTriangle className="size-3" /> Bruit (Saut)
                                                </Label>
                                                <span className="text-xs font-black text-red-600">{simulator.simGpsNoise}M</span>
                                            </div>
                                            <Slider value={[simulator.simGpsNoise]} max={50} step={1} onValueChange={v => simulator.setSimGpsNoise(v[0])} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                    <Clock className="size-3" /> Time Offset
                                                </Label>
                                                <span className="text-xs font-black text-red-600">{simulator.timeOffset} MIN</span>
                                            </div>
                                            <Slider value={[simulator.timeOffset]} min={-1440} max={1440} step={1} onValueChange={v => simulator.setTimeOffset(v[0])} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between text-[10px] font-black uppercase px-1">
                                                <span className="flex items-center gap-1"><Battery className="size-3" /> Batterie</span>
                                                <span className="text-red-600">{simulator.simBattery}%</span>
                                            </div>
                                            <Slider value={[simulator.simBattery]} max={100} step={1} onValueChange={v => simulator.setSimBattery(v[0])} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-4 bg-white border-2 rounded-2xl shadow-sm">
                                            <Label className="text-[10px] font-black uppercase text-slate-800">Coupure GPS</Label>
                                            <Switch checked={simulator.isGpsCut} onCheckedChange={(v) => simulator.setIsGpsCut(v)} />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white border-2 rounded-2xl shadow-sm">
                                            <Label className="text-[10px] font-black uppercase text-slate-800">Coupure COM</Label>
                                            <Switch checked={simulator.isComCut} onCheckedChange={(v) => simulator.setIsComCut(v)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Button 
                                            variant={simulator.isTeleportMode ? "default" : "outline"} 
                                            className={cn("h-14 font-black uppercase text-xs border-2 rounded-2xl transition-all shadow-sm", simulator.isTeleportMode && "bg-slate-900 text-white")}
                                            onClick={() => simulator.setIsTeleportMode(!simulator.isTeleportMode)}
                                        >
                                            Injection Clic
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            className="h-14 font-black uppercase text-xs border-2 rounded-2xl text-red-600 border-red-100 bg-white hover:bg-red-50 shadow-sm"
                                            onClick={() => simulator.forceDrift(emetteur.anchorPos, emetteur.mooringRadius)}
                                        >
                                            Lancer Dérive
                                        </Button>
                                    </div>

                                    <Button 
                                        className={cn(
                                            "w-full h-20 text-lg font-black uppercase tracking-widest shadow-2xl rounded-3xl transition-all border-4 border-white/20",
                                            simulator.isMoving ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
                                        )}
                                        onClick={() => simulator.setIsMoving(!simulator.isMoving)}
                                    >
                                        {simulator.isMoving ? "Arrêter Simulation" : "Lancer Simulation"}
                                    </Button>

                                    <button 
                                        onClick={() => {
                                            simulator.stopSim();
                                            toast({ title: "Données réelles rétablies" });
                                        }}
                                        className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-colors py-2"
                                    >
                                        Rétablir données réelles
                                    </button>
                                </div>
                            </div>
                        </TabsContent>
                      )}
                  </Tabs>
              </AccordionContent>
          </AccordionItem>
      </Accordion>
    </div>
  );
}
