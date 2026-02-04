'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, updateDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { 
  Navigation, 
  Anchor, 
  Copy, 
  LocateFixed, 
  ShieldAlert,
  Save,
  Zap,
  Bell,
  BellOff,
  Play,
  Trash2,
  Plus,
  Loader2,
  Map as MapIcon,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

// Constants
const IMMOBILITY_THRESHOLD_METERS = 15;
const IMMOBILITY_START_MINUTES = 5;
const THROTTLE_UPDATE_MS = 10000; 

const defaultVesselSounds = [
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'sonar', label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3' },
];

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; 
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function VesselTracker() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselHistory, setVesselHistory] = useState<string[]>([]);

  // Sound settings
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [vesselVolume, setVesselVolume] = useState(0.8);
  const [notifySettings, setNotifySettings] = useState({ moving: true, stationary: true, offline: true });
  const [notifySounds, setNotifySounds] = useState({ moving: 'cloche', stationary: 'sonar', offline: 'alerte' });
  const prevVesselStatusRef = useRef<string | null>(null);

  // Watch settings
  const [isWatchEnabled, setIsWatchEnabled] = useState(false);
  const [watchType, setWatchType] = useState<'moving' | 'stationary' | 'offline'>('stationary');
  const [watchDuration, setWatchDuration] = useState(15);
  const [watchSound, setWatchSound] = useState('alerte');
  const [isWatchAlerting, setIsWatchAlerting] = useState(false);
  const [statusStartTime, setStatusStartTime] = useState<number | null>(null);
  const watchRepeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<number>(Date.now());
  const [vesselStatus, setVesselStatus] = useState<'moving' | 'stationary'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const lastFirestoreUpdateRef = useRef<number>(0);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    const list = [...defaultVesselSounds];
    if (dbSounds) {
        dbSounds.forEach(s => {
            const hasRightCategory = !s.categories || s.categories.includes('Vessel') || s.categories.includes('General');
            if (hasRightCategory && !list.find(l => l.url === s.url)) {
                list.push({ id: s.id, label: s.label, url: s.url });
            }
        });
    }
    return list;
  }, [dbSounds]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('vessel_follow_history');
    if (savedHistory) setVesselHistory(JSON.parse(savedHistory));
    const savedCustomId = localStorage.getItem('vessel_custom_id');
    if (savedCustomId) setCustomSharingId(savedCustomId);
  }, []);

  const handleSaveCustomId = () => {
    const id = customSharingId.trim().toUpperCase();
    localStorage.setItem('vessel_custom_id', id);
    setCustomSharingId(id);
    toast({ title: "Identifiant enregistré", description: `ID : ${id || 'UID par défaut'}` });
  };

  const addToHistory = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId || vesselHistory.includes(cleanId)) return;
    const newHistory = [cleanId, ...vesselHistory].slice(0, 5);
    setVesselHistory(newHistory);
    localStorage.setItem('vessel_follow_history', JSON.stringify(newHistory));
  };

  const removeFromHistory = (id: string) => {
    const newHistory = vesselHistory.filter(item => item !== id);
    setVesselHistory(newHistory);
    localStorage.setItem('vessel_follow_history', JSON.stringify(newHistory));
  };

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (userProfile?.emergencyContact) {
      setEmergencyContact(userProfile.emergencyContact);
    }
  }, [userProfile]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const vesselRef = useMemoFirebase(() => {
    const cleanId = vesselIdToFollow.trim().toUpperCase();
    if (!firestore || mode !== 'receiver' || !cleanId) return null;
    return doc(firestore, 'vessels', cleanId);
  }, [firestore, mode, vesselIdToFollow]);
  const { data: remoteVessel, isLoading: isVesselLoading } = useDoc<VesselStatus>(vesselRef);

  const playAlertSound = useCallback((soundId: string) => {
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselVolume, availableSounds]);

  useEffect(() => {
    if (mode !== 'receiver' || !remoteVessel) return;
    const currentStatus = remoteVessel.status;
    if (currentStatus !== prevVesselStatusRef.current) {
      setStatusStartTime(Date.now());
      setIsWatchAlerting(false);
    }
    if (isNotifyEnabled && prevVesselStatusRef.current !== null && prevVesselStatusRef.current !== currentStatus) {
        let s = '';
        if (currentStatus === 'moving' && notifySettings.moving) s = notifySounds.moving;
        if (currentStatus === 'stationary' && notifySettings.stationary) s = notifySounds.stationary;
        if (currentStatus === 'offline' && notifySettings.offline) s = notifySounds.offline;
        if (s) {
          playAlertSound(s);
          toast({ title: "Mise à jour navire", description: `Statut : ${currentStatus === 'moving' ? 'En route' : 'Immobile'}` });
        }
    }
    prevVesselStatusRef.current = currentStatus;
  }, [remoteVessel, mode, isNotifyEnabled, notifySettings, notifySounds, playAlertSound, toast]);

  useEffect(() => {
    if (mode !== 'receiver' || !isWatchEnabled || isWatchAlerting || !statusStartTime || !remoteVessel) return;
    const check = setInterval(() => {
      if (remoteVessel.status === watchType) {
        const elapsed = (Date.now() - statusStartTime) / 60000;
        if (elapsed >= watchDuration) {
          setIsWatchAlerting(true);
          toast({ variant: "destructive", title: "ALERTE SURVEILLANCE", description: `Immobilité prolongée (${watchDuration} min)` });
        }
      }
    }, 5000);
    return () => clearInterval(check);
  }, [mode, isWatchEnabled, isWatchAlerting, statusStartTime, watchType, watchDuration, remoteVessel, toast]);

  useEffect(() => {
    if (isWatchAlerting) {
      playAlertSound(watchSound);
      watchRepeatIntervalRef.current = setInterval(() => playAlertSound(watchSound), 10000);
    } else if (watchRepeatIntervalRef.current) {
      clearInterval(watchRepeatIntervalRef.current);
      watchRepeatIntervalRef.current = null;
    }
    return () => { if (watchRepeatIntervalRef.current) clearInterval(watchRepeatIntervalRef.current); };
  }, [isWatchAlerting, watchSound, playAlertSound]);

  const handleStopWatchAlert = () => {
    setIsWatchAlerting(false);
    setStatusStartTime(Date.now());
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      toast({ variant: "destructive", title: "Non supporté" });
      return;
    }
    if (wakeLock) {
      try { await wakeLock.release(); setWakeLock(null); } catch (e) { setWakeLock(null); }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil actif" });
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Permission bloquée (environnement restreint)" });
      }
    }
  };

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    const docRef = doc(firestore, 'vessels', sharingId);
    setDoc(docRef, { userId: user.uid, displayName: user.displayName || 'Capitaine', isSharing: true, lastActive: serverTimestamp(), ...data }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId]);

  useEffect(() => {
    if (!isLoaded || !map || !hasInitialCentered) {
      const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : currentPos);
      if (pos) { map.panTo(pos); map.setZoom(15); setHasInitialCentered(true); }
    }
  }, [isLoaded, map, currentPos, remoteVessel?.location, hasInitialCentered, mode]);

  useEffect(() => {
    if (!isSharing || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const newPos = { lat: newLat, lng: newLng };
        const now = Date.now();
        setCurrentPos(newPos);
        if (!anchorPos) {
          setAnchorPos(newPos);
          setLastMovementTime(now);
          updateVesselInFirestore({ location: { latitude: newLat, longitude: newLng }, status: 'moving' });
          lastFirestoreUpdateRef.current = now;
          return;
        }
        const dist = getDistance(newLat, newLng, anchorPos.lat, anchorPos.lng);
        if (dist > IMMOBILITY_THRESHOLD_METERS) {
          setVesselStatus('moving');
          setAnchorPos(newPos);
          setLastMovementTime(now);
          if (now - lastFirestoreUpdateRef.current > THROTTLE_UPDATE_MS) {
            updateVesselInFirestore({ location: { latitude: newLat, longitude: newLng }, status: 'moving' });
            lastFirestoreUpdateRef.current = now;
          }
        } else {
          const idle = (now - lastMovementTime) / 60000;
          if (idle >= IMMOBILITY_START_MINUTES && vesselStatus === 'moving') {
            setVesselStatus('stationary');
            updateVesselInFirestore({ status: 'stationary' });
            lastFirestoreUpdateRef.current = now;
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, anchorPos, vesselStatus, lastMovementTime, updateVesselInFirestore]);

  useEffect(() => {
    if (mode === 'receiver' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
    }
  }, [mode]);

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : currentPos);
    if (pos && map) { map.panTo(pos); map.setZoom(15); }
  };

  const copyCoordinates = (lat: number, lng: number) => {
    const text = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Coordonnées copiées" });
  };

  const sendEmergencySms = (lat: number, lng: number, name: string) => {
    if (!emergencyContact.trim()) {
      toast({ variant: "destructive", title: "Numéro requis", description: "Saisissez le contact d'urgence sous la carte." });
      return;
    }
    const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const url = `https://www.google.com/maps?q=${coords}`;
    const body = `ALERTE : ${name === 'Ma Position' ? (user?.displayName || 'Bateau') : name} en difficulté. Position : ${url}`;
    const smsHref = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    window.location.href = smsHref;
  };

  const displayVessel = mode === 'sender' ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: 'Ma Position' } : null) : remoteVessel;

  const handleSaveEmergencyContact = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), { emergencyContact });
        toast({ title: "Contact enregistré", description: "Le numéro sera utilisé pour l'alerte SMS." });
    } catch (e) {
        console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {isWatchAlerting && (
        <div className="fixed top-0 left-0 right-0 z-[200] p-4 bg-red-600 animate-in fade-in slide-in-from-top-4">
          <div className="max-w-md mx-auto flex flex-col items-center gap-4 text-white">
            <ShieldAlert className="size-8 animate-pulse" /><p className="font-black uppercase tracking-tighter">ALERTE SURVEILLANCE ACTIVÉE</p>
            <Button className="w-full bg-white text-red-600 font-black h-14" onClick={handleStopWatchAlert}>ARRÊTER L'ALERTE</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Navigation className="text-primary" /> Vessel Tracker NC</CardTitle>
          <CardDescription>Partage de position et sécurité maritime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex bg-muted p-1 rounded-lg">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1" onClick={() => { setMode('sender'); setHasInitialCentered(false); }}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1" onClick={() => { setMode('receiver'); setHasInitialCentered(false); }}>Récepteur (B)</Button>
          </div>

          {mode === 'sender' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-0.5"><Label className="text-base font-bold">Partager ma position</Label><p className="text-[10px] text-muted-foreground uppercase font-black">Flux GPS en direct</p></div>
                <Switch checked={isSharing} onCheckedChange={setIsSharing} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">ID de partage personnalisé</Label>
                <div className="flex gap-2">
                  <Input placeholder="Bateau-123" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} disabled={isSharing} className="font-mono text-xs uppercase h-11 border-2" />
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handleSaveCustomId} disabled={isSharing}><Save className="size-4" /></Button>
                </div>
              </div>
              <Button variant={wakeLock ? "secondary" : "outline"} size="sm" className={cn("w-full gap-2 font-black h-12 border-2", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Navire à suivre (ID)</Label>
                <div className="flex gap-2">
                  <Input placeholder="Saisir ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-mono text-xs uppercase h-11 border-2" />
                  <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0" onClick={() => { if(vesselIdToFollow) { addToHistory(vesselIdToFollow); setHasInitialCentered(false); }}}><Plus className="size-4" /></Button>
                </div>
              </div>
              {vesselHistory.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {vesselHistory.map(id => (
                    <Badge key={id} variant="secondary" className="pr-1 pl-3 h-7 font-mono text-[10px] cursor-pointer hover:bg-muted" onClick={() => { setVesselIdToFollow(id); setHasInitialCentered(false); }}>
                      {id} <button onClick={(e) => { e.stopPropagation(); removeFromHistory(id); }} className="ml-2 p-1 hover:bg-black/10 rounded-full"><Trash2 className="size-2.5" /></button>
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-2">
                        {isNotifyEnabled ? <Bell className="size-4 text-primary fill-current" /> : <BellOff className="size-4 text-muted-foreground" />}
                        <Label className="text-base font-bold">Alertes Sonores</Label>
                    </div>
                    <Switch checked={isNotifyEnabled} onCheckedChange={setIsNotifyEnabled} />
                </div>

                {isNotifyEnabled && (
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground"><span>Volume</span><span>{Math.round(vesselVolume * 100)}%</span></div>
                        <Slider value={[vesselVolume]} min={0} max={1} step={0.1} onValueChange={v => setVesselVolume(v[0])} />
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sounds" className="border-none">
                            <AccordionTrigger className="text-xs font-black uppercase py-2 hover:no-underline">Personnaliser les sons</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold">En route (Moving)</Label>
                                        <Switch checked={notifySettings.moving} onCheckedChange={val => setNotifySettings(p => ({...p, moving: val}))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={notifySounds.moving} onValueChange={val => { setNotifySounds(p => ({...p, moving: val})); playAlertSound(val); }}>
                                            <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playAlertSound(notifySounds.moving)}><Play className="size-3" /></Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold">Immobile (Stationary)</Label>
                                        <Switch checked={notifySettings.stationary} onCheckedChange={val => setNotifySettings(p => ({...p, stationary: val}))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={notifySounds.stationary} onValueChange={val => { setNotifySounds(p => ({...p, stationary: val})); playAlertSound(val); }}>
                                            <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playAlertSound(notifySounds.stationary)}><Play className="size-3" /></Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold">Hors-ligne (Offline)</Label>
                                        <Switch checked={notifySettings.offline} onCheckedChange={val => setNotifySettings(p => ({...p, offline: val}))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={notifySounds.offline} onValueChange={val => { setNotifySounds(p => ({...p, offline: val})); playAlertSound(val); }}>
                                            <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playAlertSound(notifySounds.offline)}><Play className="size-3" /></Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="watch" className="border-none">
                            <AccordionTrigger className="text-xs font-black uppercase py-2 hover:no-underline">Surveillance Temporelle</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold">Activer la veille critique</Label>
                                    <Switch checked={isWatchEnabled} onCheckedChange={setIsWatchEnabled} />
                                </div>
                                {isWatchEnabled && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase">Statut à surveiller</Label>
                                            <Select value={watchType} onValueChange={val => setWatchType(val as any)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="stationary">Immobilité (Mouillage)</SelectItem>
                                                    <SelectItem value="moving">Mouvement (Dérive)</SelectItem>
                                                    <SelectItem value="offline">Perte réseau</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black uppercase"><span>Durée max</span><span>{watchDuration} min</span></div>
                                            <Slider value={[watchDuration]} min={1} max={60} step={1} onValueChange={v => setWatchDuration(v[0])} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase">Son de l'alarme</Label>
                                            <div className="flex gap-2">
                                                <Select value={watchSound} onValueChange={val => { setWatchSound(val); playAlertSound(val); }}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => playAlertSound(watchSound)}><Play className="size-3" /></Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-2 shadow-lg">
        <div className="h-96 relative bg-muted/20">
          {!isLoaded ? <Skeleton className="h-full w-full" /> : (
            <>
                <GoogleMap
                mapContainerClassName="w-full h-full"
                center={displayVessel?.location ? { lat: displayVessel.location.latitude, lng: displayVessel.location.longitude } : (currentPos || { lat: -22.27, lng: 166.45 })}
                zoom={15}
                onLoad={setMap}
                options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}
                >
                {/* Position de l'utilisateur (Récepteur) */}
                {currentPos && (
                    <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }}>
                            <div className="size-4 bg-primary rounded-full border-2 border-white shadow-lg"></div>
                        </div>
                    </OverlayView>
                )}

                {/* Navire suivi */}
                {displayVessel?.location && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-white/90 backdrop-blur rounded shadow-lg text-[10px] font-black whitespace-nowrap border flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", displayVessel.status === 'moving' ? "bg-blue-500 animate-pulse" : "bg-amber-500")}></span>
                        {displayVessel.displayName}
                        </div>
                        <div className={cn("p-2 rounded-full shadow-xl border-2 border-white", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                        {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
                </GoogleMap>

                {mode === 'receiver' && vesselIdToFollow && isVesselLoading && (
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex flex-col items-center justify-center z-20">
                        <Loader2 className="size-10 text-primary animate-spin mb-2" />
                        <p className="text-xs font-black uppercase text-primary tracking-tighter">Connexion au navire...</p>
                    </div>
                )}

                {mode === 'receiver' && vesselIdToFollow && !isVesselLoading && !remoteVessel && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 p-6 text-center">
                        <div className="p-4 bg-white/90 rounded-2xl shadow-xl border-2 border-destructive/20 flex flex-col items-center gap-3">
                            <MapIcon className="size-8 text-destructive opacity-40" />
                            <p className="text-xs font-bold leading-tight">Identifiant <span className="font-black text-destructive">"{vesselIdToFollow.toUpperCase()}"</span> introuvable ou navire déconnecté.</p>
                            <Button variant="outline" size="sm" onClick={() => setHasInitialCentered(false)} className="h-8 text-[10px] font-black uppercase">Réessayer</Button>
                        </div>
                    </div>
                )}
            </>
          )}
          <Button size="icon" className="absolute top-4 right-4 shadow-lg h-10 w-10 z-10 bg-background/80 backdrop-blur-sm" onClick={handleRecenter}><LocateFixed className="size-5" /></Button>
        </div>
        
        <CardFooter className="bg-muted/30 p-4 flex flex-col gap-4 border-t">
          {displayVessel ? (
            <div className="w-full space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="h-11 border-2 text-xs font-bold" onClick={() => copyCoordinates(displayVessel.location.latitude, displayVessel.location.longitude)}><Copy className="size-4 mr-2" /> Copier les coordonnées GPS</Button>
                <Button variant="destructive" className="w-full h-14 bg-red-600 hover:bg-red-700 text-base font-black shadow-xl flex items-center justify-center gap-3 uppercase tracking-tighter" onClick={() => sendEmergencySms(displayVessel.location.latitude, displayVessel.location.longitude, displayVessel.displayName)}><ShieldAlert className="size-6" /> ENVOYER ALERTE SMS</Button>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 bg-white/50 p-4 rounded-xl border-2 border-dashed">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Secours en Mer (MRCC)</span>
                      <span className="text-red-600 text-sm font-black">196 (OU VHF 16)</span>
                    </div>
                    <div className="flex items-start gap-2 bg-red-50/50 p-2 rounded-lg border border-red-100">
                      <Info className="size-3 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-[9px] leading-relaxed text-muted-foreground font-medium italic">
                        Rappelons qu’en mer, c’est le <strong>CANAL 16</strong> de la VHF qui est le moyen le plus approprié pour donner l’alerte et communiquer avec les sauveteurs, le 196 étant plutôt destiné aux appels effectués depuis la terre ferme, par exemple par des témoins constatant la présence d’une embarcation en détresse depuis le rivage.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-muted-foreground/10 pt-2">
                    <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Sapeurs-pompiers</span>
                    <span className="text-foreground font-black text-xs">18</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-muted-foreground/10 pt-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Urgences Santé / SAMU</span>
                    <div className="flex flex-col items-end">
                      <span className="text-foreground font-black text-xs">15</span>
                      <span className="text-[9px] font-bold text-muted-foreground">+687 78.77.25</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-muted-foreground/10 pt-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">SNSM Nouméa</span>
                    <span className="text-foreground font-black text-xs">25.23.12</span>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Contact d'urgence (Alerte SMS) :</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Numéro du proche..." 
                      value={emergencyContact} 
                      onChange={e => setEmergencyContact(e.target.value)}
                      className="h-11 text-sm border-2 font-bold bg-background"
                    />
                    <Button 
                      variant="secondary"
                      size="icon" 
                      className="h-11 w-11 shrink-0 shadow-sm border-2" 
                      onClick={handleSaveEmergencyContact}
                    >
                      <Save className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground italic py-2">Activez le partage ou saisissez un ID pour voir les outils d'urgence.</p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
