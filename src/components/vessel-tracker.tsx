
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

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  // Sync preferences from profile
  useEffect(() => {
    if (userProfile?.vesselPrefs) {
      const prefs = userProfile.vesselPrefs;
      setIsNotifyEnabled(prefs.isNotifyEnabled);
      setVesselVolume(prefs.vesselVolume);
      setNotifySettings(prefs.notifySettings);
      setNotifySounds(prefs.notifySounds);
      setIsWatchEnabled(prefs.isWatchEnabled);
      setWatchType(prefs.watchType);
      setWatchDuration(prefs.watchDuration);
      setWatchSound(prefs.watchSound);
    }
    if (userProfile?.emergencyContact) {
      setEmergencyContact(userProfile.emergencyContact);
    }
  }, [userProfile]);

  // Auto-save preferences
  useEffect(() => {
    if (!user || !firestore || isProfileLoading) return;
    
    const timeout = setTimeout(() => {
      const prefs = {
        isNotifyEnabled,
        vesselVolume,
        notifySettings,
        notifySounds,
        isWatchEnabled,
        watchType,
        watchDuration,
        watchSound,
      };
      
      const hasChanged = JSON.stringify(prefs) !== JSON.stringify(userProfile?.vesselPrefs);
      
      if (hasChanged) {
        updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: prefs })
          .catch(e => console.error("Error auto-saving prefs:", e));
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timeout);
  }, [user, firestore, isProfileLoading, isNotifyEnabled, vesselVolume, notifySettings, notifySounds, isWatchEnabled, watchType, watchDuration, watchSound, userProfile?.vesselPrefs]);

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

  const handleSaveCustomId = () => {
    const id = customSharingId.trim().toUpperCase();
    localStorage.setItem('vessel_custom_id', id);
    setCustomSharingId(id);
    toast({ title: "Identifiant enregistré", description: `ID : ${id || 'UID par défaut'}` });
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      toast({ variant: "destructive", title: "Non supporté", description: "Votre navigateur ne supporte pas le maintien de l'écran." });
      return;
    }
    if (wakeLock) {
      try { await wakeLock.release(); setWakeLock(null); toast({ title: "Mode éveil désactivé" }); } catch (e) { setWakeLock(null); }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil actif", description: "L'écran restera allumé pour le suivi." });
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Permission bloquée", description: "Le Mode Éveil est bloqué dans cet environnement (iframe). Testez sur navigateur mobile." });
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

  return (
    <div className="space-y-6">
      {isWatchAlerting && (
        <div className="fixed top-0 left-0 right-0 z-[200] p-4 bg-red-600 animate-in fade-in slide-in-from-top-4 shadow-2xl">
          <div className="max-w-md mx-auto flex flex-col items-center gap-4 text-white">
            <ShieldAlert className="size-10 animate-pulse" />
            <p className="font-black uppercase tracking-tighter text-lg">ALERTE SURVEILLANCE ACTIVÉE</p>
            <Button className="w-full bg-white text-red-600 font-black h-16 text-lg rounded-xl shadow-lg active:scale-95" onClick={handleStopWatchAlert}>ARRÊTER L'ALERTE</Button>
          </div>
        </div>
      )}

      <Card className="border-2 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter"><Navigation className="text-primary size-6" /> Vessel Tracker NC</CardTitle>
          <CardDescription className="font-medium text-xs">Partage de position et sécurité maritime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex bg-muted/50 p-1.5 rounded-xl border">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-bold h-11 rounded-lg" onClick={() => { setMode('sender'); setHasInitialCentered(false); }}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-bold h-11 rounded-lg" onClick={() => { setMode('receiver'); setHasInitialCentered(false); }}>Récepteur (B)</Button>
          </div>

          {mode === 'sender' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-5 border-2 rounded-2xl bg-card shadow-sm">
                <div className="space-y-0.5"><Label className="text-lg font-black uppercase tracking-tighter leading-none">Partager ma position</Label><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Flux GPS en direct</p></div>
                <Switch checked={isSharing} onCheckedChange={setIsSharing} className="scale-125 mr-2" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">ID de partage personnalisé</Label>
                <div className="flex gap-2">
                  <Input placeholder="Bateau-123" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} disabled={isSharing} className="font-black text-center uppercase tracking-widest h-14 border-2 text-base rounded-xl bg-muted/10" />
                  <Button variant="outline" size="icon" className="h-14 w-14 shrink-0 border-2 rounded-xl bg-white active:scale-95" onClick={handleSaveCustomId} disabled={isSharing}><Save className="size-6" /></Button>
                </div>
              </div>
              <Button variant={wakeLock ? "secondary" : "outline"} className={cn("w-full gap-3 font-black h-14 border-2 text-sm uppercase tracking-widest rounded-xl shadow-sm", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-5", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Navire à suivre (ID)</Label>
                <div className="flex gap-2">
                  <Input placeholder="Saisir ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center uppercase tracking-widest h-14 border-2 text-base rounded-xl bg-muted/10" />
                  <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0 border-2 rounded-xl bg-white shadow-sm active:scale-95" onClick={() => { if(vesselIdToFollow) { addToHistory(vesselIdToFollow); setHasInitialCentered(false); }}}><Plus className="size-6 text-primary" /></Button>
                </div>
              </div>
              {vesselHistory.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 px-1">
                  {vesselHistory.map(id => (
                    <Badge key={id} variant="secondary" className="pr-1.5 pl-4 h-9 font-black tracking-widest text-[11px] cursor-pointer hover:bg-primary/10 border-2 border-transparent hover:border-primary/20 rounded-full" onClick={() => { setVesselIdToFollow(id); setHasInitialCentered(false); }}>
                      {id} <button onClick={(e) => { e.stopPropagation(); removeFromHistory(id); }} className="ml-2.5 p-1.5 hover:bg-black/10 rounded-full"><Trash2 className="size-3 text-destructive" /></button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button variant={wakeLock ? "secondary" : "outline"} className={cn("w-full gap-3 font-black h-14 border-2 text-sm uppercase tracking-widest rounded-xl shadow-sm", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-5", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-5 border-2 rounded-2xl bg-card shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2.5 rounded-xl", isNotifyEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            {isNotifyEnabled ? <Bell className="size-6 fill-current" /> : <BellOff className="size-6" />}
                        </div>
                        <Label className="text-lg font-black uppercase tracking-tighter">Alertes Sonores</Label>
                    </div>
                    <Switch checked={isNotifyEnabled} onCheckedChange={setIsNotifyEnabled} className="scale-125 mr-2" />
                </div>

                {isNotifyEnabled && (
                  <div className="p-5 border-2 rounded-2xl bg-muted/20 space-y-6 animate-in fade-in slide-in-from-top-2 shadow-inner">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Volume des alertes</span>
                            <span className="font-black text-primary bg-primary/10 px-2.5 py-1 rounded-md text-xs">{Math.round(vesselVolume * 100)}%</span>
                        </div>
                        <Slider value={[vesselVolume]} min={0} max={1} step={0.1} onValueChange={v => setVesselVolume(v[0])} className="py-2" />
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full space-y-3">
                        <AccordionItem value="sounds" className="border-2 rounded-xl bg-card overflow-hidden shadow-sm">
                            <AccordionTrigger className="text-xs font-black uppercase px-4 py-4 hover:no-underline bg-muted/10">
                                <div className="flex items-center gap-3">
                                    <Bell className="size-4" />
                                    <span>Personnaliser les sons par état</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-6 p-4 pt-5 border-t border-dashed">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-black uppercase text-primary tracking-widest">En route (Moving)</Label>
                                        <Switch checked={notifySettings.moving} onCheckedChange={val => setNotifySettings(p => ({...p, moving: val}))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={notifySounds.moving} onValueChange={val => { setNotifySounds(p => ({...p, moving: val})); playAlertSound(val); }}>
                                            <SelectTrigger className="h-12 text-sm font-bold border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 border-2 rounded-xl bg-white active:scale-95" onClick={() => playAlertSound(notifySounds.moving)}><Play className="size-4" /></Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-black uppercase text-accent tracking-widest">Immobile (Stationary)</Label>
                                        <Switch checked={notifySettings.stationary} onCheckedChange={val => setNotifySettings(p => ({...p, stationary: val}))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={notifySounds.stationary} onValueChange={val => { setNotifySounds(p => ({...p, stationary: val})); playAlertSound(val); }}>
                                            <SelectTrigger className="h-12 text-sm font-bold border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 border-2 rounded-xl bg-white active:scale-95" onClick={() => playAlertSound(notifySounds.stationary)}><Play className="size-4" /></Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-black uppercase text-destructive tracking-widest">Hors-ligne (Offline)</Label>
                                        <Switch checked={notifySettings.offline} onCheckedChange={val => setNotifySettings(p => ({...p, offline: val}))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={notifySounds.offline} onValueChange={val => { setNotifySounds(p => ({...p, offline: val})); playAlertSound(val); }}>
                                            <SelectTrigger className="h-12 text-sm font-bold border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 border-2 rounded-xl bg-white active:scale-95" onClick={() => playAlertSound(notifySounds.offline)}><Play className="size-4" /></Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="watch" className="border-2 rounded-xl bg-card overflow-hidden shadow-sm">
                            <AccordionTrigger className="text-xs font-black uppercase px-4 py-4 hover:no-underline bg-muted/10">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="size-4" />
                                    <span>Surveillance Temporelle</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-6 p-4 pt-5 border-t border-dashed">
                                <div className="flex items-center justify-between bg-muted/10 p-4 rounded-xl border-2 border-dashed">
                                    <Label className="text-xs font-black uppercase tracking-tighter">Activer la veille critique</Label>
                                    <Switch checked={isWatchEnabled} onCheckedChange={setIsWatchEnabled} className="scale-110" />
                                </div>
                                {isWatchEnabled && (
                                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Condition à surveiller</Label>
                                            <Select value={watchType} onValueChange={val => setWatchType(val as any)}>
                                                <SelectTrigger className="h-14 text-sm font-black border-2 rounded-xl bg-muted/5"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="stationary">Immobilité (Mouillage)</SelectItem>
                                                    <SelectItem value="moving">Mouvement (Dérive)</SelectItem>
                                                    <SelectItem value="offline">Perte réseau (Offline)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Durée avant alarme</span>
                                                <span className="font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md text-xs">{watchDuration} min</span>
                                            </div>
                                            <Slider value={[watchDuration]} min={1} max={60} step={1} onValueChange={v => setWatchDuration(v[0])} className="py-2" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Son de l'alarme</Label>
                                            <div className="flex gap-2">
                                                <Select value={watchSound} onValueChange={val => { setWatchSound(val); playAlertSound(val); }}>
                                                    <SelectTrigger className="h-12 text-sm font-bold border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 border-2 rounded-xl bg-white active:scale-95" onClick={() => playAlertSound(watchSound)}><Play className="size-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
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

      <Card className="overflow-hidden border-2 shadow-xl rounded-2xl">
        <div className="h-[400px] relative bg-muted/20">
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
                            <div className="size-5 bg-blue-500 rounded-full border-2 border-white shadow-2xl animate-pulse"></div>
                        </div>
                    </OverlayView>
                )}

                {/* Navire suivi */}
                {displayVessel?.location && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1.5">
                        <div className="px-3 py-1.5 bg-slate-900/90 text-white backdrop-blur rounded-lg shadow-2xl text-[11px] font-black whitespace-nowrap border border-white/20 flex items-center gap-2.5">
                        <span className={cn("size-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]", displayVessel.status === 'moving' ? "bg-green-400 animate-pulse" : "bg-amber-400")}></span>
                        {displayVessel.displayName}
                        </div>
                        <div className={cn("p-2.5 rounded-full shadow-2xl border-2 border-white transition-all transform hover:scale-110", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                        {displayVessel.status === 'stationary' ? <Anchor className="size-6 text-white" /> : <Navigation className="size-6 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
                </GoogleMap>

                {mode === 'receiver' && vesselIdToFollow && isVesselLoading && (
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex flex-col items-center justify-center z-20">
                        <Loader2 className="size-12 text-primary animate-spin mb-3" />
                        <p className="text-xs font-black uppercase text-primary tracking-widest">Connexion au navire...</p>
                    </div>
                )}

                {mode === 'receiver' && vesselIdToFollow && !isVesselLoading && !remoteVessel && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 p-6 text-center">
                        <div className="p-6 bg-white/95 rounded-3xl shadow-2xl border-2 border-destructive/20 flex flex-col items-center gap-4 max-w-[280px]">
                            <MapIcon className="size-10 text-destructive opacity-40" />
                            <p className="text-xs font-black leading-tight uppercase tracking-tighter">Identifiant <span className="text-destructive">"{vesselIdToFollow.toUpperCase()}"</span> introuvable ou navire déconnecté.</p>
                            <Button variant="outline" size="sm" onClick={() => setHasInitialCentered(false)} className="h-10 text-[10px] font-black uppercase px-6 border-2 rounded-full">Réessayer</Button>
                        </div>
                    </div>
                )}
            </>
          )}
          <Button size="icon" className="absolute top-4 right-4 shadow-xl h-12 w-12 z-10 bg-background/90 backdrop-blur-sm border-2 rounded-xl active:scale-90" onClick={handleRecenter}><LocateFixed className="size-6" /></Button>
        </div>
        
        <CardFooter className="bg-muted/10 p-5 flex flex-col gap-5 border-t-2">
          {displayVessel ? (
            <div className="w-full space-y-5">
              <div className="grid grid-cols-1 gap-3">
                <Button variant="outline" className="h-12 border-2 text-xs font-black uppercase tracking-widest rounded-xl bg-white shadow-sm" onClick={() => copyCoordinates(displayVessel.location.latitude, displayVessel.location.longitude)}><Copy className="size-4 mr-2" /> Copier les coordonnées GPS</Button>
                <Button variant="destructive" className="w-full h-16 bg-red-600 hover:bg-red-700 text-base font-black shadow-2xl flex items-center justify-center gap-3 uppercase tracking-tighter rounded-2xl active:scale-95 border-b-4 border-red-800" onClick={() => sendEmergencySms(displayVessel.location.latitude, displayVessel.location.longitude, displayVessel.displayName)}><ShieldAlert className="size-7" /> ENVOYER ALERTE SMS</Button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 bg-white/80 p-5 rounded-2xl border-2 border-dashed shadow-inner">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Secours en Mer (MRCC)</span>
                      <span className="text-red-600 text-base font-black tracking-tighter">196 (OU VHF 16)</span>
                    </div>
                    <div className="flex items-start gap-2.5 bg-red-50/50 p-3 rounded-xl border border-red-100">
                      <Info className="size-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-muted-foreground font-bold italic">
                        Rappelons qu’en mer, c’est le <strong>CANAL 16</strong> de la VHF qui est le moyen le plus approprié pour donner l’alerte et communiquer avec les sauveteurs, le 196 étant plutôt destiné aux appels effectués depuis la terre ferme.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-muted-foreground/10 pt-3">
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Sapeurs-pompiers</span>
                    <span className="text-foreground font-black text-sm">18</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-muted-foreground/10 pt-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Urgences Santé / SAMU</span>
                    <div className="flex flex-col items-end">
                      <span className="text-foreground font-black text-sm">15</span>
                      <span className="text-[9px] font-black text-muted-foreground/60">+687 78.77.25</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-muted-foreground/10 pt-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">SNSM Nouméa</span>
                    <span className="text-foreground font-black text-sm">25.23.12</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 opacity-70">Contact d'urgence (Alerte SMS) :</Label>
                  <div className="flex gap-2">
                    <input 
                      type="tel"
                      placeholder="Numéro du proche..." 
                      value={emergencyContact} 
                      onChange={e => setEmergencyContact(e.target.value)}
                      className="flex h-14 w-full rounded-xl border-2 border-input bg-white px-4 py-2 text-base font-black tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                    />
                    <Button 
                      variant="secondary"
                      size="icon" 
                      className="h-14 w-14 shrink-0 shadow-md border-2 rounded-xl bg-white active:scale-95" 
                      onClick={handleSaveEmergencyContact}
                    >
                      <Save className="size-6 text-primary" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs font-black uppercase tracking-tighter text-muted-foreground/40 italic py-4">Activez le partage ou saisissez un ID pour voir les outils d'urgence.</p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
