'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, where, deleteDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
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
  MapPin,
  X,
  Play,
  Volume2,
  Check,
  Trash2,
  RefreshCw,
  Settings,
  Smartphone,
  Home,
  Compass,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Users,
  Bird,
  Fish,
  Waves,
  Camera,
  MessageSquare,
  Phone,
  Ship,
  AlertCircle,
  Eye,
  EyeOff,
  History
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)', zIndex: 50 }}>
      <div className="size-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative shadow-lg"></div>
    </div>
);

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  
  const [customSharingId, setCustomSharingId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'offline'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [nextSyncSeconds, setNextSyncSeconds] = useState(60);

  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  const [vesselPrefs, setVesselPrefs] = useState<any>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, assistance: true, tactical: true, battery: true },
    notifySounds: { moving: '', stationary: '', offline: '', assistance: '', tactical: '', battery: '' },
    notifyLoops: { moving: false, stationary: false, offline: false, assistance: true, tactical: true, battery: false },
    batteryThreshold: 20
  });

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const watchIdRef = useRef<number | null>(null);
  const lastSentPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const shouldPanOnNextFix = useRef<boolean>(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    const update = async () => {
        let batteryInfo: any = {};
        if ('getBattery' in navigator) {
            try {
                const b: any = await (navigator as any).getBattery();
                batteryInfo.batteryLevel = Math.round(b.level * 100);
                batteryInfo.isCharging = b.charging;
            } catch (e) {}
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            isGhostMode: data.isGhostMode !== undefined ? data.isGhostMode : isGhostMode,
            lastActive: serverTimestamp(),
            mooringRadius: mooringRadius,
            ...batteryInfo,
            ...data 
        };
        
        if (anchorPos && (vesselStatus === 'stationary' || vesselStatus === 'drifting')) {
            updatePayload.anchorLocation = { latitude: anchorPos.lat, longitude: anchorPos.lng };
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
        setNextSyncSeconds(60);
    };
    update();
  }, [user, firestore, isSharing, isGhostMode, sharingId, vesselNickname, mooringRadius, anchorPos, vesselStatus]);

  const handleRecenter = useCallback(() => {
    setIsFollowing(true);
    let target: { lat: number; lng: number } | null = null;
    if (mode === 'sender' && currentPos) {
      target = currentPos;
    } else if (mode === 'receiver' || mode === 'fleet') {
      const activeVessel = followedVessels?.find(v => v.isSharing && v.location);
      if (activeVessel?.location) {
        target = { lat: activeVessel.location.latitude, lng: activeVessel.location.longitude };
      }
    }
    if (target && map) {
      map.panTo(target);
      map.setZoom(15);
    } else {
      shouldPanOnNextFix.current = true;
    }
  }, [mode, currentPos, followedVessels, map]);

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setCurrentPos(null); setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatusToggle = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    const updates: any = { status: st, eventLabel: label };
    if (st === 'emergency') updates.isGhostMode = false;
    
    if (st === 'stationary' && currentPos) {
        setAnchorPos(currentPos);
        updates.anchorLocation = { latitude: currentPos.lat, longitude: currentPos.lng };
    }
    
    if (st === 'moving') {
        setAnchorPos(null);
        updates.anchorLocation = null;
    }

    updateVesselInFirestore(updates);
    toast({ title: label });
  };

  const handleAddTacticalMarker = (type: string, icon: any) => {
    if (!currentPos || !firestore) return;
    const marker: HuntingMarker = {
        id: Math.random().toString(36).substring(7),
        lat: currentPos.lat,
        lng: currentPos.lng,
        time: format(new Date(), 'HH:mm'),
        label: type
    };
    updateVesselInFirestore({ huntingMarkers: arrayUnion(marker) });
    toast({ title: `${type} signalé !`, description: "Point GPS enregistré." });
  };

  const handleClearTactical = () => {
    updateVesselInFirestore({ huntingMarkers: [] });
    toast({ title: "Journal tactique effacé" });
  };

  const sendEmergencySms = (type: 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Contact requis" }); return; }
    const pos = currentPos || INITIAL_CENTER;
    const posUrl = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const name = vesselNickname || sharingId;
    const body = `[LB-NC] ${type} : ${name}. ${vesselSmsMessage || "Assistance requise."}. Carte : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        if (accuracy > 30) return;

        const lastSent = lastSentPosRef.current;
        const distMoved = lastSent ? getDistance(latitude, longitude, lastSent.lat, lastSent.lng) : 100;

        setCurrentPos(newPos);

        if (distMoved >= 10) {
            updateVesselInFirestore({ location: { latitude, longitude }, accuracy: Math.round(accuracy) });
            lastSentPosRef.current = newPos;
        }

        if (isFollowing && map) map.panTo(newPos);
        if (shouldPanOnNextFix.current && map) {
            map.panTo(newPos);
            map.setZoom(16);
            shouldPanOnNextFix.current = false;
        }
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore]);

  const getVesselIconInfo = (status: string) => {
    switch (status) {
        case 'moving': return { icon: Navigation, color: 'bg-blue-600', label: 'MOUV' };
        case 'stationary': return { icon: Anchor, color: 'bg-orange-500', label: 'MOUIL' };
        case 'returning': return { icon: Ship, color: 'bg-indigo-600', label: 'RETOUR' };
        case 'landed': return { icon: Home, color: 'bg-green-600', label: 'HOME' };
        case 'emergency': return { icon: ShieldAlert, color: 'bg-red-600', label: 'SOS' };
        case 'offline': return { icon: WifiOff, color: 'bg-red-600', label: 'OFF' };
        default: return { icon: Navigation, color: 'bg-slate-600', label: '???' };
    }
  };

  if (isProfileLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('fleet')}>Flotte (C)</Button>
        </div>

        <CardContent className="p-4 space-y-4">
          {mode === 'sender' && (
            <div className="space-y-6">
              {!isSharing ? (
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                    <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Lancer le partage</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                    <Switch checked={isSharing} onCheckedChange={val => { if(val) setIsSharing(true); else handleStopSharing(); }} />
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white transition-colors duration-500", 
                        vesselStatus === 'offline' ? "bg-red-600 animate-pulse" : 
                        vesselStatus === 'emergency' ? "bg-red-600" :
                        vesselStatus === 'landed' ? "bg-green-600" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <Badge variant="outline" className="bg-white/10 text-white text-[9px] px-2 h-5 cursor-pointer">SYNC: {nextSyncSeconds}S</Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant={vesselStatus === 'returning' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 gap-2" onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}>
                            <Navigation className="size-4" /> RETOUR MAISON
                        </Button>
                        <Button variant={vesselStatus === 'landed' ? 'default' : 'outline'} className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => handleManualStatusToggle('landed', 'À TERRE (HOME)')}>
                            <Home className="size-4" /> HOME (À TERRE)
                        </Button>
                    </div>

                    <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-1"><Zap className="size-3" /> Signalement Tactique</p>
                        <div className="grid grid-cols-4 gap-2">
                            <Button variant="outline" size="icon" className="h-12 w-full border-2 bg-white" onClick={() => handleAddTacticalMarker('OISEAUX', Bird)}><Bird className="size-5 text-sky-500" /></Button>
                            <Button variant="outline" size="icon" className="h-12 w-full border-2 bg-white" onClick={() => handleAddTacticalMarker('MARLIN/THON', Fish)}><Fish className="size-5 text-blue-600" /></Button>
                            <Button variant="outline" size="icon" className="h-12 w-full border-2 bg-white" onClick={() => handleAddTacticalMarker('SARDINES', Waves)}><Waves className="size-5 text-cyan-400" /></Button>
                            <Button variant="outline" size="icon" className="h-12 w-full border-2 bg-white" onClick={() => handleAddTacticalMarker('PRISE', Camera)}><Camera className="size-5 text-orange-500" /></Button>
                        </div>
                        <Button variant="ghost" className="w-full h-8 text-[8px] font-black uppercase text-destructive" onClick={handleClearTactical}>Effacer le journal tactique</Button>
                    </div>

                    <Button variant="destructive" className="w-full h-14 font-black uppercase opacity-90 gap-3" onClick={handleStopSharing}>
                        <X className="size-6" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              )}
            </div>
          )}

          {(mode === 'receiver' || mode === 'fleet') && (
            <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Navires suivis</p>
                <div className="grid gap-2">
                    {followedVessels?.filter(v => v.isSharing && v.id !== sharingId).map(v => (
                        <div key={v.id} className="p-3 border-2 rounded-xl flex items-center justify-between bg-card">
                            <div className="flex items-center gap-3">
                                <Navigation className="size-4 text-primary" />
                                <span className="font-black uppercase text-xs">{v.displayName || v.id}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if(v.location) { map?.panTo({ lat: v.location.latitude, lng: v.location.longitude }); map?.setZoom(15); } }}><MapPin className="size-4 text-primary" /></Button>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")}>
          {isLoaded ? (
            <GoogleMap 
              mapContainerStyle={{ width: '100%', height: '100%' }}
              defaultCenter={INITIAL_CENTER} 
              defaultZoom={10} 
              onLoad={setMap} 
              onDragStart={() => setIsFollowing(false)} 
              options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
            >
                  {followedVessels?.filter(v => v.isSharing && v.location).map(vessel => {
                      const isOffline = (Date.now() - (vessel.lastActive?.toMillis?.() || 0) > 70000);
                      const statusInfo = getVesselIconInfo(isOffline ? 'offline' : vessel.status);
                      
                      return (
                          <React.Fragment key={`group-${vessel.id}`}>
                              {vessel.anchorLocation && (vessel.status === 'stationary' || vessel.status === 'drifting') && (
                                  <>
                                      <OverlayView position={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                          <div style={{ transform: 'translate(-50%, -50%)' }} className="p-1.5 rounded-full border-2 border-white bg-orange-500 shadow-xl z-10">
                                              <Anchor className="size-4 text-white" />
                                          </div>
                                      </OverlayView>
                                      <Circle
                                          center={{ lat: vessel.anchorLocation.latitude, lng: vessel.anchorLocation.longitude }}
                                          radius={vessel.mooringRadius || 20}
                                          options={{
                                              fillColor: '#3b82f6',
                                              fillOpacity: 0.15,
                                              strokeColor: '#3b82f6',
                                              strokeWeight: 1,
                                              clickable: false,
                                              zIndex: 5
                                          }}
                                      />
                                  </>
                              )}
                              <OverlayView position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                  <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1 z-20">
                                      <div className="px-2 py-1 bg-slate-900/80 backdrop-blur-sm text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2">
                                          <span>{vessel.displayName}</span>
                                      </div>
                                      <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", statusInfo.color)}>
                                          {React.createElement(statusInfo.icon, { className: "size-5 text-white" })}
                                      </div>
                                  </div>
                              </OverlayView>
                              {vessel.huntingMarkers?.map(m => (
                                <OverlayView key={m.id} position={{ lat: m.lat, lng: m.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                    <div style={{ transform: 'translate(-50%, -50%)' }} className="flex flex-col items-center">
                                        <div className="bg-white/90 border-2 rounded px-1.5 py-0.5 text-[7px] font-black shadow-lg mb-0.5 uppercase">{m.label}</div>
                                        <div className="size-2 rounded-full bg-white ring-2 ring-primary animate-pulse" />
                                    </div>
                                </OverlayView>
                              ))}
                          </React.Fragment>
                      );
                  })}

                  {mode === 'sender' && currentPos && (
                      <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                          <PulsingDot />
                      </OverlayView>
                  )}
            </GoogleMap>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-slate-100 text-muted-foreground gap-4">
                <AlertCircle className="size-12 opacity-20" />
                <p className="text-xs font-black uppercase">Service Google Maps en attente...</p>
            </div>
          )}
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className={cn("shadow-lg h-10 w-10 p-0 border-2", isFollowing ? "bg-primary text-white border-primary" : "bg-background/90 backdrop-blur-md text-primary")}><Compass className={cn("size-5", isFollowing && "fill-white")} /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="grid grid-cols-2 gap-2">
                <Button variant="destructive" className="h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}>
                    <ShieldAlert className="size-5" /> SOS / MAYDAY
                </Button>
                <Button variant="secondary" className="h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}>
                    <AlertTriangle className="size-5 text-primary" /> PAN PAN
                </Button>
            </div>
        </div>
      </Card>
    </div>
  );
}
