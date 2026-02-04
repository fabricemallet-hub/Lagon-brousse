
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Navigation, 
  Anchor, 
  WifiOff, 
  Move, 
  AlertTriangle, 
  Copy, 
  LocateFixed, 
  ShieldAlert,
  Wifi,
  Phone,
  Save,
  Zap,
  Bell,
  BellOff,
  Volume2,
  Settings2,
  Play,
  Clock,
  CheckCircle2,
  Timer,
  History,
  Trash2,
  Pencil,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

// Constants
const IMMOBILITY_THRESHOLD_METERS = 15;
const IMMOBILITY_START_MINUTES = 5;
const IMMOBILITY_UPDATE_MINUTES = 30;
const THROTTLE_UPDATE_MS = 10000; // Update Firestore at most once every 10s during movement

const defaultVesselSounds = [
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'sonar', label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3' },
];

// Helper: Calculate distance between two points (Haversine)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
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

  // Mode: 'sender' (A) or 'receiver' (B)
  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  
  // Custom Sender ID
  const [customSharingId, setCustomSharingId] = useState('');
  
  // Receiver History
  const [vesselHistory, setVesselHistory] = useState<string[]>([]);

  // Sound Library from Firestore
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

  // Load local data
  useEffect(() => {
    const savedHistory = localStorage.getItem('vessel_follow_history');
    if (savedHistory) setVesselHistory(JSON.parse(savedHistory));
    
    const savedCustomId = localStorage.getItem('vessel_custom_id');
    if (savedCustomId) setCustomSharingId(savedCustomId);
  }, []);

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

  const clearHistory = () => {
    setVesselHistory([]);
    localStorage.removeItem('vessel_follow_history');
    toast({ title: "Historique effacé" });
  };

  const handleSaveCustomId = () => {
    const id = customSharingId.trim();
    localStorage.setItem('vessel_custom_id', id);
    toast({ title: "Identifiant enregistré", description: `Votre ID de partage est désormais : ${id || 'votre UID'}` });
  };

  // Notification State (Receiver)
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [vesselVolume, setVesselVolume] = useState(0.8);
  const [notifySettings, setNotifySettings] = useState({
    moving: true,
    stationary: true,
    offline: true
  });
  const [notifySounds, setNotifySounds] = useState({
    moving: 'cloche',
    stationary: 'sonar',
    offline: 'alerte'
  });
  const prevVesselStatusRef = useRef<string | null>(null);

  // Advanced Timed Watch State
  const [isWatchEnabled, setIsWatchEnabled] = useState(false);
  const [watchType, setWatchType] = useState<'moving' | 'stationary' | 'offline'>('stationary');
  const [watchDuration, setWatchDuration] = useState(15);
  const [watchSound, setWatchSound] = useState('alerte');
  const [isWatchAlerting, setIsWatchAlerting] = useState(false);
  const [statusStartTime, setStatusStartTime] = useState<number | null>(null);
  const watchRepeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tracking State (Sender)
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<number>(Date.now());
  const [lastHistoryUpdateTime, setLastHistoryUpdateTime] = useState<number>(0);
  const [vesselStatus, setVesselStatus] = useState<'moving' | 'stationary'>('moving');
  const [isOnline, setIsOnline] = useState(true);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  
  // Background/WakeLock State
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const lastFirestoreUpdateRef = useRef<number>(0);

  // User Profile Sync
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

  // Final Sharing ID logic
  const sharingId = customSharingId.trim() || user?.uid || '';

  // Firestore Sync (Receiver)
  const vesselRef = useMemoFirebase(() => {
    const cleanId = vesselIdToFollow.trim();
    if (!firestore || mode !== 'receiver' || !cleanId) return null;
    return doc(firestore, 'vessels', cleanId);
  }, [firestore, mode, vesselIdToFollow]);
  const { data: remoteVessel, isLoading: isVesselLoading } = useDoc<VesselStatus>(vesselRef);

  // sound notification logic
  const playAlertSound = useCallback((soundId: string) => {
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselVolume;
      audio.play().catch(e => console.warn("Audio playback failed:", e));
    }
  }, [vesselVolume, availableSounds]);

  // --- RECEIVER WATCH LOGIC ---
  useEffect(() => {
    if (mode !== 'receiver' || !remoteVessel) return;

    const currentStatus = remoteVessel.status;

    // Reset timer if status changes
    if (currentStatus !== prevVesselStatusRef.current) {
      setStatusStartTime(Date.now());
      setIsWatchAlerting(false); // Reset alert on state change
    }

    // Standard notifications
    if (isNotifyEnabled) {
      if (prevVesselStatusRef.current !== null && prevVesselStatusRef.current !== currentStatus) {
        let soundToPlay = '';
        if (currentStatus === 'moving' && notifySettings.moving) soundToPlay = notifySounds.moving;
        if (currentStatus === 'stationary' && notifySettings.stationary) soundToPlay = notifySounds.stationary;
        if (currentStatus === 'offline' && notifySettings.offline) soundToPlay = notifySounds.offline;

        if (soundToPlay) {
          playAlertSound(soundToPlay);
          toast({ 
            title: "Changement d'état détecté", 
            description: `Le navire est maintenant : ${currentStatus === 'moving' ? 'En mouvement' : currentStatus === 'stationary' ? 'Stationnaire' : 'Hors-ligne'}`,
            variant: currentStatus === 'offline' ? "destructive" : "default"
          });
        }
      }
    }
    prevVesselStatusRef.current = currentStatus;
  }, [remoteVessel, mode, isNotifyEnabled, notifySettings, notifySounds, playAlertSound, toast]);

  // Check Watch Duration
  useEffect(() => {
    if (mode !== 'receiver' || !isWatchEnabled || isWatchAlerting || !statusStartTime || !remoteVessel) return;

    const checkInterval = setInterval(() => {
      if (remoteVessel.status === watchType) {
        const elapsedMinutes = (Date.now() - statusStartTime) / 60000;
        if (elapsedMinutes >= watchDuration) {
          setIsWatchAlerting(true);
          toast({ 
            variant: "destructive",
            title: "SURVEILLANCE CRITIQUE", 
            description: `Le navire est en état "${watchType}" depuis plus de ${watchDuration} minutes.` 
          });
        }
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [mode, isWatchEnabled, isWatchAlerting, statusStartTime, watchType, watchDuration, remoteVessel, toast]);

  // Handle Repeating Sound for Watch Alert
  useEffect(() => {
    if (isWatchAlerting) {
      playAlertSound(watchSound);
      watchRepeatIntervalRef.current = setInterval(() => {
        playAlertSound(watchSound);
      }, 10000);
    } else {
      if (watchRepeatIntervalRef.current) {
        clearInterval(watchRepeatIntervalRef.current);
        watchRepeatIntervalRef.current = null;
      }
    }
    return () => { if (watchRepeatIntervalRef.current) clearInterval(watchRepeatIntervalRef.current); };
  }, [isWatchAlerting, watchSound, playAlertSound]);

  const handleStopWatchAlert = () => {
    setIsWatchAlerting(false);
    setStatusStartTime(Date.now());
    toast({ title: "Alerte acquittée", description: "Le minuteur de surveillance a été réinitialisé." });
  };

  // Online detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Mode Éveil (Wake Lock)
  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      toast({ variant: "destructive", title: "Non supporté", description: "Votre navigateur ne supporte pas le maintien de l'écran allumé." });
      return;
    }

    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        toast({ title: "Mode éveil désactivé" });
      } catch (e) {
        setWakeLock(null);
      }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil activé", description: "L'écran restera allumé." });
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Permission bloquée", description: "Le mode éveil est bloqué par cet environnement (iframe)." });
      }
    }
  };

  // --- SENDER LOGIC (USER A) ---
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    const docRef = doc(firestore, 'vessels', sharingId);
    setDoc(docRef, {
        userId: user.uid,
        displayName: user.displayName || 'Capitaine',
        isSharing: true,
        lastActive: serverTimestamp(),
        ...data
    }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId]);

  const addImmobilityHistory = useCallback((pos: google.maps.LatLngLiteral, duration: number) => {
    if (!user || !firestore) return;
    const colRef = collection(firestore, 'vessels', sharingId, 'history');
    addDoc(colRef, {
        timestamp: serverTimestamp(),
        location: { latitude: pos.lat, longitude: pos.lng },
        durationMinutes: duration
    }).catch(() => {});
  }, [user, firestore, sharingId]);

  // Center map effect
  useEffect(() => {
    if (!isLoaded || !map || !hasInitialCentered) {
      if (mode === 'sender' && currentPos) {
        map?.panTo(currentPos);
        map?.setZoom(15);
        setHasInitialCentered(true);
      } else if (mode === 'receiver' && remoteVessel?.location) {
        map?.panTo({ lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude });
        map?.setZoom(15);
        setHasInitialCentered(true);
      }
    }
  }, [isLoaded, map, currentPos, remoteVessel?.location, hasInitialCentered, mode]);

  // GPS Tracking effect
  useEffect(() => {
    if (!isSharing || !navigator.geolocation) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
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
          const idleTimeMinutes = (now - lastMovementTime) / 60000;
          if (idleTimeMinutes >= IMMOBILITY_START_MINUTES && vesselStatus === 'moving') {
            setVesselStatus('stationary');
            updateVesselInFirestore({ status: 'stationary' });
            addImmobilityHistory(newPos, Math.round(idleTimeMinutes));
            setLastHistoryUpdateTime(now);
            lastFirestoreUpdateRef.current = now;
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, anchorPos, vesselStatus, lastMovementTime, lastHistoryUpdateTime, updateVesselInFirestore, addImmobilityHistory]);

  const handleRecenter = () => {
    if (mode === 'sender' && currentPos && map) {
        map.panTo(currentPos);
        map.setZoom(15);
    } else if (mode === 'receiver' && remoteVessel?.location && map) {
        map.panTo({ lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude });
        map.setZoom(15);
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (map) map.panTo(coords);
        });
    }
  };

  const copyCoordinates = (lat: number, lng: number) => {
    const text = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Coordonnées copiées", description: text });
  };

  const sendEmergencySms = (lat: number, lng: number, name: string) => {
    if (!emergencyContact.trim()) {
      toast({ variant: "destructive", title: "Numéro requis", description: "Veuillez saisir le numéro de votre contact d'urgence." });
      return;
    }
    const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const googleMapsUrl = `https://www.google.com/maps?q=${coords}`;
    const cleanName = name === 'Ma Position' ? (user?.displayName || 'Capitaine') : name;
    const bodyText = `ALERTE : ${cleanName} est en difficulté en mer. Position : ${googleMapsUrl}`;
    const target = emergencyContact.replace(/\s/g, '');
    window.location.href = `sms:${target}?body=${encodeURIComponent(bodyText)}`;
  };

  const shouldShowMap = mode === 'sender' ? isSharing : (mode === 'receiver');

  const displayVessel = mode === 'sender' 
    ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: isOnline ? vesselStatus : 'offline', displayName: 'Ma Position' } : null) 
    : remoteVessel;

  return (
    <div className="space-y-6">
      {isWatchAlerting && (
        <div className="fixed top-0 left-0 right-0 z-[200] p-4 bg-red-600 animate-in fade-in slide-in-from-top-4">
          <div className="max-w-md mx-auto flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-white">
              <ShieldAlert className="size-8 animate-pulse" />
              <div className="text-center">
                <p className="font-black uppercase text-lg tracking-tighter">ALERTE SURVEILLANCE</p>
                <p className="text-xs font-bold opacity-90">Dépassement de durée pour l'état : {watchType}</p>
              </div>
            </div>
            <Button className="w-full bg-white text-red-600 font-black h-14" onClick={handleStopWatchAlert}>ARRÊTER L'ALERTE</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Navigation className="text-primary" /> Vessel Tracker NC</CardTitle>
          <CardDescription>Partage de position haute-fidélité pour la sécurité en mer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex bg-muted p-1 rounded-lg">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1" onClick={() => { setMode('sender'); setHasInitialCentered(false); }}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1" onClick={() => { setMode('receiver'); setHasInitialCentered(false); }}>Récepteur (B)</Button>
          </div>

          {mode === 'sender' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-0.5"><Label className="text-base">Partager ma position</Label><p className="text-sm text-muted-foreground">Suivi en temps réel</p></div>
                <Switch checked={isSharing} onCheckedChange={setIsSharing} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">ID de partage personnalisé</Label>
                <div className="flex gap-2">
                  <Input placeholder="Mon-Bateau-123" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} disabled={isSharing} className="font-mono text-xs uppercase" />
                  <Button variant="outline" size="icon" onClick={handleSaveCustomId} disabled={isSharing}><Save className="size-4" /></Button>
                </div>
              </div>
              <Button variant={wakeLock ? "secondary" : "outline"} size="sm" className={cn("w-full gap-2 font-bold h-11 border-2", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">ID du navire à suivre</Label>
                <div className="flex gap-2">
                  <Input placeholder="Coller l'ID ici..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-mono text-xs uppercase" />
                  <Button variant="secondary" size="icon" onClick={() => { if(vesselIdToFollow) addToHistory(vesselIdToFollow); }}><Plus className="size-4" /></Button>
                </div>
              </div>
              {vesselHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1"><Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1"><History className="size-3" /> Historique</Label><Button variant="ghost" className="h-5 px-2 text-[9px] font-bold" onClick={clearHistory}>Effacer</Button></div>
                  <div className="flex flex-col gap-1.5">
                    {vesselHistory.map(id => (
                      <div key={id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 group">
                        <button className="flex-1 text-left font-mono text-[10px] truncate" onClick={() => { setVesselIdToFollow(id); setHasInitialCentered(false); }}>{id}</button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeFromHistory(id)}><Trash2 className="size-3" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button variant={wakeLock ? "secondary" : "outline"} size="sm" className={cn("w-full gap-2 font-bold h-11 border-2", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "GARDER L'ÉCRAN ALLUMÉ"}</Button>
              <Button variant={isNotifyEnabled ? "secondary" : "outline"} size="sm" className={cn("w-full gap-2 font-bold h-11 border-2", isNotifyEnabled && "bg-primary/10 text-primary border-primary")} onClick={() => setIsNotifyEnabled(!isNotifyEnabled)}>{isNotifyEnabled ? <Bell className="size-4 fill-current" /> : <BellOff className="size-4" />}{isNotifyEnabled ? "NOTIFICATIONS ACTIVES" : "ACTIVER ALERTES SONORES"}</Button>
              
              {isNotifyEnabled && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between"><Label className="text-sm font-bold flex items-center gap-2"><Move className="size-4 text-blue-500" /> Mouvement</Label><Switch checked={notifySettings.moving} onCheckedChange={(val) => setNotifySettings({...notifySettings, moving: val})} /></div>
                  <div className="flex items-center justify-between"><Label className="text-sm font-bold flex items-center gap-2"><Anchor className="size-4 text-amber-500" /> Immobilisation</Label><Switch checked={notifySettings.stationary} onCheckedChange={(val) => setNotifySettings({...notifySettings, stationary: val})} /></div>
                  <div className="flex items-center justify-between"><Label className="text-sm font-bold flex items-center gap-2"><WifiOff className="size-4 text-destructive" /> Perte Réseau</Label><Switch checked={notifySettings.offline} onCheckedChange={(val) => setNotifySettings({...notifySettings, offline: val})} /></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {shouldShowMap && (
        <Card className="overflow-hidden">
          <div className="h-96 relative">
            {mode === 'receiver' && isVesselLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-sm"><Skeleton className="h-full w-full" /><p className="absolute font-black text-xs uppercase tracking-widest text-primary animate-pulse">Connexion...</p></div>
            )}
            {mode === 'receiver' && !isVesselLoading && !remoteVessel && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 gap-2 p-4 text-center">
                <WifiOff className="size-10 text-destructive opacity-50 mb-2" />
                <p className="font-black uppercase tracking-tighter text-base">Navire introuvable</p>
              </div>
            )}
            <GoogleMap
              mapContainerClassName="w-full h-full"
              center={displayVessel?.location ? { lat: displayVessel.location.latitude, lng: displayVessel.location.longitude } : { lat: -22.27, lng: 166.45 }}
              zoom={15}
              onLoad={setMap}
              options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}
            >
              {displayVessel?.location && (
                <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                    <div className="px-2 py-1 bg-white/90 backdrop-blur rounded shadow-lg text-xs font-bold whitespace-nowrap border flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", displayVessel.status === 'moving' ? "bg-blue-500 animate-pulse" : displayVessel.status === 'stationary' ? "bg-amber-500" : "bg-destructive")}></span>
                      {displayVessel.displayName}
                    </div>
                    <div className={cn("p-2 rounded-full shadow-xl border-2 border-white", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                      {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                    </div>
                  </div>
                </OverlayView>
              )}
            </GoogleMap>
            <Button size="icon" className="absolute top-4 right-4 shadow-lg h-10 w-10 z-10 bg-background/80 backdrop-blur-sm" onClick={handleRecenter}><LocateFixed className="size-5" /></Button>
          </div>
          <CardFooter className="bg-muted/30 p-4 flex flex-col gap-4">
            {displayVessel && (
              <div className="w-full grid grid-cols-1 gap-2">
                <Button variant="outline" className="text-xs h-10 border-2" onClick={() => copyCoordinates(displayVessel.location.latitude, displayVessel.location.longitude)}><Copy className="size-4 mr-2" /> Copier les coordonnées GPS</Button>
                <Button variant="destructive" className="w-full h-14 bg-red-600 hover:bg-red-700 text-base font-black shadow-lg flex items-center justify-center gap-3 uppercase tracking-tighter" onClick={() => sendEmergencySms(displayVessel.location.latitude, displayVessel.location.longitude, displayVessel.displayName)}><ShieldAlert className="size-6" /> ENVOYER ALERTE SMS</Button>
              </div>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
