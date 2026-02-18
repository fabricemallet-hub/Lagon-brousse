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
  History,
  ChevronDown
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

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

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.filter(s => 
      !s.categories || s.categories.includes('Vessel') || s.categories.includes('General')
    ).map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    console.log(`[Tracker] Envoi des données vers Firestore pour l'ID: ${sharingId}`, data);

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

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true })
            .then(() => console.log(`[Tracker] Mise à jour Firestore réussie pour ${sharingId}`))
            .catch((err) => console.error(`[Tracker] Erreur Firestore pour ${sharingId}:`, err));
        
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

  const handleAddTacticalMarker = (type: string) => {
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
      if (watchIdRef.current !== null) { 
        navigator.geolocation.clearWatch(watchIdRef.current); 
        watchIdRef.current = null; 
      }
      return;
    }

    console.log(`[Tracker] Lancement de watchPosition pour l'émetteur: ${sharingId}`);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        
        console.log(`[Tracker] GPS Fix reçu : Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (Précision: ${accuracy.toFixed(1)}m)`);

        if (accuracy > 500) {
            console.warn("[Tracker] Précision GPS insuffisante (>500m), point ignoré.");
            return;
        }

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
      (err) => {
          console.error("[Tracker] Erreur Géolocalisation:", err.message);
          toast({ variant: "destructive", title: "Erreur GPS", description: err.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, isFollowing, map, updateVesselInFirestore, sharingId, toast]);

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

  const handleSavePreferences = () => {
    if (!user || !firestore) return;
    updateDoc(doc(firestore, 'users', user.uid), {
        vesselNickname,
        emergencyContact,
        vesselSmsMessage,
        lastVesselId: customSharingId
    }).then(() => toast({ title: "Réglages enregistrés" }));
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
                    <div className="space-y-0.5">
                        <Label className="text-sm font-black uppercase">Lancer le partage</Label>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p>
                    </div>
                    <Switch checked={isSharing} onCheckedChange={val => { if(val) setIsSharing(true); else handleStopSharing(); }} />
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    {/* STATUT HEADER */}
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white", vesselStatus === 'landed' ? "bg-green-600" : "bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6">EN LIGNE</Badge>
                            <Badge variant="outline" className="bg-white/10 text-white text-[9px] px-2 h-5">SYNC: {nextSyncSeconds}S</Badge>
                        </div>
                    </div>

                    {/* SIGNALISATION MANUELLE */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2">
                            <Zap className="size-3" /> Signalisation Manuelle
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-slate-50 gap-2" onClick={() => handleManualStatusToggle('returning', 'RETOUR MAISON')}>
                                <Navigation className="size-4 text-blue-600" /> RETOUR MAISON
                            </Button>
                            <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-slate-50 gap-2" onClick={() => handleManualStatusToggle('landed', 'HOME (À TERRE)')}>
                                <Home className="size-4 text-green-600" /> HOME (À TERRE)
                            </Button>
                        </div>
                    </div>

                    {/* SIGNALEMENT TACTIQUE */}
                    <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed space-y-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-1">
                            <Compass className="size-3" /> Signalement Tactique (Flotte)
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                            <Button variant="outline" className="h-12 border-2 bg-white flex flex-col items-center justify-center p-0 gap-1 group" onClick={() => handleAddTacticalMarker('OISEAUX')}>
                                <Bird className="size-4 text-blue-500" />
                                <span className="text-[7px] font-black uppercase text-blue-600">Oiseaux</span>
                            </Button>
                            <Button variant="outline" className="h-12 border-2 bg-blue-900 flex flex-col items-center justify-center p-0 gap-1" onClick={() => handleAddTacticalMarker('MARLIN')}>
                                <Fish className="size-4 text-white" />
                                <span className="text-[7px] font-black uppercase text-white">Marlin</span>
                            </Button>
                            <Button variant="outline" className="h-12 border-2 bg-red-600 flex flex-col items-center justify-center p-0 gap-1" onClick={() => handleAddTacticalMarker('THON')}>
                                <Fish className="size-4 text-white" />
                                <span className="text-[7px] font-black uppercase text-white">Thon</span>
                            </Button>
                            <Button variant="outline" className="h-12 border-2 bg-slate-600 flex flex-col items-center justify-center p-0 gap-1" onClick={() => handleAddTacticalMarker('TAZARD')}>
                                <Fish className="size-4 text-white" />
                                <span className="text-[7px] font-black uppercase text-white">Tazard</span>
                            </Button>
                            <Button variant="outline" className="h-12 border-2 bg-cyan-600 flex flex-col items-center justify-center p-0 gap-1" onClick={() => handleAddTacticalMarker('WAHOO')}>
                                <Fish className="size-4 text-white" />
                                <span className="text-[7px] font-black uppercase text-white">Wahoo</span>
                            </Button>
                            <Button variant="outline" className="h-12 border-2 bg-yellow-500 flex flex-col items-center justify-center p-0 gap-1" onClick={() => handleAddTacticalMarker('BOSSU')}>
                                <Fish className="size-4 text-white" />
                                <span className="text-[7px] font-black uppercase text-white">Bossu</span>
                            </Button>
                            <Button variant="outline" className="h-12 border-2 bg-orange-500 flex flex-col items-center justify-center p-0 gap-1" onClick={() => handleAddTacticalMarker('BEC DE CANE')}>
                                <Fish className="size-4 text-white" />
                                <span className="text-[7px] font-black uppercase text-white leading-none text-center">Bec de cane</span>
                            </Button>
                        </div>
                        <Button variant="ghost" className="w-full h-8 text-[8px] font-black uppercase text-destructive" onClick={handleClearTactical}>Effacer le journal tactique</Button>
                    </div>

                    <Button variant="destructive" className="w-full h-14 font-black uppercase shadow-lg gap-3" onClick={() => sendEmergencySms('MAYDAY')}>
                        <ShieldAlert className="size-6" /> DEMANDE D'ASSISTANCE
                    </Button>

                    <Button variant="destructive" className="w-full h-14 font-black uppercase opacity-80 gap-3 border-2 border-white/20" onClick={handleStopSharing}>
                        <X className="size-6" /> Arrêter le partage / Quitter
                    </Button>

                    {/* ACCORDEONS REGLAGES */}
                    <Accordion type="single" collapsible className="w-full space-y-2">
                        <AccordionItem value="identity" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl h-12">
                                <Settings className="size-4 text-primary" />
                                <span className="text-[10px] font-black uppercase text-slate-700">Identité & Ids</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-2 rounded-xl mt-1 border-slate-100">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Mon Surnom</Label>
                                    <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="Capitaine..." className="h-11 border-2 font-bold uppercase" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID du navire</Label>
                                    <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="BATEAU-1" className="h-11 border-2 font-mono uppercase" />
                                </div>
                                <Button className="w-full h-10 font-black uppercase text-[10px]" onClick={handleSavePreferences}>Sauvegarder</Button>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="emergency" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl h-12">
                                <Smartphone className="size-4 text-orange-600" />
                                <span className="text-[10px] font-black uppercase text-slate-700">Réglages d'Urgence (SMS)</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-2 rounded-xl mt-1 border-slate-100">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Numéro du contact à terre</Label>
                                    <Input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="77 12 34" className="h-11 border-2 font-black text-lg" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-60 ml-1">Message personnalisé</Label>
                                    <Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} placeholder="SOS moteur en panne..." className="border-2 min-h-[80px]" />
                                </div>
                                <Button className="w-full h-10 font-black uppercase text-[10px]" onClick={handleSavePreferences}>Sauvegarder</Button>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="sounds" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/50 rounded-xl h-12">
                                <Volume2 className="size-4 text-blue-600" />
                                <span className="text-[10px] font-black uppercase text-slate-700">Notifications & Sons</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-2 rounded-xl mt-1 border-slate-100">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-black uppercase">Sons Actifs</Label>
                                    <Switch checked={true} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase opacity-60">Volume</Label>
                                    <Slider value={[80]} max={100} step={1} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
              )}
            </div>
          )}

          {(mode === 'receiver' || mode === 'fleet') && (
            <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Navires actifs sur la carte</p>
                <div className="grid gap-2">
                    {followedVessels?.filter(v => v.isSharing && v.location).map(v => (
                        <div key={v.id} className="p-3 border-2 rounded-xl flex items-center justify-between bg-card shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", v.status === 'landed' ? "bg-green-600" : "bg-primary")}>
                                    <Navigation className="size-4 text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black uppercase text-xs">{v.displayName || v.id}</span>
                                    <span className="text-[8px] font-black uppercase opacity-40">{v.status === 'moving' ? 'En mouvement' : 'Immobile'}</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { if(v.location) { map?.panTo({ lat: v.location.latitude, lng: v.location.longitude }); map?.setZoom(15); } }}>
                                <MapPin className="size-4" />
                            </Button>
                        </div>
                    ))}
                    {(!followedVessels || followedVessels.filter(v => v.isSharing).length === 0) && (
                        <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-30">
                            <WifiOff className="size-8 mx-auto mb-2" />
                            <p className="text-[9px] font-black uppercase">Aucun navire en ligne</p>
                        </div>
                    )}
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div 
            className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[450px]")}
            style={{ minHeight: isFullscreen ? '100dvh' : '450px' }}
        >
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
                      const lastActiveMillis = vessel.lastActive?.toMillis?.() || Date.now();
                      const isOffline = (Date.now() - lastActiveMillis > 70000);
                      const statusInfo = getVesselIconInfo(isOffline ? 'offline' : vessel.status);
                      
                      return (
                          <React.Fragment key={`group-${vessel.id}`}>
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
                <p className="text-xs font-black uppercase text-center">Chargement de la carte...</p>
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
