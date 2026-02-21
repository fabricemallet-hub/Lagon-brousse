
'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useSimulator } from '@/logic/shared/useSimulator';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
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
  Copy,
  BatteryLow,
  BatteryMedium,
  History,
  MousePointer2,
  Undo2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn, getDistance } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { UserAccount, VesselStatus, SoundLibraryEntry, TechLogEntry, VesselPrefs } from '@/lib/types';
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
                            {statusLabel}
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
  
  const mapCore = useMapCore();
  const simulator = useSimulator();

  const handlePositionUpdate = useCallback((lat: number, lng: number, status: string) => {
    mapCore.updateBreadcrumbs(lat, lng, status);
    if (mapCore.isFollowMode && mapCore.googleMap) { mapCore.googleMap.panTo({ lat, lng }); }
  }, [mapCore.isFollowMode, mapCore.googleMap, mapCore.updateBreadcrumbs]);

  const handleStopCleanup = useCallback(() => { mapCore.clearBreadcrumbs(); }, [mapCore]);

  const emetteur = useEmetteur(handlePositionUpdate, handleStopCleanup, simulator);
  const recepteur = useRecepteur(emetteur.sharingId);
  const flotte = useFlotte(emetteur.sharingId, emetteur.vesselNickname);
  
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com', 'kledostyle@hotmail.com', 'kledostyle@outlook.com'];
    return masterEmails.includes(user.email?.toLowerCase() || '') || userProfile?.role === 'admin';
  }, [user, userProfile]);

  const [testMinutes, setTestTestMinutes] = useState('60');

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const ids = [...savedVesselIds];
    if (emetteur.isSharing && !ids.includes(emetteur.sharingId)) ids.push(emetteur.sharingId);
    if (ids.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, user, savedVesselIds, emetteur.isSharing, emetteur.sharingId]);

  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  useEffect(() => { if (followedVessels) recepteur.processVesselAlerts(followedVessels); }, [followedVessels, recepteur.processVesselAlerts]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasCenteredInitially = useRef(false);

  useEffect(() => {
    if (emetteur.currentPos && !hasCenteredInitially.current && mapCore.googleMap) {
        mapCore.handleRecenter(emetteur.currentPos);
        hasCenteredInitially.current = true;
    }
  }, [emetteur.currentPos, mapCore.googleMap, mapCore.handleRecenter]);

  const [isLedActive, setIsLedActive] = useState(false);
  useEffect(() => {
    if (emetteur.lastSyncTime > 0) {
      setIsLedActive(true);
      const timer = setTimeout(() => setIsLedActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emetteur.lastSyncTime]);

  const handleRecenter = () => {
    if (emetteur.currentPos) mapCore.handleRecenter(emetteur.currentPos);
    else toast({ description: "En attente de signal GPS..." });
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (simulator.isTeleportMode && e.latLng) {
        simulator.teleport(e.latLng.lat(), e.latLng.lng());
        toast({ title: "Position Sandbox injectée" });
    }
  };

  const activeAnchorVessel = useMemo(() => {
    if (mapCore.isCirclesHidden) return null;
    if (emetteur.isSharing && (emetteur.vesselStatus === 'stationary' || emetteur.vesselStatus === 'drifting') && emetteur.anchorPos) {
        return { id: emetteur.sharingId, status: emetteur.vesselStatus, anchorLocation: { latitude: emetteur.anchorPos.lat, longitude: emetteur.anchorPos.lng }, location: emetteur.currentPos ? { latitude: emetteur.currentPos.lat, longitude: emetteur.currentPos.lng } : null, mooringRadius: emetteur.mooringRadius };
    }
    if (!followedVessels) return null;
    return followedVessels.find(v => v.isSharing && v.anchorLocation);
  }, [followedVessels, emetteur.isSharing, emetteur.vesselStatus, emetteur.anchorPos, emetteur.currentPos, emetteur.sharingId, emetteur.mooringRadius, mapCore.isCirclesHidden]);

  const handleUpdateAlertConfig = (key: keyof VesselPrefs['alerts'], field: 'enabled' | 'sound' | 'loop', value: any) => {
    const currentAlerts = { ...recepteur.vesselPrefs.alerts };
    currentAlerts[key] = { ...currentAlerts[key], [field]: value };
    recepteur.updateLocalPrefs({ alerts: currentAlerts });
  };

  if (loadError) return <div className="p-4 text-destructive">Erreur chargement Google Maps.</div>;
  if (!isLoaded || isProfileLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="w-full space-y-4 pb-32 px-1 relative">
      {recepteur.isAlarmActive && (
        <Button className="fixed top-2 left-1/2 -translate-x-1/2 z-[10008] h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase shadow-2xl animate-bounce gap-3 px-8 rounded-full border-4 border-white transition-all active:scale-95" onClick={recepteur.stopAllAlarms}>
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
            <Button variant={mapCore.viewMode === 'alpha' ? 'default' : 'ghost'} size="sm" className="h-9 px-4 font-black uppercase text-[10px] rounded-xl transition-all" onClick={() => mapCore.setViewMode('alpha')}>Maps</Button>
            <Button variant={mapCore.viewMode === 'beta' ? 'default' : 'ghost'} size="sm" className="h-9 px-4 font-black uppercase text-[10px] rounded-xl transition-all" onClick={() => mapCore.setViewMode('beta')}>Météo</Button>
            <Button variant={mapCore.viewMode === 'gamma' ? 'default' : 'ghost'} size="sm" className="h-9 px-4 font-black uppercase text-[10px] rounded-xl transition-all" onClick={() => mapCore.setViewMode('gamma')}>Windy</Button>
        </div>

        <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={12} onLoad={mapCore.setGoogleMap} onDragStart={() => mapCore.setIsFollowMode(false)} onClick={handleMapClick} options={{ disableDefaultUI: true, mapTypeControl: false, mapTypeId: mapCore.viewMode === 'beta' ? 'hybrid' : 'satellite', gestureHandling: 'greedy' }}>
            {!emetteur.isTrajectoryHidden && mapCore.breadcrumbs.length > 1 && <Polyline path={mapCore.breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: '#3b82f6', strokeOpacity: 0.6, strokeWeight: 2, zIndex: 1 }} />}
            {activeAnchorVessel && activeAnchorVessel.anchorLocation && (
                <React.Fragment>
                    {activeAnchorVessel.location && <Polyline path={[{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }, { lat: activeAnchorVessel.location.latitude, lng: activeAnchorVessel.location.longitude }]} options={{ strokeColor: activeAnchorVessel.status === 'drifting' ? '#ef4444' : '#3b82f6', strokeOpacity: 0.8, strokeWeight: 2, zIndex: 2 }} />}
                    <OverlayView position={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg z-[800]"><Anchor className="size-3.5 text-white" /></div>
                    </OverlayView>
                    <Circle center={{ lat: activeAnchorVessel.anchorLocation.latitude, lng: activeAnchorVessel.anchorLocation.longitude }} radius={activeAnchorVessel.mooringRadius || 100} options={{ strokeColor: activeAnchorVessel.status === 'drifting' ? '#ef4444' : '#3b82f6', strokeOpacity: 0.8, strokeWeight: 3, fillColor: '#3b82f6', fillOpacity: 0.15, clickable: false, zIndex: 1 }} />
                </React.Fragment>
            )}
            {followedVessels?.filter(v => v.isSharing && v.location).map(vessel => <OverlayView key={vessel.id} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><VesselMarker vessel={vessel} /></OverlayView>)}
            {emetteur.isSharing && emetteur.currentPos && !followedVessels?.find(v => v.id === emetteur.sharingId && v.isSharing) && <OverlayView position={emetteur.currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><VesselMarker vessel={{ id: emetteur.sharingId, displayName: emetteur.vesselNickname || 'Moi', status: emetteur.vesselStatus, batteryLevel: Math.round(emetteur.battery?.level * 100), isCharging: emetteur.battery?.charging, isSharing: true, isGhostMode: emetteur.isGhostMode, lastActive: new Date() } as any} /></OverlayView>}
        </GoogleMap>
        
        <div className="absolute top-4 left-4 z-[9999] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>{mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
        </div>
        <div className="absolute top-4 right-4 z-[9999] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl transition-all", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}>{mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}</Button>
            <Button onClick={handleRecenter} className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white flex items-center justify-center"><LocateFixed className="size-5"/></Button>
        </div>

        {simulator.isTeleportMode && (
            <div className="absolute inset-0 z-[140] pointer-events-none border-4 border-primary animate-pulse flex items-center justify-center">
                <div className="bg-primary text-white px-6 py-2 rounded-full font-black uppercase text-xs shadow-2xl">
                    CLIQUEZ SUR LA CARTE POUR INJECTER LE GPS
                </div>
            </div>
        )}
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
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Capitaine : {emetteur.vesselNickname}</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <BatteryIconComp level={emetteur.battery?.level * 100} charging={emetteur.battery?.charging} className="size-5" />
                                  <div className={cn("size-3 rounded-full bg-green-500 shadow-sm transition-all", isLedActive ? "scale-125 glow" : "opacity-30")} />
                                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 font-black text-[8px] uppercase h-5">LIVE</Badge>
                              </div>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-2">
                                  <Button variant="outline" className={cn("h-14 font-black uppercase text-[10px] border-2 gap-2", emetteur.vesselStatus === 'returning' ? "bg-indigo-600 text-white border-indigo-700" : "bg-indigo-50 border-indigo-100 text-indigo-700")} onClick={() => emetteur.changeManualStatus('returning')}>Retour Maison</Button>
                                  <Button variant="outline" className={cn("h-14 font-black uppercase text-[10px] border-2 gap-2", emetteur.vesselStatus === 'landed' ? "bg-green-600 text-white border-green-700" : "bg-green-50 border-indigo-100 text-green-700")} onClick={() => emetteur.changeManualStatus('landed')}>À terre</Button>
                              </div>
                              <div className="p-4 bg-orange-50/30 border-2 border-orange-100 rounded-2xl space-y-4">
                                  <div className="flex items-center justify-between">
                                      <Button className={cn("h-12 px-6 font-black uppercase text-[10px] gap-2 shadow-lg", emetteur.anchorPos ? "bg-orange-600" : "bg-slate-200 text-slate-600")} onClick={() => emetteur.anchorPos ? emetteur.changeManualStatus('moving') : emetteur.changeManualStatus('stationary')}>
                                          <Anchor className="size-4" /> {emetteur.anchorPos ? "MOUILLAGE ACTIF" : "ACTIVER MOUILLAGE"}
                                      </Button>
                                      <div className="text-right">
                                          <p className="text-[10px] font-black uppercase text-orange-800">Rayon Dérive</p>
                                          <p className="text-lg font-black text-orange-950 leading-none">{emetteur.mooringRadius}m</p>
                                      </div>
                                  </div>
                                  <Slider value={[emetteur.mooringRadius]} min={10} max={200} step={10} onValueChange={(v) => emetteur.setMooringRadius(v[0])} />
                              </div>
                              <Button variant="destructive" className="w-full h-16 font-black uppercase text-xs tracking-widest shadow-xl rounded-2xl" onClick={emetteur.stopSharing}>ARRÊTER LE PARTAGE</Button>
                          </CardContent>
                      </Card>
                  ) : (
                      <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-primary/20">
                          <CardHeader className="bg-primary/5 p-5 border-b flex flex-row justify-between items-center">
                              <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary"><Navigation className="size-4" /> Identité & Partage</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 space-y-5">
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">Mon Surnom</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-12 border-2 font-black text-lg" /></div>
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID Navire</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ABC-123" className="h-12 border-2 font-black text-center uppercase" /></div>
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 text-indigo-600">ID Flotte</Label><Input value={emetteur.customFleetId} onChange={e => emetteur.setCustomFleetId(e.target.value)} placeholder="GROUPE" className="h-12 border-2 border-indigo-100 font-black text-center uppercase" /></div>
                              </div>
                              <Button className="w-full h-16 font-black uppercase text-base bg-primary rounded-2xl shadow-xl gap-3" onClick={emetteur.startSharing}><Zap className="size-5 fill-white" /> Lancer le Partage GPS</Button>
                          </CardContent>
                      </Card>
                  )}
              </div>
          )}

          {appMode === 'receiver' && (
              <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-blue-200">
                  <CardHeader className="bg-blue-50 p-5 border-b"><CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-blue-800"><Smartphone className="size-4" /> Récepteur B</CardTitle></CardHeader>
                  <CardContent className="p-5 space-y-4">
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID du Navire à suivre</Label>
                          <div className="flex gap-2">
                              <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-grow" />
                              <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={() => recepteur.initAudio()}>Suivre</Button>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          )}
      </div>

      <div id="cockpit-logs" className="fixed bottom-16 left-0 right-0 z-[10001] px-1 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
              {emetteur.isSharing && (
                  <div className="flex gap-2 mb-2 p-2 bg-slate-900/10 backdrop-blur-md rounded-2xl border-2 border-white/20">
                      <Button variant="destructive" className="flex-1 h-16 font-black uppercase text-xs border-2 shadow-2xl bg-red-700" onClick={() => emetteur.triggerEmergency('MAYDAY')}><ShieldAlert className="size-6 mr-2" /> MAYDAY</Button>
                      <Button variant="secondary" className="flex-1 h-16 font-black uppercase text-xs border-2 shadow-xl bg-orange-600 text-white" onClick={() => emetteur.triggerEmergency('PAN PAN')}><AlertTriangle className="size-5 mr-2" /> PAN PAN</Button>
                      <Button variant="outline" className="flex-1 h-16 font-black uppercase text-[10px] border-2 bg-white text-red-600 border-red-600 leading-tight" onClick={() => emetteur.triggerEmergency('ASSISTANCE')}>DEMANDE<br/>ASSISTANCE</Button>
                  </div>
              )}

              <Accordion type="single" collapsible className="bg-white/95 backdrop-blur-md rounded-t-[2.5rem] shadow-2xl border-x-2 border-t-2 overflow-hidden">
                  <AccordionItem value="logs" className="border-none">
                      <AccordionTrigger className="h-12 px-6 hover:no-underline">
                          <div className="flex items-center gap-3"><ClipboardList className="size-5 text-primary" /><span className="text-sm font-black uppercase tracking-tighter">Tableau de Bord Technique</span></div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                          <Tabs defaultValue="tactical" className="w-full">
                              <TabsList className={cn("grid h-12 bg-muted/20 border-y rounded-none", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
                                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase gap-2"><Fish className="size-3" /> Tactique</TabsTrigger>
                                  <TabsTrigger value="technical" className="text-[10px] font-black uppercase gap-2"><HistoryIcon className="size-3" /> Journal</TabsTrigger>
                                  <TabsTrigger value="settings" className="text-[10px] font-black uppercase gap-2"><Settings className="size-3" /> Réglages</TabsTrigger>
                                  {isAdmin && <TabsTrigger value="labo" className="text-[10px] font-black uppercase gap-2 text-primary"><TestTube2 className="size-3" /> Labo</TabsTrigger>}
                              </TabsList>
                              
                              <TabsContent value="tactical" className="m-0 bg-white p-4 space-y-4">
                                  <div className="grid grid-cols-4 gap-2">
                                      {TACTICAL_SPECIES.map(spec => (
                                          <Button key={spec.label} variant="outline" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 hover:bg-primary/5 active:scale-95" onClick={() => emetteur.addTacticalLog(spec.label)}>
                                              <spec.icon className="size-5 text-primary" />
                                              <span className="text-[8px] font-black">{spec.label}</span>
                                          </Button>
                                      ))}
                                      <Button variant="secondary" className="flex flex-col items-center justify-center h-16 rounded-xl border-2 border-primary/20" onClick={() => photoInputRef.current?.click()}><Camera className="size-5 text-primary" /><span className="text-[8px] font-black">PRISE</span></Button>
                                  </div>
                                  <ScrollArea className="h-48 border-t pt-2">
                                      <div className="space-y-1">
                                        {emetteur.tacticalLogs.map((log, i) => (
                                            <div key={i} className="p-3 border-b flex justify-between items-center text-[10px] cursor-pointer hover:bg-primary/5">
                                                <div className="flex items-center gap-3"><div className="p-1.5 bg-primary/10 rounded-lg"><Fish className="size-3 text-primary"/></div><span className="font-black uppercase text-primary">{log.type}</span></div>
                                                <div className="flex items-center gap-3"><span className="font-bold opacity-40">{format(log.time, 'HH:mm')}</span><Copy className="size-3 opacity-20" /></div>
                                            </div>
                                        ))}
                                      </div>
                                  </ScrollArea>
                              </TabsContent>

                              <TabsContent value="technical" className="m-0 bg-slate-50/50 p-4">
                                  <ScrollArea className="h-48 shadow-inner">
                                      <div className="space-y-2">
                                          <div className="p-2 border rounded-lg bg-green-50 text-[10px] font-black uppercase text-green-700">Système v79.0 prêt</div>
                                          {emetteur.techLogs.map((log, i) => (
                                              <div key={i} className={cn("p-3 border rounded-xl bg-white flex flex-col gap-2 shadow-sm border-slate-100", (log.label.includes('URGENCE') || log.label.includes('ÉNERGIE') || log.label === 'DÉRIVE' || log.label === 'SANDBOX' || log.label === 'LABO') && 'border-red-200 bg-red-50')}>
                                                  <div className="flex justify-between items-start">
                                                      <div className="flex flex-col gap-0.5">
                                                          <span className={cn("font-black uppercase text-[10px]", (log.label.includes('ÉNERGIE') || log.label.includes('URGENCE') || log.label === 'DÉRIVE' || log.label === 'SANDBOX' || log.label === 'LABO') ? 'text-red-600' : 'text-slate-800')}>
                                                              {log.label} {log.durationMinutes > 0 ? `(${log.durationMinutes} min)` : ''}
                                                              <span className={cn("ml-1", 
                                                                  log.status === 'moving' ? "text-blue-600" :
                                                                  log.status === 'stationary' ? "text-orange-600" :
                                                                  log.status === 'returning' ? "text-indigo-600" :
                                                                  log.status === 'landed' ? "text-green-600" : "text-red-600"
                                                              )}>
                                                                  - {log.status.toUpperCase()}
                                                              </span>
                                                          </span>
                                                          <span className="text-[8px] opacity-40 font-bold uppercase">{format(log.time, 'HH:mm:ss')}</span>
                                                      </div>
                                                      <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 border">
                                                          <Battery className={cn("size-2.5", log.batteryLevel !== undefined && log.batteryLevel < 20 ? "text-red-500" : "text-green-600")} />
                                                          {log.batteryLevel}%
                                                      </div>
                                                  </div>
                                                  <div className="flex items-center justify-between border-t border-dashed pt-1.5">
                                                      <span className="text-[8px] font-bold text-muted-foreground uppercase truncate flex-1">{log.details}</span>
                                                      {log.accuracy !== undefined && <Badge variant="outline" className="text-[7px] h-3.5 font-black uppercase bg-white">Prec: +/-{log.accuracy}m</Badge>}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </ScrollArea>
                              </TabsContent>

                              <TabsContent value="settings" className="m-0 bg-white p-4 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-hide">
                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-slate-900 text-white shadow-xl">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2"><Ghost className="size-3" /> Confidentialité Tactique</p>
                                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                                          <div className="space-y-0.5"><Label className="text-xs font-black uppercase">Mode Fantôme</Label><p className="text-[8px] font-bold text-slate-400 uppercase">Invisible pour la Flotte C</p></div>
                                          <Switch checked={emetteur.isGhostMode} onCheckedChange={emetteur.toggleGhostMode} />
                                      </div>
                                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                                          <div className="space-y-0.5"><Label className="text-xs font-black uppercase">Masquer Tracé</Label><p className="text-[8px] font-bold text-slate-400 uppercase">Cache la ligne bleue</p></div>
                                          <Switch checked={emetteur.isTrajectoryHidden} onCheckedChange={emetteur.toggleTrajectoryHidden} />
                                      </div>
                                      <Button variant="outline" className="w-full h-12 font-black uppercase text-[10px] border-2 bg-white text-slate-900 mt-2 gap-2" onClick={emetteur.resetTrajectory}><HistoryIcon className="size-4" /> RESET TRAJECTOIRE</Button>
                                  </div>

                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-muted/10">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2"><Volume2 className="size-3" /> Pilotage Global & Sons</p>
                                      <div className="flex items-center justify-between">
                                          <Label className="text-xs font-black uppercase">Alertes Sonores</Label>
                                          <Switch checked={recepteur.vesselPrefs.isNotifyEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isNotifyEnabled: v })} />
                                      </div>
                                      <div className="space-y-3">
                                          <Label className="text-[10px] font-black uppercase opacity-60">Volume global ({Math.round(recepteur.vesselPrefs.volume * 100)}%)</Label>
                                          <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} onValueChange={v => recepteur.updateLocalPrefs({ volume: v[0] / 100 })} />
                                      </div>
                                  </div>

                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-orange-50/30 border-orange-100">
                                      <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase text-orange-800 flex items-center gap-2"><Timer className="size-3" /> Veille Stratégique</Label><Switch checked={recepteur.vesselPrefs.isWatchEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isWatchEnabled: v })} /></div>
                                      <div className={cn("space-y-4", !recepteur.vesselPrefs.isWatchEnabled && "opacity-40")}>
                                          <div className="space-y-2">
                                              <div className="flex justify-between text-[9px] font-black uppercase"><span>Alerte après :</span><span>{recepteur.vesselPrefs.watchDuration >= 60 ? `${Math.floor(recepteur.vesselPrefs.watchDuration / 60)}h` : `${recepteur.vesselPrefs.watchDuration} min`}</span></div>
                                              <Slider value={[recepteur.vesselPrefs.watchDuration]} min={10} max={1440} step={10} onValueChange={v => recepteur.updateLocalPrefs({ watchDuration: v[0] })} />
                                          </div>
                                          <div className="flex items-center justify-between gap-2">
                                              <span className="text-[9px] font-black uppercase opacity-60">Son :</span>
                                              <Select value={recepteur.vesselPrefs.watchSound} onValueChange={v => recepteur.updateLocalPrefs({ watchSound: v })}>
                                                  <SelectTrigger className="h-8 text-[9px] font-black uppercase w-32 bg-white"><SelectValue /></SelectTrigger>
                                                  <SelectContent>{recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                                              </Select>
                                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => recepteur.initAudio() || recepteur.availableSounds.find(s => s.id === recepteur.vesselPrefs.watchSound || s.label === recepteur.vesselPrefs.watchSound) && new Audio(recepteur.availableSounds.find(s => s.id === recepteur.vesselPrefs.watchSound || s.label === recepteur.vesselPrefs.watchSound)!.url).play()}><Play className="size-3" /></Button>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-red-50/30 border-red-100">
                                      <p className="text-[10px] font-black uppercase text-red-800 flex items-center gap-2"><Battery className="size-3" /> Seuil Batterie Faible</p>
                                      <div className="space-y-2">
                                          <div className="flex justify-between text-[9px] font-black uppercase"><span>Alerte à :</span><span>{recepteur.vesselPrefs.batteryThreshold}%</span></div>
                                          <Slider value={[recepteur.vesselPrefs.batteryThreshold]} min={5} max={50} step={5} onValueChange={v => recepteur.updateLocalPrefs({ batteryThreshold: v[0] })} />
                                      </div>
                                  </div>

                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-slate-50">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Réglages Individuels (Status)</p>
                                      <div className="grid gap-4">
                                          {[
                                              { id: 'moving', label: 'MOUVEMENT' },
                                              { id: 'stationary', label: 'MOUILLAGE' },
                                              { id: 'drifting', label: 'DÉRIVE' },
                                              { id: 'offline', label: 'SIGNAL PERDU' },
                                              { id: 'assistance', label: 'ASSISTANCE' },
                                              { id: 'tactical', label: 'SIGNAL TACTIQUE' },
                                              { id: 'battery', label: 'BATTERIE FAIBLE' }
                                          ].map(alert => {
                                              const config = recepteur.vesselPrefs.alerts[alert.id as keyof VesselPrefs['alerts']];
                                              return (
                                                  <div key={alert.id} className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
                                                      <div className="flex items-center justify-between">
                                                          <span className="text-[10px] font-black uppercase">{alert.label}</span>
                                                          <Switch checked={config.enabled} onCheckedChange={v => handleUpdateAlertConfig(alert.id as any, 'enabled', v)} />
                                                      </div>
                                                      <div className={cn("flex items-center gap-2", !config.enabled && "opacity-40 pointer-events-none")}>
                                                          <Select value={config.sound} onValueChange={v => handleUpdateAlertConfig(alert.id as any, 'sound', v)}>
                                                              <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-1 bg-white"><SelectValue /></SelectTrigger>
                                                              <SelectContent>{recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}</SelectContent>
                                                          </Select>
                                                          <div className="flex items-center gap-1 bg-white border rounded px-1.5 h-8">
                                                              <span className="text-[8px] font-bold">LOOP</span>
                                                              <Switch checked={config.loop} onCheckedChange={v => handleUpdateAlertConfig(alert.id as any, 'loop', v)} className="scale-75" />
                                                          </div>
                                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                              const sound = recepteur.availableSounds.find(s => s.id === config.sound || s.label === config.sound);
                                                              if (sound) new Audio(sound.url).play();
                                                          }}><Play className="size-3" /></Button>
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>

                                  <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl rounded-2xl bg-primary text-white gap-2" onClick={recepteur.savePrefsToFirestore}>
                                      {recepteur.isSaving ? <RefreshCw className="size-5 animate-spin" /> : <Save className="size-5" />} 
                                      ENREGISTRER ET VALIDER
                                  </Button>
                              </TabsContent>

                              {isAdmin && (
                                <TabsContent value="labo" className="m-0 bg-white p-4 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-hide">
                                    <div className="space-y-4 p-4 border-2 border-dashed border-red-200 rounded-3xl bg-red-50/30">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-2"><Zap className="size-3" /> Sandbox Tactique</p>
                                            <Switch checked={simulator.isActive} onCheckedChange={simulator.setIsActive} />
                                        </div>
                                        
                                        <div className={cn("space-y-4", !simulator.isActive && "opacity-40 pointer-events-none")}>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant={simulator.isTeleportMode ? "default" : "outline"} className="h-12 text-[10px] font-black uppercase gap-2 border-2" onClick={() => simulator.setIsTeleportMode(!simulator.isTeleportMode)}>
                                                    <MousePointer2 className="size-4" /> Injection Clic
                                                </Button>
                                                <Button variant="outline" className="h-12 text-[10px] font-black uppercase gap-2 border-2" onClick={() => simulator.forceDrift(emetteur.anchorPos, emetteur.mooringRadius)}>
                                                    <Move className="size-4" /> Forcer Dérive
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[9px] font-black uppercase">
                                                    <span>Vitesse Simulée</span>
                                                    <span className="text-red-600">{simulator.simSpeed} ND</span>
                                                </div>
                                                <Slider value={[simulator.simSpeed]} max={30} step={1} onValueChange={v => simulator.setSimSpeed(v[0])} />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[9px] font-black uppercase">
                                                    <span>Batterie Simulée</span>
                                                    <span className="text-red-600">{simulator.simBattery}%</span>
                                                </div>
                                                <Slider value={[simulator.simBattery]} min={1} max={100} step={1} onValueChange={v => simulator.setSimBattery(v[0])} />
                                            </div>

                                            <div className="flex items-center justify-between p-2 bg-white rounded-xl border">
                                                <div className="space-y-0.5"><Label className="text-[10px] font-black uppercase">Perte de Signal</Label><p className="text-[8px] font-bold text-muted-foreground uppercase">Couper updates Firestore</p></div>
                                                <Switch checked={simulator.isComCut} onCheckedChange={simulator.setIsComCut} />
                                            </div>

                                            <div className="space-y-2 border-t pt-3">
                                                <Label className="text-[9px] font-black uppercase opacity-60">Avancer le temps (min)</Label>
                                                <div className="flex gap-2">
                                                    <Input type="number" value={testMinutes} onChange={e => setTestTestMinutes(e.target.value)} className="h-10 border-2 font-black text-center" />
                                                    <Button className="h-10 font-black uppercase text-[10px] gap-2" onClick={() => emetteur.forceTimeOffset(parseInt(testMinutes))}>Injecter</Button>
                                                </div>
                                            </div>
                                        </div>

                                        <Button variant="outline" className="w-full h-12 font-black uppercase text-[10px] border-2 bg-white gap-2" onClick={() => { simulator.stopSim(); emetteur.resetTrajectory(); }}>
                                            <Undo2 className="size-4" /> Rétablir GPS Réel
                                        </Button>
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
