"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useSimulator } from '@/logic/shared/useSimulator';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
import { useRadarIA } from '@/logic/shared/useRadarIA';
import { GoogleMap, OverlayView, Circle, Polyline } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
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
  arrayRemove
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
  Radio,
  ZapOff,
  EyeOff
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn, calculateProjectedPosition } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { UserAccount, VesselStatus, SoundLibraryEntry, TechLogEntry, VesselPrefs } from '@/lib/types';
import { useGoogleMaps } from '@/context/google-maps-context';
import { useToast } from '@/hooks/use-toast';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600 animate-pulse")} />;
  if (level <= 50) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const VesselMarker = ({ vessel }: { vessel: VesselStatus }) => {
    const status = vessel.status || 'moving';
    let Icon = Navigation;
    let bgColor = 'bg-green-600'; 
    let animationClass = '';
    let statusLabel = 'EN ROUTE';

    switch (status) {
        case 'stationary': Icon = Anchor; bgColor = 'bg-blue-600'; statusLabel = 'MOUILLAGE'; break;
        case 'drifting': Icon = AlertTriangle; bgColor = 'bg-red-600'; animationClass = 'animate-blink-red'; statusLabel = 'DÉRIVE'; break;
        case 'emergency': Icon = ShieldAlert; bgColor = 'bg-red-600'; animationClass = 'animate-pulse-red'; statusLabel = 'URGENCE'; break;
        case 'returning': Icon = Navigation; bgColor = 'bg-indigo-600'; statusLabel = 'RETOUR'; break;
        case 'landed': Icon = Home; bgColor = 'bg-green-600'; statusLabel = 'À TERRE'; break;
        case 'moving': default: Icon = Navigation; bgColor = 'bg-green-600'; statusLabel = 'MOUVEMENT'; break;
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
                            statusLabel === 'MOUVEMENT' ? "text-green-400" : 
                            statusLabel === 'MOUILLAGE' ? "text-blue-400" : "text-red-400"
                        )}>
                            {statusLabel} {vessel.speed !== undefined && `| ${vessel.speed.toFixed(1)}ND`}
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
  
  const [appMode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isAdjustingRadius, setIsAdjustingRadius] = useState(false);
  
  const mapCore = useMapCore();
  const simulator = useSimulator();

  useEffect(() => { setIsMounted(true); }, []);

  const handlePositionUpdate = useCallback((lat: number, lng: number, status: string) => {
    mapCore.updateBreadcrumbs(lat, lng, status);
    if (mapCore.isFollowMode && mapCore.googleMap) { mapCore.googleMap.panTo({ lat, lng }); }
  }, [mapCore]);

  const handleStopCleanup = useCallback(() => { mapCore.clearBreadcrumbs(); }, [mapCore]);

  const userProfileRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

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

  useEffect(() => {
    const handleGlobalMessage = (e: MessageEvent) => {};
    window.addEventListener('message', handleGlobalMessage);
    return () => window.removeEventListener('message', handleGlobalMessage);
  }, []);

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

  // Sync Tactical Markers for the whole followed group
  useEffect(() => {
    if (firestore && (followedVessels || emetteur.isSharing)) {
        const ids = followedVessels?.map(v => v.id) || [];
        if (emetteur.sharingId) ids.push(emetteur.sharingId);
        const unsub = mapCore.syncTacticalMarkers(Array.from(new Set(ids)));
        return () => unsub();
    }
  }, [followedVessels, emetteur.isSharing, emetteur.sharingId, firestore, mapCore]);

  const activeCirclesRef = useRef<(google.maps.Circle | google.maps.Polyline)[]>([]);
  const prevStatusRef = useRef<string>('');
  const hasCenteredInitially = useRef(false);

  const hardClearCircles = useCallback(() => {
    activeCirclesRef.current.forEach(obj => { try { obj.setMap(null); } catch (e) {} });
    activeCirclesRef.current = [];
  }, []);

  useEffect(() => {
    if (prevStatusRef.current !== emetteur.vesselStatus) {
        if (emetteur.vesselStatus === 'moving' || emetteur.vesselStatus === 'returning' || emetteur.vesselStatus === 'landed' || emetteur.vesselStatus === 'offline') {
            hardClearCircles();
            if (emetteur.vesselStatus !== 'drifting' && emetteur.vesselStatus !== 'emergency') {
                recepteur.stopAllAlarms();
            }
        }
        prevStatusRef.current = emetteur.vesselStatus;
    }
  }, [emetteur.vesselStatus, hardClearCircles, recepteur]);

  useEffect(() => {
    if (emetteur.currentPos && !hasCenteredInitially.current && mapCore.googleMap) {
        mapCore.handleRecenter(emetteur.currentPos);
        hasCenteredInitially.current = true;
    }
  }, [emetteur.currentPos, mapCore]);

  useEffect(() => {
    if (emetteur.vesselStatus === 'drifting' && emetteur.currentPos && mapCore.googleMap) {
        const proj = calculateProjectedPosition(emetteur.currentPos.lat, emetteur.currentPos.lng, emetteur.currentSpeed, emetteur.currentHeading, recepteur.vesselPrefs.driftProjectionMinutes || 5);
        const elevator = new google.maps.ElevationService();
        elevator.getElevationForLocations({ locations: [new google.maps.LatLng(proj.lat, proj.lng)] }, (results, status) => {
            if (status === 'OK' && results && results[0] && results[0].elevation > 0) {
                if (!isImpactProbable) {
                    setIsImpactProbable(true);
                    toast({ variant: "destructive", title: "DANGER COLLISION", duration: 10000 });
                }
            } else { setIsImpactProbable(false); }
        });
    } else { setIsImpactProbable(false); }
  }, [emetteur.vesselStatus, emetteur.currentPos, emetteur.currentSpeed, emetteur.currentHeading, recepteur.vesselPrefs.driftProjectionMinutes, mapCore.googleMap, isImpactProbable, toast]);

  const [isLedActive, setIsLedActive] = useState(false);
  useEffect(() => {
    if (emetteur.lastSyncTime > 0) {
      setIsLedActive(true);
      const timer = setTimeout(() => setIsLedActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emetteur.lastSyncTime]);

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

  const activeAnchorVessel = useMemo(() => {
    if (mapCore.isCirclesHidden) return null;
    if (simulator.isActive && simulator.simPos) {
        const aPos = emetteur.anchorPos || simulator.simPos;
        return { 
            id: 'SANDBOX', status: emetteur.vesselStatus, anchorLocation: { latitude: aPos.lat, longitude: aPos.lng }, 
            location: { latitude: simulator.simPos.lat, longitude: simulator.simPos.lng }, mooringRadius: emetteur.mooringRadius,
            accuracy: simulator.simAccuracy || 5, speed: simulator.simSpeed, heading: simulator.simBearing, isSim: true
        };
    }
    if (emetteur.isSharing && emetteur.anchorPos) {
        return { 
            id: emetteur.sharingId, status: emetteur.vesselStatus, anchorLocation: { latitude: emetteur.anchorPos.lat, longitude: emetteur.anchorPos.lng }, 
            location: emetteur.currentPos ? { latitude: emetteur.currentPos.lat, longitude: emetteur.currentPos.lng } : null, 
            mooringRadius: emetteur.mooringRadius, accuracy: emetteur.accuracy, speed: emetteur.currentSpeed, heading: emetteur.currentHeading, isSim: false
        };
    }
    return null;
  }, [simulator, emetteur, mapCore.isCirclesHidden]);

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

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || emetteur.customSharingId).trim().toUpperCase();
    try {
        await updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: arrayUnion(cleanId), lastVesselId: cleanId });
        if (vesselIdToFollow) setVesselIdToFollow('');
        toast({ title: "ID enregistré" });
    } catch (e) { toast({ variant: 'destructive', title: "Erreur" }); }
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1 relative">
      {recepteur.isAlarmActive && (
        <Button className="fixed top-2 left-1/2 -translate-x-1/2 z-[10008] h-14 bg-red-600 text-white font-black uppercase shadow-2xl animate-bounce gap-3 px-8 rounded-full border-4 border-white" onClick={recepteur.stopAllAlarms}>
            <Volume2 className="size-6 animate-pulse" /> ARRÊTER LE SON
        </Button>
      )}

      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <Button variant={appMode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setMode('sender'); recepteur.initAudio(); }}>Émetteur (A)</Button>
          <Button variant={appMode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setMode('receiver'); recepteur.initAudio(); }}>Récepteur (B)</Button>
          <Button variant={appMode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setMode('fleet'); recepteur.initAudio(); }}>Flotte (C)</Button>
      </div>

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] flex bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border-2 border-white/20 shadow-2xl">
            <Button variant={mapCore.viewMode === 'alpha' ? 'default' : 'ghost'} size="sm" className="h-9 px-4 font-black uppercase text-[10px] rounded-xl" onClick={() => mapCore.setViewMode('alpha')}>Maps</Button>
            <Button variant={mapCore.viewMode === 'beta' ? 'default' : 'ghost'} size="sm" className="h-9 px-4 font-black uppercase text-[10px] rounded-xl" onClick={() => mapCore.setViewMode('beta')}>Météo</Button>
            <Button variant={mapCore.viewMode === 'gamma' ? 'default' : 'ghost'} size="sm" className="h-9 px-4 font-black uppercase text-[10px] rounded-xl" onClick={() => mapCore.setViewMode('gamma')}>Windy</Button>
        </div>

        <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={12} onLoad={mapCore.setGoogleMap} onDragStart={() => mapCore.setIsFollowMode(false)} onClick={(e) => { recepteur.initAudio(); if (simulator.isTeleportMode && e.latLng) simulator.teleport(e.latLng.lat(), e.latLng.lng()); }} options={{ disableDefaultUI: true, mapTypeId: mapCore.viewMode === 'beta' ? 'hybrid' : 'satellite', gestureHandling: 'greedy' }}>
            {!emetteur.isTrajectoryHidden && mapCore.breadcrumbs.length > 1 && <Polyline path={mapCore.breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: '#3b82f6', strokeOpacity: 0.6, strokeWeight: 2, zIndex: 1 }} />}
            
            {activeAnchorVessel && activeAnchorVessel.anchorLocation && (
                <React.Fragment>
                    {activeAnchorVessel.accuracy && activeAnchorVessel.accuracy > 20 && (
                        <Circle 
                            center={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} 
                            radius={activeAnchorVessel.accuracy} 
                            options={{ strokeColor: '#ffffff', strokeOpacity: 0.3, strokeWeight: 1, fillColor: '#ffffff', fillOpacity: 0.05, clickable: false, zIndex: 0 }} 
                        />
                    )}
                    
                    <OverlayView position={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -320%)', zIndex: 9999 }} className="flex flex-col items-center pointer-events-none mb-3">
                            <div className={cn("px-[10px] py-[4px] rounded-lg backdrop-blur-md border text-[11px] font-black uppercase shadow-2xl whitespace-nowrap bg-slate-900/80 text-white border-white", activeAnchorVessel.status === 'drifting' && "bg-red-600/90 animate-pulse")}>
                                {activeAnchorVessel.status === 'drifting' && (activeAnchorVessel.speed || 0) > 0.2 && "⚠️ "}
                                RAYON : {activeAnchorVessel.mooringRadius}M | DIST : {emetteur.smoothedDistance || 0}M | VITESSE : {(activeAnchorVessel.speed || 0).toFixed(1)} ND
                                {activeAnchorVessel.accuracy && activeAnchorVessel.accuracy > 20 && ` (PREC +/-${activeAnchorVessel.accuracy}M)`}
                            </div>
                            <div className="w-0.5 h-3 bg-white/40 shadow-sm" />
                        </div>
                    </OverlayView>
                    <Circle 
                        center={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} 
                        radius={activeAnchorVessel.mooringRadius || 100} 
                        options={mooringCircleOptions || {}} 
                    />
                </React.Fragment>
            )}
            
            {followedVessels?.filter(v => v.isSharing && v.location && v.id !== emetteur.sharingId).map(vessel => (
                <OverlayView key={vessel.id} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <VesselMarker vessel={vessel} />
                </OverlayView>
            ))}

            {emetteur.isSharing && emetteur.currentPos && (
                <OverlayView position={emetteur.currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <VesselMarker vessel={{ id: emetteur.sharingId, displayName: emetteur.vesselNickname || 'Moi', status: emetteur.vesselStatus, speed: emetteur.currentSpeed, batteryLevel: Math.round(emetteur.battery.level * 100), isCharging: emetteur.battery.charging, isSharing: true, isGhostMode: emetteur.isGhostMode, lastActive: new Date() } as any} />
                </OverlayView>
            )}

            {/* Render Tactical Markers */}
            {mapCore.tacticalMarkers.map(marker => (
                <OverlayView key={marker.id} position={marker.pos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center group cursor-pointer z-[100]">
                        <div className="px-1.5 py-0.5 bg-slate-900/90 text-white rounded text-[8px] font-black shadow-lg border border-white/20 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {marker.type} - {marker.vesselName}
                        </div>
                        <div className="p-1.5 rounded-full bg-white border-2 border-primary shadow-xl ring-2 ring-primary/20">
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
        
        <div className="absolute top-4 left-4 z-[9999] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>{mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
        </div>
        <div className="absolute top-4 right-4 z-[9999] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl transition-all", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}>{mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}</Button>
            <Button onClick={handleRecenter} className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl flex items-center justify-center"><LocateFixed className="size-5"/></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
          {appMode === 'sender' && (
              <div className="space-y-4">
                  {emetteur.isSharing ? (
                      <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-primary/20">
                          <CardHeader className="bg-primary/5 p-4 border-b flex flex-row justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className="p-2 bg-primary text-white rounded-lg shadow-sm"><Navigation className={cn("size-5", emetteur.vesselStatus === 'moving' && "animate-pulse")} /></div>
                                  <div>
                                      <div className="flex items-center gap-2">
                                          {emetteur.isGhostMode && <Ghost className="size-3 text-primary animate-pulse" />}
                                          <CardTitle className="text-sm font-black uppercase text-primary leading-none">{emetteur.sharingId}</CardTitle>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Vitesse : {emetteur.currentSpeed.toFixed(1)} ND</p>
                                          <Badge variant="outline" className={cn("h-4 text-[7px] font-black uppercase px-1 border-dashed", emetteur.accuracy > 15 ? "text-orange-600 border-orange-300" : "text-green-600 border-green-300")}>+/-{emetteur.accuracy}M</Badge>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <BatteryIconComp level={emetteur.battery?.level * 100} charging={emetteur.battery?.charging} className="size-5" />
                                  <div className={cn("size-3 rounded-full bg-green-500 shadow-sm", isLedActive ? "scale-125 glow" : "opacity-30")} />
                              </div>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                              <div className="p-4 bg-orange-50/30 border-2 border-orange-100 rounded-2xl space-y-4">
                                  <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-black uppercase text-orange-800">Rayon Dérive</p>
                                      <p className="text-lg font-black text-orange-950 leading-none">{emetteur.mooringRadius}M</p>
                                  </div>
                                  <Slider 
                                    value={[emetteur.mooringRadius]} 
                                    min={10} max={100} step={10} 
                                    onPointerDown={() => setIsAdjustingRadius(true)}
                                    onPointerUp={() => setIsAdjustingRadius(false)}
                                    onValueChange={(v) => emetteur.setMooringRadius(v[0])} 
                                  />
                                  <Button variant="outline" size="sm" className="w-full h-10 font-black uppercase text-[9px] border-2 bg-white text-orange-600" onClick={emetteur.saveMooringRadius}><Save className="size-3 mr-2" /> Fixer comme rayon par défaut</Button>
                              </div>
                              <Button variant="destructive" className="w-full h-16 font-black uppercase text-xs tracking-widest shadow-xl rounded-2xl" onClick={emetteur.stopSharing}>ARRÊTER LE PARTAGE</Button>
                          </CardContent>
                      </Card>
                  ) : (
                      <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-primary/20">
                          <CardHeader className="bg-primary/5 p-5 border-b"><CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary"><Navigation className="size-4" /> Identité & Partage</CardTitle></CardHeader>
                          <CardContent className="p-5 space-y-5">
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Mon Surnom</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-12 border-2 font-black text-lg" /></div>
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Navire</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ABC-123" className="h-12 border-2 font-black text-center uppercase" /></div>
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 text-indigo-600">ID Flotte</Label><Input value={emetteur.customFleetId} onChange={e => emetteur.setCustomFleetId(e.target.value)} placeholder="GROUPE" className="h-12 border-2 border-indigo-100 font-black text-center uppercase" /></div>
                              </div>
                              <Button className="w-full h-16 font-black uppercase text-base bg-primary rounded-2xl shadow-xl gap-3" onClick={() => { recepteur.initAudio(); emetteur.startSharing(); }}><Zap className="size-5 fill-white" /> Lancer le Partage GPS</Button>
                          </CardContent>
                      </Card>
                  )}
              </div>
          )}

          {appMode === 'receiver' && (
              <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-blue-200">
                  <CardHeader className="bg-blue-50 p-5 border-b"><CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-blue-800"><Smartphone className="size-4" /> Récepteur B</CardTitle></CardHeader>
                  <CardContent className="p-5 space-y-4">
                      <div className="flex gap-2">
                          <Input placeholder="ID NAVIRE..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                          <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px]" onClick={() => { recepteur.initAudio(); handleSaveVessel(); }}>Suivre</Button>
                      </div>
                  </CardContent>
              </Card>
          )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-[10001] px-1 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
              <Accordion type="single" collapsible className="bg-white/95 backdrop-blur-md rounded-t-[2.5rem] shadow-2xl border-x-2 border-t-2 overflow-hidden">
                  <AccordionItem value="logs" className="border-none">
                      <AccordionTrigger className="h-12 px-6 hover:no-underline">
                          <div className="flex items-center gap-3">
                              <ClipboardList className="size-5 text-primary" />
                              <span className="text-sm font-black uppercase tracking-tighter">COCKPIT : JOURNAL & RÉGLAGES</span>
                              <Badge variant="outline" className="ml-2 text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/20 animate-pulse">LIVE</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                          <Tabs defaultValue="tactical" className="w-full">
                              <TabsList className={cn("grid h-12 bg-muted/20 border-y rounded-none", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
                                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                                  <TabsTrigger value="technical" className="text-[10px] font-black uppercase">Technique</TabsTrigger>
                                  <TabsTrigger value="settings" className="text-[10px] font-black uppercase">Réglages Sons</TabsTrigger>
                                  {isAdmin && <TabsTrigger value="labo" className="text-[10px] font-black uppercase text-red-600">Labo</TabsTrigger>}
                              </TabsList>
                              
                              <TabsContent value="tactical" className="m-0 p-4 bg-white space-y-6">
                                  <div className="grid grid-cols-4 gap-2">
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('MARLIN')}>
                                          <Target className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Marlin</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('THON')}>
                                          <Fish className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Thon</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('TAZARD')}>
                                          <Fish className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Tazard</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('WAHOO')}>
                                          <Fish className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Wahoo</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('BONITE')}>
                                          <Fish className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Bonite</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('SARDINES')}>
                                          <Waves className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Sardines</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95" onClick={() => handleTactical('OISEAUX')}>
                                          <Bird className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Oiseaux</span>
                                      </Button>
                                      <Button variant="outline" className="flex flex-col items-center justify-center h-20 rounded-xl border-2 gap-1 touch-manipulation transition-all active:scale-95 bg-slate-50" onClick={() => handleTactical('PRISE')}>
                                          <Camera className="size-5 text-primary" />
                                          <span className="text-[9px] font-black uppercase">Prise</span>
                                      </Button>
                                  </div>

                                  {/* BLOC CONFIDENTIALITÉ TACTIQUE v105.0 */}
                                  <div className="mt-6 p-5 bg-slate-900 text-white rounded-3xl space-y-6 shadow-2xl border border-white/10">
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
                                              <Switch 
                                                  checked={emetteur.isGhostMode} 
                                                  onCheckedChange={emetteur.toggleGhostMode}
                                                  className="data-[state=checked]:bg-primary"
                                              />
                                          </div>

                                          <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                              <div className="space-y-0.5">
                                                  <p className="text-xs font-black uppercase">Masquer Tracé</p>
                                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Cache la ligne bleue</p>
                                              </div>
                                              <Switch 
                                                  checked={emetteur.isTrajectoryHidden} 
                                                  onCheckedChange={emetteur.toggleTrajectoryHidden}
                                                  className="data-[state=checked]:bg-primary"
                                              />
                                          </div>
                                      </div>

                                      <Button 
                                          variant="outline" 
                                          className="w-full h-12 bg-white text-slate-900 font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl border-none hover:bg-slate-100 transition-all active:scale-[0.98]"
                                          onClick={() => {
                                              emetteur.resetTrajectory();
                                              mapCore.clearBreadcrumbs();
                                              toast({ title: "Trajectoire réinitialisée" });
                                          }}
                                      >
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
                                        {emetteur.techLogs.map((log, i) => (
                                            <div key={i} className="p-2 border rounded-lg bg-slate-50 text-[10px] flex justify-between">
                                                <span className="font-black uppercase">{log.label} - {log.status}</span>
                                                <span className="font-bold opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                              </TabsContent>

                              <TabsContent value="settings" className="m-0 p-4 space-y-6 bg-white animate-in fade-in duration-300">
                                  <Button 
                                    className="w-full h-14 font-black uppercase tracking-widest shadow-xl rounded-2xl gap-3 bg-primary hover:bg-primary/90 transition-all active:scale-95" 
                                    onClick={recepteur.savePrefsToFirestore}
                                    disabled={recepteur.isSaving}
                                  >
                                      {recepteur.isSaving ? <RefreshCw className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
                                      ENREGISTRER ET VALIDER
                                  </Button>

                                  <Card className="border-2 border-primary/10 bg-primary/5 rounded-2xl overflow-hidden">
                                      <CardContent className="p-4 flex items-center justify-between">
                                          <div className="space-y-0.5">
                                              <p className="text-[11px] font-black uppercase text-primary tracking-tight">ACTIVER LES SIGNAUX SONORES GLOBAUX</p>
                                              <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">PILOTAGE GÉNÉRAL DU THREAD AUDIO</p>
                                          </div>
                                          <Switch 
                                            checked={recepteur.vesselPrefs.isNotifyEnabled} 
                                            onCheckedChange={v => recepteur.updateLocalPrefs({ isNotifyEnabled: v })} 
                                          />
                                      </CardContent>
                                  </Card>

                                  <div className="space-y-3 px-1">
                                      <div className="flex items-center justify-between">
                                          <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                              <Volume2 className="size-4 text-primary" /> VOLUME (INTENSITY {Math.round(recepteur.vesselPrefs.volume * 100)}%)
                                          </Label>
                                      </div>
                                      <Slider 
                                        value={[recepteur.vesselPrefs.volume * 100]} 
                                        max={100} 
                                        step={1}
                                        onValueChange={v => recepteur.updateLocalPrefs({ volume: v[0] / 100 })} 
                                        className="py-2"
                                      />
                                  </div>

                                  <div className="grid gap-4 pt-4 border-t border-dashed">
                                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Réglages par type d'alerte</p>
                                      {[
                                          { key: 'moving', label: 'Mouvement' },
                                          { key: 'stationary', label: 'Mouillage' },
                                          { key: 'drifting', label: 'Dérive' },
                                          { key: 'offline', label: 'Signal Perdu' },
                                          { key: 'assistance', label: 'Assistance' },
                                          { key: 'tactical', label: 'Signal Tactique' },
                                          { key: 'battery', label: 'Batterie Faible' },
                                      ].map(({ key, label }) => {
                                          const config = recepteur.vesselPrefs.alerts[key as keyof typeof recepteur.vesselPrefs.alerts];
                                          if (!config) return null;

                                          return (
                                              <Card key={key} className="border-2 rounded-2xl overflow-hidden shadow-sm">
                                                  <div className="p-3 bg-slate-50 border-b flex items-center justify-between">
                                                      <div className="flex items-center gap-2">
                                                          <Bell className="size-3.5 text-primary" />
                                                          <span className="text-[10px] font-black uppercase">{label}</span>
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
                                                  <div className="p-3 bg-white flex items-center gap-2">
                                                      <div className="flex-1">
                                                          <Select 
                                                              value={config.sound} 
                                                              onValueChange={(v) => {
                                                                  const newAlerts = { ...recepteur.vesselPrefs.alerts };
                                                                  newAlerts[key as keyof typeof recepteur.vesselPrefs.alerts] = { ...config, sound: v };
                                                                  recepteur.updateLocalPrefs({ alerts: newAlerts });
                                                              }}
                                                          >
                                                              <SelectTrigger className="h-10 border-2 font-black uppercase text-[10px]">
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
                                                          <span className="text-[8px] font-black uppercase text-slate-400">LOOP</span>
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
                                                      <Button 
                                                          variant="outline" 
                                                          size="icon" 
                                                          className="h-10 w-10 border-2"
                                                          onClick={() => {
                                                              const sound = recepteur.availableSounds.find(s => s.label === config.sound);
                                                              if (sound) {
                                                                  const audio = new Audio(sound.url);
                                                                  audio.volume = recepteur.vesselPrefs.volume;
                                                                  audio.play();
                                                              }
                                                          }}
                                                      >
                                                          <Play className="size-4 fill-primary" />
                                                      </Button>
                                                  </div>
                                              </Card>
                                          );
                                      })}
                                  </div>

                                  <Card className="border-2 border-dashed border-primary/20 bg-muted/5 rounded-2xl p-4 space-y-4">
                                      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                                          <div className="flex items-center gap-2">
                                              <Clock className="size-4 text-primary" />
                                              <span className="text-[10px] font-black uppercase text-slate-700">VEILLE STRATÉGIQUE</span>
                                          </div>
                                          <Switch 
                                            checked={recepteur.vesselPrefs.isWatchEnabled} 
                                            onCheckedChange={v => recepteur.updateLocalPrefs({ isWatchEnabled: v })} 
                                          />
                                      </div>

                                      <div className={cn("space-y-4 transition-all duration-300", !recepteur.vesselPrefs.isWatchEnabled && "opacity-40 grayscale pointer-events-none")}>
                                          <div className="space-y-2">
                                              <div className="flex justify-between items-center px-1">
                                                  <Label className="text-[9px] font-black uppercase text-slate-500">SEUIL D'IMMOBILITÉ</Label>
                                                  <span className="text-xs font-black text-primary">
                                                      {recepteur.vesselPrefs.watchDuration >= 60 ? `${Math.floor(recepteur.vesselPrefs.watchDuration / 60)}H` : `${recepteur.vesselPrefs.watchDuration} MIN`}
                                                  </span>
                                              </div>
                                              <Slider 
                                                value={[recepteur.vesselPrefs.watchDuration]} 
                                                min={10} 
                                                max={1440} 
                                                step={10}
                                                onValueChange={v => recepteur.updateLocalPrefs({ watchDuration: v[0] })} 
                                              />
                                          </div>

                                          <div className="flex items-center gap-2">
                                              <div className="flex-1">
                                                  <Select 
                                                    value={recepteur.vesselPrefs.watchSound} 
                                                    onValueChange={v => recepteur.updateLocalPrefs({ watchSound: v })}
                                                  >
                                                      <SelectTrigger className="h-11 border-2 font-black uppercase text-[10px] bg-white">
                                                          <SelectValue placeholder="Choisir un son..." />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                          {recepteur.availableSounds.map(s => (
                                                              <SelectItem key={s.id} value={s.label} className="text-[10px] font-black uppercase">{s.label}</SelectItem>
                                                          ))}
                                                      </SelectContent>
                                                  </Select>
                                              </div>
                                              <div className="bg-white border-2 rounded-xl flex items-center px-3 h-11 gap-2 shadow-sm">
                                                  <span className="text-[8px] font-black uppercase text-slate-400">LOOP</span>
                                                  <Switch 
                                                    checked={recepteur.vesselPrefs.watchLoop} 
                                                    onCheckedChange={v => recepteur.updateLocalPrefs({ watchLoop: v })} 
                                                    className="scale-75"
                                                  />
                                              </div>
                                              <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-11 w-11 border-2 bg-white text-primary active:scale-90 transition-all"
                                                onClick={() => {
                                                    const sound = recepteur.availableSounds.find(s => s.label === recepteur.vesselPrefs.watchSound);
                                                    if (sound) {
                                                        const audio = new Audio(sound.url);
                                                        audio.volume = recepteur.vesselPrefs.volume;
                                                        audio.play();
                                                    }
                                                }}
                                              >
                                                  <Play className="size-5 fill-primary" />
                                              </Button>
                                          </div>
                                      </div>
                                  </Card>
                              </TabsContent>

                              {isAdmin && (
                                <TabsContent value="labo" className="m-0 p-4 space-y-6 bg-white animate-in fade-in duration-300">
                                    <div className="p-4 border-2 border-dashed border-red-200 rounded-[2rem] bg-red-50/30 space-y-6">
                                        <div className="flex items-center justify-between border-b border-red-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                <Zap className="size-4 text-red-600 fill-red-600" />
                                                <span className="text-xs font-black uppercase tracking-widest text-red-600">Sandbox Tactique</span>
                                            </div>
                                            <Switch checked={simulator.isActive} onCheckedChange={(v) => simulator.setIsActive(v)} />
                                        </div>

                                        <div className={cn("space-y-6 transition-all", !simulator.isActive && "opacity-40 pointer-events-none grayscale")}>
                                            {/* Vitesse & Cap */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="flex items-center gap-1"><Move className="size-3" /> Vitesse</span>
                                                        <span className="text-red-600">{simulator.simSpeed.toFixed(1)} ND</span>
                                                    </div>
                                                    <Slider value={[simulator.simSpeed]} max={10} step={0.1} onValueChange={v => simulator.setSimSpeed(v[0])} />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="flex items-center gap-1"><Compass className="size-3" /> Cap</span>
                                                        <span className="text-red-600">{simulator.simBearing}°</span>
                                                    </div>
                                                    <Slider value={[simulator.simBearing]} max={360} step={5} onValueChange={v => simulator.setSimBearing(v[0])} />
                                                </div>
                                            </div>

                                            {/* Précision & Bruit */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="flex items-center gap-1"><Target className="size-3" /> Précision (Acc)</span>
                                                        <span className="text-red-600">{simulator.simAccuracy}M</span>
                                                    </div>
                                                    <Slider value={[simulator.simAccuracy]} min={2} max={100} step={1} onValueChange={v => simulator.setSimAccuracy(v[0])} />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="flex items-center gap-1"><AlertTriangle className="size-3" /> Bruit (Saut)</span>
                                                        <span className="text-red-600">{simulator.simGpsNoise}M</span>
                                                    </div>
                                                    <Slider value={[simulator.simGpsNoise]} max={50} step={1} onValueChange={v => simulator.setSimGpsNoise(v[0])} />
                                                </div>
                                            </div>

                                            {/* Temps & Batterie */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="flex items-center gap-1"><Clock className="size-3" /> Time Offset</span>
                                                        <span className="text-red-600">{simulator.timeOffset} MIN</span>
                                                    </div>
                                                    <Slider value={[simulator.timeOffset]} min={0} max={1440} step={10} onValueChange={v => simulator.setTimeOffset(v[0])} />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                                        <span className="flex items-center gap-1"><Battery className="size-3" /> Batterie</span>
                                                        <span className="text-red-600">{simulator.simBattery}%</span>
                                                    </div>
                                                    <Slider value={[simulator.simBattery]} max={100} step={1} onValueChange={v => simulator.setSimBattery(v[0])} />
                                                </div>
                                            </div>

                                            {/* Coupures */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2">
                                                    <span className="text-[10px] font-black uppercase">Coupure GPS</span>
                                                    <Switch checked={simulator.isGpsCut} onCheckedChange={v => simulator.setIsGpsCut(v)} />
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2">
                                                    <span className="text-[10px] font-black uppercase">Coupure Com</span>
                                                    <Switch checked={simulator.isComCut} onCheckedChange={v => simulator.setIsComCut(v)} />
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button 
                                                        variant={simulator.isTeleportMode ? "default" : "outline"} 
                                                        className="h-12 font-black uppercase text-[10px] border-2" 
                                                        onClick={() => simulator.setIsTeleportMode(!simulator.isTeleportMode)}
                                                    >
                                                        {simulator.isTeleportMode ? "CLIQUEZ CARTE..." : "INJECTION CLIC"}
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        className="h-12 font-black uppercase text-[10px] border-2 text-red-600 border-red-100" 
                                                        onClick={() => simulator.forceDrift(emetteur.anchorPos, emetteur.mooringRadius)}
                                                    >
                                                        LANCER DÉRIVE
                                                    </Button>
                                                </div>
                                                <Button 
                                                    variant={simulator.isMoving ? "destructive" : "default"} 
                                                    className="w-full h-14 font-black uppercase text-xs shadow-lg rounded-xl" 
                                                    onClick={() => simulator.setIsMoving(!simulator.isMoving)}
                                                >
                                                    {simulator.isMoving ? 'ARRÊTER SIMULATION' : 'LANCER SIMULATION'}
                                                </Button>
                                                <Button variant="ghost" className="w-full h-10 text-[9px] font-black uppercase tracking-widest text-slate-400" onClick={simulator.stopSim}>
                                                    RÉTABLIR DONNÉES RÉELLES
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                              )}
                          </Tabs>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>
          </div>
      </div>
    </div>
  );
}
