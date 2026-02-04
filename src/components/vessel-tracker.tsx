'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Play,
  Trash2,
  Plus,
  Info,
  Clock,
  WifiOff,
  Move,
  BatteryMedium,
  BatteryLow,
  BatteryFull,
  AlertOctagon,
  History,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// CONFIGURATION DES SEUILS
const IMMOBILITY_THRESHOLD_METERS = 20; // Rayon de 20m pour repasser en mouvement
const IMMOBILITY_START_MINUTES = 1;     // Délai pour passer en stationnaire
const THROTTLE_UPDATE_MS = 10000;       // Fréquence max de mise à jour Firestore

interface StatusEvent {
  status: 'moving' | 'stationary' | 'offline';
  timestamp: number;
  location: { lat: number, lng: number } | null;
}

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
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);

  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [vesselVolume, setVesselVolume] = useState(0.8);
  const [notifySettings, setNotifySettings] = useState({ moving: true, stationary: true, offline: true });
  const [notifySounds, setNotifySounds] = useState({ moving: 'cloche', stationary: 'sonar', offline: 'alerte' });
  const prevVesselStatusRef = useRef<string | null>(null);

  const [isWatchEnabled, setIsWatchEnabled] = useState(false);
  const [watchType, setWatchType] = useState<'moving' | 'stationary' | 'offline'>('stationary');
  const [watchDuration, setWatchDuration] = useState(15);
  const [watchSound, setWatchSound] = useState('alerte');
  const [isWatchAlerting, setIsWatchAlerting] = useState(false);
  const [statusStartTime, setStatusStartTime] = useState<number | null>(null);
  const [elapsedString, setElapsedString] = useState<string>('0s');

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<number>(Date.now());
  const [vesselStatus, setVesselStatus] = useState<'moving' | 'stationary'>('moving');
  const [lastValidLocation, setLastValidLocation] = useState<{lat: number, lng: number} | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(1);
  
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

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const vesselRef = useMemoFirebase(() => {
    const cleanId = vesselIdToFollow.trim().toUpperCase();
    if (!firestore || mode !== 'receiver' || !cleanId) return null;
    return doc(firestore, 'vessels', cleanId);
  }, [firestore, mode, vesselIdToFollow]);
  const { data: remoteVessel } = useDoc<VesselStatus>(vesselRef);

  const currentEffectiveStatus = useMemo(() => {
    if (mode === 'sender') {
      return isSharing ? vesselStatus : 'offline';
    } else {
      return (remoteVessel && remoteVessel.isSharing) ? remoteVessel.status : 'offline';
    }
  }, [mode, isSharing, vesselStatus, remoteVessel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('vessel_follow_history');
      if (savedHistory) {
        try { setVesselHistory(JSON.parse(savedHistory)); } catch (e) {}
      }
      const savedCustomId = localStorage.getItem('vessel_custom_id');
      if (savedCustomId) setCustomSharingId(savedCustomId);
    }
  }, []);

  useEffect(() => {
    if (userProfile?.vesselPrefs) {
      const prefs = userProfile.vesselPrefs;
      setIsNotifyEnabled(prefs.isNotifyEnabled ?? false);
      setVesselVolume(prefs.vesselVolume ?? 0.8);
      if (prefs.notifySettings) setNotifySettings(prefs.notifySettings);
      if (prefs.notifySounds) setNotifySounds(prefs.notifySounds);
      setIsWatchEnabled(prefs.isWatchEnabled ?? false);
      setWatchType(prefs.watchType ?? 'stationary');
      setWatchDuration(prefs.watchDuration ?? 15);
      setWatchSound(prefs.watchSound ?? 'alerte');
    }
    if (userProfile?.emergencyContact) {
      setEmergencyContact(userProfile.emergencyContact);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!user || !firestore || isProfileLoading) return;
    const timeout = setTimeout(() => {
      const prefs = { isNotifyEnabled, vesselVolume, notifySettings, notifySounds, isWatchEnabled, watchType, watchDuration, watchSound };
      updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: prefs }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timeout);
  }, [user, firestore, isProfileLoading, isNotifyEnabled, vesselVolume, notifySettings, notifySounds, isWatchEnabled, watchType, watchDuration, watchSound]);

  const addToHistory = useCallback((id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;
    setVesselHistory(prev => {
      if (prev.includes(cleanId)) return prev;
      const next = [cleanId, ...prev].slice(0, 5);
      localStorage.setItem('vessel_follow_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromHistory = (id: string) => {
    setVesselHistory(prev => {
      const next = prev.filter(x => x !== id);
      localStorage.setItem('vessel_follow_history', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveCustomId = useCallback(() => {
    const id = customSharingId.trim().toUpperCase();
    localStorage.setItem('vessel_custom_id', id);
    setCustomSharingId(id);
    addToHistory(id);
    toast({ title: "ID enregistré", description: `Partage actif sur ID: ${id || 'Défaut'}` });
  }, [customSharingId, addToHistory, toast]);

  const handleSaveEmergencyContact = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), { emergencyContact });
        toast({ title: "Contact enregistré" });
    } catch (e) {}
  };

  const playAlertSound = useCallback((soundId: string) => {
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselVolume, availableSounds]);

  useEffect(() => {
    if (!statusStartTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - statusStartTime) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) setElapsedString(`${h}h ${m}m`);
      else if (m > 0) setElapsedString(`${m}m ${s}s`);
      else setElapsedString(`${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [statusStartTime]);

  useEffect(() => {
    if (currentEffectiveStatus !== prevVesselStatusRef.current) {
      const now = Date.now();
      const loc = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : lastValidLocation);
      
      const newEvent: StatusEvent = {
        status: currentEffectiveStatus as any,
        timestamp: now,
        location: loc
      };
      
      setStatusEvents(prev => [newEvent, ...prev].slice(0, 10)); 
      setStatusStartTime(now);
      
      if (prevVesselStatusRef.current !== null) {
        const statusLabels = { moving: 'En route', stationary: 'Immobile', offline: 'Perte réseau' };
        toast({
          title: "Changement d'état",
          description: `Navire ${statusLabels[currentEffectiveStatus as keyof typeof statusLabels]} à ${format(now, 'HH:mm', { locale: fr })}`,
        });

        if (isNotifyEnabled && mode === 'receiver') {
            let s = '';
            if (currentEffectiveStatus === 'moving' && notifySettings.moving) s = notifySounds.moving;
            if (currentEffectiveStatus === 'stationary' && notifySettings.stationary) s = notifySounds.stationary;
            if (currentEffectiveStatus === 'offline' && notifySettings.offline) s = notifySounds.offline;
            if (s) playAlertSound(s);
        }
      }
      
      prevVesselStatusRef.current = currentEffectiveStatus;
    }
  }, [currentEffectiveStatus, mode, currentPos, remoteVessel, lastValidLocation, isNotifyEnabled, notifySettings, notifySounds, playAlertSound, toast]);

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) {
      try { await wakeLock.release(); setWakeLock(null); toast({ title: "Écran libéré" }); } catch (e) { setWakeLock(null); }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil actif" });
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Permission bloquée", description: "Le mode éveil est limité par ce navigateur." });
      }
    }
  };

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    const docRef = doc(firestore, 'vessels', sharingId);
    setDoc(docRef, { 
      userId: user.uid, 
      displayName: user.displayName || 'Capitaine', 
      isSharing: isSharing, 
      lastActive: serverTimestamp(), 
      ...data 
    }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId]);

  useEffect(() => {
    if (!isSharing && user && firestore && sharingId) {
      const docRef = doc(firestore, 'vessels', sharingId);
      updateDoc(docRef, { isSharing: false, status: 'offline', lastActive: serverTimestamp() }).catch(() => {});
    }
  }, [isSharing, user, firestore, sharingId]);

  useEffect(() => {
    if (!isSharing || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    const syncBattery = async () => {
      if ('getBattery' in navigator) {
        const battery: any = await (navigator as any).getBattery();
        setBatteryLevel(battery.level);
        battery.onlevelchange = () => setBatteryLevel(battery.level);
      }
    };
    syncBattery();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const newPos = { lat: newLat, lng: newLng };
        const now = Date.now();
        setCurrentPos(newPos);
        setLastValidLocation(newPos);
        if (!anchorPos) {
          setAnchorPos(newPos);
          setLastMovementTime(now);
          updateVesselInFirestore({ 
            location: { latitude: newLat, longitude: newLng }, 
            status: 'moving', 
            isSharing: true,
            batteryLevel: batteryLevel 
          });
          lastFirestoreUpdateRef.current = now;
          return;
        }
        
        // Calcul de la distance par rapport au point d'ancrage
        const dist = getDistance(newLat, newLng, anchorPos.lat, anchorPos.lng);
        
        if (dist > IMMOBILITY_THRESHOLD_METERS) {
          // Repassage en mouvement si on sort du rayon de 20m
          setVesselStatus('moving');
          setAnchorPos(newPos);
          setLastMovementTime(now);
          if (now - lastFirestoreUpdateRef.current > THROTTLE_UPDATE_MS) {
            updateVesselInFirestore({ 
              location: { latitude: newLat, longitude: newLng }, 
              status: 'moving', 
              isSharing: true,
              batteryLevel: batteryLevel 
            });
            lastFirestoreUpdateRef.current = now;
          }
        } else {
          // Détection d'immobilité prolongée
          const idle = (now - lastMovementTime) / 60000;
          if (idle >= IMMOBILITY_START_MINUTES && vesselStatus === 'moving') {
            setVesselStatus('stationary');
            updateVesselInFirestore({ status: 'stationary', isSharing: true, batteryLevel: batteryLevel });
            lastFirestoreUpdateRef.current = now;
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, anchorPos, vesselStatus, lastMovementTime, updateVesselInFirestore, batteryLevel]);

  useEffect(() => {
    if (mode === 'receiver' && remoteVessel?.location) {
      setLastValidLocation({ lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude });
    }
  }, [mode, remoteVessel]);

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : lastValidLocation);
    if (pos && map) { map.panTo(pos); map.setZoom(15); }
  };

  const copyCoordinates = (lat: number, lng: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)},${lng.toFixed(6)}`);
    toast({ title: "Copié" });
  };

  const sendEmergencySms = (lat: number, lng: number, name: string) => {
    if (!emergencyContact.trim()) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const url = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
    const body = `ALERTE : ${name} en difficulté. Position : ${url}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const displayVessel = mode === 'sender' 
    ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: 'Moi', isSharing: true, batteryLevel } : null) 
    : remoteVessel;

  const isBatteryDischarged = mode === 'receiver' && remoteVessel && !remoteVessel.isSharing && (remoteVessel.batteryLevel ?? 1) <= 0.05;

  const BatteryIconComp = ({ level, className }: { level?: number, className?: string }) => {
    if (level === undefined) return null;
    if (level > 0.6) return <BatteryFull className={cn("size-4 text-green-500", className)} />;
    if (level > 0.2) return <BatteryMedium className={cn("size-4 text-orange-500", className)} />;
    return <BatteryLow className={cn("size-4 text-red-500 animate-pulse", className)} />;
  };

  const lastActiveTime = remoteVessel?.lastActive ? format(remoteVessel.lastActive.toDate(), 'HH:mm', { locale: fr }) : '--:--';

  return (
    <div className="space-y-6 pb-12">
      {isWatchAlerting && (
        <div className="fixed top-0 inset-x-0 z-[200] p-4 bg-red-600 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="max-w-md mx-auto flex flex-col items-center gap-4 text-white">
            <ShieldAlert className="size-10 animate-pulse" />
            <p className="font-black uppercase text-lg">ALERTE SURVEILLANCE</p>
            <Button className="w-full bg-white text-red-600 font-black h-16 rounded-xl" onClick={() => setIsWatchAlerting(false)}>ARRÊTER</Button>
          </div>
        </div>
      )}

      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase tracking-tighter"><Navigation className="text-primary size-5" /> Vessel Tracker</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex bg-muted/50 p-1 rounded-xl border">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-bold h-10 rounded-lg" onClick={() => setMode('sender')}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-bold h-10 rounded-lg" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          </div>

          <div className="space-y-6">
            {mode === 'sender' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card shadow-sm">
                  <div className="space-y-0.5"><Label className="text-base font-black uppercase leading-none">Partager ma position</Label><p className="text-[9px] text-muted-foreground uppercase font-bold">Flux GPS live</p></div>
                  <Switch checked={isSharing} onCheckedChange={setIsSharing} className="scale-110" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">ID de partage personnalisé</Label>
                  <div className="flex gap-2">
                    <Input placeholder="ID..." value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} disabled={isSharing} className="font-black text-center uppercase h-12 border-2 rounded-xl" />
                    <Button variant="outline" size="icon" className="h-12 w-12 border-2 rounded-xl" onClick={handleSaveCustomId} disabled={isSharing}><Save className="size-5" /></Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Navire à suivre (ID)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center uppercase h-12 border-2 rounded-xl" />
                    <Button variant="secondary" size="icon" className="h-12 w-12 border-2 rounded-xl" onClick={() => { if(vesselIdToFollow) addToHistory(vesselIdToFollow); }}><Plus className="size-5" /></Button>
                  </div>
                </div>
              </div>
            )}

            {vesselHistory.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Historique des IDs</Label>
                <div className="flex flex-wrap gap-2 px-1">
                  {vesselHistory.map(id => (
                    <Badge key={id} variant="secondary" className="pl-3 pr-1 h-8 font-black text-[10px] cursor-pointer rounded-full bg-muted/50 hover:bg-muted" onClick={() => mode === 'sender' ? setCustomSharingId(id) : setVesselIdToFollow(id)}>
                      {id} 
                      <button onClick={(e) => { e.stopPropagation(); removeFromHistory(id); }} className="ml-2 p-1 hover:bg-black/10 rounded-full">
                        <Trash2 className="size-3 text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button variant={wakeLock ? "secondary" : "outline"} className={cn("w-full gap-2 font-black h-12 border-2 text-xs uppercase tracking-widest rounded-xl", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>

            {mode === 'receiver' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card shadow-sm">
                    <div className="flex items-center gap-3"><Bell className={cn("size-5", isNotifyEnabled && "text-primary fill-current")} /><Label className="font-black uppercase text-sm">Alertes Sonores</Label></div>
                    <Switch checked={isNotifyEnabled} onCheckedChange={setIsNotifyEnabled} className="scale-110" />
                </div>
                {isNotifyEnabled && (
                  <div className="p-4 border-2 rounded-2xl bg-muted/20 space-y-6 shadow-inner animate-in fade-in">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1"><span className="text-[10px] font-black uppercase text-muted-foreground">Volume</span><span className="font-black text-primary text-xs">{Math.round(vesselVolume * 100)}%</span></div>
                        <Slider value={[vesselVolume]} min={0} max={1} step={0.1} onValueChange={v => setVesselVolume(v[0])} />
                    </div>
                    <Accordion type="single" collapsible className="space-y-2">
                        <AccordionItem value="sounds" className="border-none rounded-xl bg-card overflow-hidden shadow-sm">
                            <AccordionTrigger className="text-[10px] font-black uppercase px-4 h-10 hover:no-underline bg-muted/10">Configuration des sons</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-t border-dashed">
                                {['moving', 'stationary', 'offline'].map(st => (
                                    <div key={st} className="space-y-2">
                                        <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase opacity-60">{st === 'moving' ? 'En route' : st === 'stationary' ? 'Immobile' : 'Perte réseau'}</Label><Switch checked={(notifySettings as any)[st]} onCheckedChange={val => setNotifySettings({...notifySettings, [st]: val})} /></div>
                                        <div className="flex gap-2">
                                          <Select value={(notifySounds as any)[st]} onValueChange={v => setNotifySounds({...notifySounds, [st]: v})}>
                                            <SelectTrigger className="h-10 text-xs border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                          </Select>
                                          <Button variant="outline" size="icon" className="h-10 w-10 border-2 rounded-xl" onClick={() => playAlertSound((notifySounds as any)[st])}><Play className="size-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="watch" className="border-none rounded-xl bg-card overflow-hidden shadow-sm">
                            <AccordionTrigger className="text-[10px] font-black uppercase px-4 h-10 hover:no-underline bg-muted/10">Veille critique</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-t border-dashed">
                                <div className="flex items-center justify-between"><Label className="text-xs font-black uppercase">Activer</Label><Switch checked={isWatchEnabled} onCheckedChange={setIsWatchEnabled} /></div>
                                {isWatchEnabled && (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Statut</Label><Select value={watchType} onValueChange={v => setWatchType(v as any)}><SelectTrigger className="h-10 text-xs border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stationary">Immobile</SelectItem><SelectItem value="moving">En mouvement</SelectItem><SelectItem value="offline">Perte réseau</SelectItem></SelectContent></Select></div>
                                        <div className="space-y-1"><div className="flex justify-between"><Label className="text-[10px] font-bold uppercase opacity-60">Durée</Label><span className="text-[10px] font-black">{watchDuration} min</span></div><Slider value={[watchDuration]} min={1} max={60} step={1} onValueChange={v => setWatchDuration(v[0])} /></div>
                                        <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Son</Label><Select value={watchSound} onValueChange={v => setWatchSound(v)}><SelectTrigger className="h-10 text-xs border-2"><SelectValue /></SelectTrigger><SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-2 shadow-xl rounded-2xl flex flex-col">
        <div className="h-[350px] relative bg-muted/20 shrink-0">
          {!isLoaded ? <Skeleton className="h-full w-full" /> : (
            <GoogleMap mapContainerClassName="w-full h-full" center={displayVessel?.location ? { lat: displayVessel.location.latitude, lng: displayVessel.location.longitude } : (lastValidLocation || { lat: -22.27, lng: 166.45 })} zoom={15} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}>
                {currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><div style={{ transform: 'translate(-50%, -50%)' }}><div className="size-4 bg-blue-500 rounded-full border-2 border-white shadow-2xl animate-pulse"></div></div></OverlayView>}
                {displayVessel?.location && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded shadow-2xl text-[10px] font-black whitespace-nowrap border border-white/20 flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", displayVessel.status === 'moving' ? "bg-green-400 animate-pulse" : "bg-amber-400")}></span>
                        {displayVessel.displayName}
                        {displayVessel.batteryLevel !== undefined && (
                          <span className="flex items-center gap-1 ml-1 border-l border-white/20 pl-1">
                            <BatteryIconComp level={displayVessel.batteryLevel} />
                            {Math.round(displayVessel.batteryLevel * 100)}%
                          </span>
                        )}
                        </div>
                        <div className={cn("p-2 rounded-full shadow-2xl border-2 border-white transition-all", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                        {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
            </GoogleMap>
          )}
          <Button size="icon" className="absolute top-3 right-3 shadow-lg h-10 w-10 bg-background/90 border-2 rounded-xl" onClick={handleRecenter}><LocateFixed className="size-5" /></Button>
        </div>

        {isBatteryDischarged && (
          <div className="bg-red-600 text-white p-6 flex flex-col items-center text-center gap-3 animate-pulse border-y-4 border-red-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <AlertOctagon className="size-12" />
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Batterie Déchargée</h3>
              <p className="text-xs font-bold opacity-90 mt-1 uppercase">Signal perdu à {lastActiveTime}</p>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-lg border border-white/30 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase">Le téléphone émetteur s'est probablement éteint.</p>
            </div>
          </div>
        )}

        <div className="bg-card border-t-2 p-4 flex flex-col gap-3">
            <div className={cn(
                "flex items-center justify-between p-3 rounded-xl border shadow-sm transition-all duration-500",
                currentEffectiveStatus === 'moving' ? "bg-green-50/50 border-green-200" : currentEffectiveStatus === 'stationary' ? "bg-amber-50/50 border-amber-200" : "bg-red-50/50 border-red-200"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center text-white shadow-sm",
                        currentEffectiveStatus === 'moving' ? "bg-green-600" : currentEffectiveStatus === 'stationary' ? "bg-amber-600" : "bg-red-600"
                    )}>
                        {currentEffectiveStatus === 'moving' ? <Move className="size-5" /> : currentEffectiveStatus === 'stationary' ? <Anchor className="size-5" /> : <WifiOff className="size-5" />}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                              "font-black text-sm uppercase tracking-tighter",
                              currentEffectiveStatus === 'moving' ? "text-green-700" : currentEffectiveStatus === 'stationary' ? "text-amber-700" : "text-red-700"
                          )}>
                              {currentEffectiveStatus === 'moving' ? 'En mouvement' : currentEffectiveStatus === 'stationary' ? 'Immobile' : 'Hors ligne'}
                          </p>
                          {displayVessel?.batteryLevel !== undefined && <BatteryIconComp level={displayVessel.batteryLevel} className="size-3 opacity-80" />}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/70">
                            <Clock className="size-3" /> depuis {elapsedString}
                        </div>
                    </div>
                </div>
                {displayVessel?.isSharing && (
                    <Badge className={cn(
                        "font-black uppercase text-[9px] border-none px-2 h-5 flex items-center justify-center",
                        currentEffectiveStatus === 'moving' ? "bg-green-600" : "bg-amber-600"
                    )}>LIVE</Badge>
                )}
            </div>

            <div className="p-3 bg-muted/20 border rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Dernière position connue</p>
                    <p className="font-mono text-xs font-bold">
                        {lastValidLocation ? `${lastValidLocation.lat.toFixed(6)}, ${lastValidLocation.lng.toFixed(6)}` : "Recherche GPS..."}
                    </p>
                </div>
                {lastValidLocation && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => copyCoordinates(lastValidLocation.lat, lastValidLocation.lng)}>
                        <Copy className="size-4" />
                    </Button>
                )}
            </div>

            {/* Historique des événements selon le modèle utilisateur */}
            {statusEvents.length > 0 && (
              <div className="mt-2 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                  <History className="size-3" /> Historique des états
                </h4>
                <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                  {statusEvents.map((event, idx) => {
                    const label = event.status === 'moving' ? 'MOUVEMENT' : event.status === 'stationary' ? 'MOUILLAGE' : 'SIGNAL PERDU';
                    const color = event.status === 'moving' ? 'text-green-600' : event.status === 'stationary' ? 'text-amber-600' : 'text-red-600';
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 border-b last:border-0 text-[11px] animate-in fade-in slide-in-from-left-2">
                        <div className="flex items-center gap-4">
                          <span className="font-bold tabular-nums text-muted-foreground/60">{format(event.timestamp, 'HH:mm:ss')}</span>
                          <span className={cn("font-black uppercase tracking-tight", color)}>{label}</span>
                        </div>
                        {event.location && (
                          <button 
                            className="flex items-center gap-1 text-primary/60 hover:text-primary font-bold"
                            onClick={() => {
                              const url = `https://www.google.com/maps?q=${event.location!.lat},${event.location!.lng}`;
                              window.open(url, '_blank');
                            }}
                          >
                            GPS <ExternalLink className="size-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
        
        <CardFooter className="bg-muted/10 p-4 flex flex-col gap-4 border-t-2">
          <div className="w-full space-y-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full h-14 bg-red-600 text-sm font-black shadow-lg flex items-center justify-center gap-2 uppercase rounded-xl border-b-4 border-red-800 transition-all active:scale-95" disabled={!lastValidLocation}>
                  <ShieldAlert className="size-6" /> ALERTE SMS
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-2">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black uppercase tracking-tighter text-left">Confirmer l'alerte ?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-medium leading-relaxed text-left">
                    Cela enverra immédiatement un SMS de détresse avec votre position GPS à <span className="font-bold text-foreground">{emergencyContact || "votre contact d'urgence"}</span>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-row gap-3 pt-2">
                  <AlertDialogCancel className="flex-1 h-12 font-black uppercase text-xs rounded-xl border-2">Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs rounded-xl"
                    onClick={() => lastValidLocation && sendEmergencySms(lastValidLocation.lat, lastValidLocation.lng, displayVessel?.displayName || 'Capitaine')}
                  >
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="space-y-3">
              <div className="bg-white/80 p-4 rounded-xl border-2 border-dashed text-[10px] space-y-2">
                <div className="flex justify-between font-black uppercase text-red-600"><span>MRCC Secours en Mer</span><span>196 / VHF 16</span></div>
                <div className="flex items-start gap-2 bg-red-50 p-2 rounded border border-red-100 italic">
                  <Info className="size-3 text-red-600 shrink-0 mt-0.5" />
                  <p>Utilisez le <strong>CANAL 16</strong> de la VHF en priorité. Le 196 est idéal pour les appels depuis la terre ferme.</p>
                </div>
                <div className="flex justify-between opacity-70"><span>SAMU - SOS Médecins</span><span className="font-bold">15</span></div>
                <div className="flex justify-between opacity-70"><span>SNSM Nouméa</span><span className="font-bold">25.23.12</span></div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Contact d'urgence :</Label>
                <div className="flex gap-2">
                  <input type="tel" placeholder="Numéro..." value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="flex h-12 w-full rounded-xl border-2 bg-white px-4 text-sm font-black" />
                  <Button variant="secondary" size="icon" className="h-12 w-12 border-2 rounded-xl" onClick={handleSaveEmergencyContact}><Save className="size-5" /></Button>
                </div>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}