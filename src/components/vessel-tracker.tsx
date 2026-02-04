
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
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
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

// Constants
const IMMOBILITY_THRESHOLD_METERS = 15;
const IMMOBILITY_START_MINUTES = 5;
const IMMOBILITY_UPDATE_MINUTES = 30;
const THROTTLE_UPDATE_MS = 10000; // Update Firestore at most once every 10s during movement

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
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // Mode: 'sender' (A) or 'receiver' (B)
  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);
  
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

  // Firestore Sync (Receiver)
  const vesselRef = useMemoFirebase(() => {
    if (!firestore || mode !== 'receiver' || !vesselIdToFollow) return null;
    return doc(firestore, 'vessels', vesselIdToFollow);
  }, [firestore, mode, vesselIdToFollow]);
  const { data: remoteVessel, isLoading: isVesselLoading } = useDoc<VesselStatus>(vesselRef);

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
      toast({ 
        variant: "destructive", 
        title: "Non supporté", 
        description: "Votre navigateur ne supporte pas le maintien de l'écran allumé." 
      });
      return;
    }

    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      toast({ title: "Mode éveil désactivé", description: "L'écran peut désormais se mettre en veille." });
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        toast({ title: "Mode éveil activé", description: "L'écran restera allumé pour garantir le suivi GPS." });
        
        lock.addEventListener('release', () => {
          setWakeLock(null);
        });
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  // Réactiver WakeLock au retour sur l'app
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (e) {
          console.error(e);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLock]);

  const handleSaveEmergencyContact = async () => {
    if (!user || !firestore) return;
    setIsSavingContact(true);
    const docRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(docRef, { emergencyContact: emergencyContact });
      toast({ title: "Contact enregistré", description: "Le numéro sera conservé pour vos prochaines sorties." });
    } catch (e: any) {
      console.error(e);
      if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { emergencyContact: emergencyContact }
        }));
      }
    } finally {
      setIsSavingContact(false);
    }
  };

  // --- SENDER LOGIC (USER A) ---
  
  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    const docRef = doc(firestore, 'vessels', user.uid);
    const updateData = {
        userId: user.uid,
        displayName: user.displayName || 'Capitaine',
        isSharing: true,
        lastActive: serverTimestamp(),
        ...data
    };
    
    setDoc(docRef, updateData, { merge: true }).catch(async (err) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [user, firestore, isSharing]);

  const addImmobilityHistory = useCallback((pos: google.maps.LatLngLiteral, duration: number) => {
    if (!user || !firestore) return;
    const colRef = collection(firestore, 'vessels', user.uid, 'history');
    const historyData = {
        timestamp: serverTimestamp(),
        location: { latitude: pos.lat, longitude: pos.lng },
        durationMinutes: duration
    };
    
    addDoc(colRef, historyData).catch(async (err) => {
        const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: historyData,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [user, firestore]);

  // Handle map centering
  useEffect(() => {
    if (isLoaded && map && currentPos && !hasInitialCentered) {
        map.panTo(currentPos);
        map.setZoom(15);
        setHasInitialCentered(true);
    }
  }, [isLoaded, map, currentPos, hasInitialCentered]);

  // Monitor position and mobility
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
          if (vesselStatus === 'stationary') {
            toast({ title: "Mouvement détecté", description: "Le bateau fait de nouveau route." });
          }
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
          } else if (vesselStatus === 'stationary') {
            const timeSinceLastLog = (now - lastHistoryUpdateTime) / 60000;
            if (timeSinceLastLog >= IMMOBILITY_UPDATE_MINUTES) {
              addImmobilityHistory(newPos, Math.round(idleTimeMinutes));
              setLastHistoryUpdateTime(now);
              updateVesselInFirestore({ lastActive: serverTimestamp() });
              lastFirestoreUpdateRef.current = now;
            }
          }
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isSharing, anchorPos, vesselStatus, lastMovementTime, lastHistoryUpdateTime, updateVesselInFirestore, addImmobilityHistory, toast]);

  // Sync offline status
  useEffect(() => {
    if (isSharing && !isOnline) {
      updateVesselInFirestore({ status: 'offline' });
    } else if (isSharing && isOnline) {
      updateVesselInFirestore({ status: vesselStatus });
    }
  }, [isOnline, isSharing, vesselStatus, updateVesselInFirestore]);

  const handleRecenter = () => {
    if (currentPos && map) {
        map.panTo(currentPos);
        map.setZoom(15);
    } else if (!navigator.geolocation) {
        toast({ variant: "destructive", title: "Erreur", description: "GPS non disponible." });
    } else {
        navigator.geolocation.getCurrentPosition((pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentPos(coords);
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
      toast({ 
        variant: "destructive", 
        title: "Numéro requis", 
        description: "Veuillez saisir le numéro de téléphone du contact à prévenir." 
      });
      return;
    }

    const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const googleMapsUrl = `https://www.google.com/maps?q=${coords}`;
    const cleanName = name === 'Ma Position' ? (user?.displayName || 'Capitaine') : name;
    
    const bodyText = `ALERTE Lagon&Brousse NC : ${cleanName} est en difficulté en mer.
Position : ${googleMapsUrl}
GPS : ${coords}
Secours mer : SNSM (+687 23.66.66) ou faites le 196 (CROSS).`;
    
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobileDevice = isIOS || isAndroid;
    const separator = isIOS ? '&' : '?';
    
    const target = emergencyContact.replace(/\s/g, '');
    const smsUrl = `sms:${target}${separator}body=${encodeURIComponent(bodyText)}`;
    
    toast({ 
      title: "Alerte en cours", 
      description: `Ouverture de l'application SMS pour prévenir ${target}.` 
    });

    if (isMobileDevice) {
      window.location.href = smsUrl;
    } else {
      console.log("Desktop fallback - SMS would be sent to:", target, "with body:", bodyText);
    }
  };

  if (loadError) return <Alert variant="destructive"><AlertTitle>Erreur de carte</AlertTitle></Alert>;
  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

  const displayVessel = mode === 'sender' 
    ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: isOnline ? vesselStatus : 'offline', displayName: 'Ma Position' } : null) 
    : remoteVessel;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="text-primary" /> Vessel Tracker NC
          </CardTitle>
          <CardDescription>Partage de position haute-fidélité pour la sécurité en mer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex bg-muted p-1 rounded-lg">
            <Button 
              variant={mode === 'sender' ? 'default' : 'ghost'} 
              className="flex-1" 
              onClick={() => { setMode('sender'); setHasInitialCentered(false); }}
            >
              Émetteur (A)
            </Button>
            <Button 
              variant={mode === 'receiver' ? 'default' : 'ghost'} 
              className="flex-1" 
              onClick={() => { setMode('receiver'); setHasInitialCentered(false); }}
            >
              Récepteur (B)
            </Button>
          </div>

          {mode === 'sender' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm">
                <div className="space-y-0.5">
                  <Label className="text-base">Partager ma position</Label>
                  <p className="text-sm text-muted-foreground">Activer le suivi en temps réel</p>
                </div>
                <Switch checked={isSharing} onCheckedChange={setIsSharing} />
              </div>

              <div className="pt-1">
                <Button 
                  variant={wakeLock ? "secondary" : "outline"} 
                  size="sm"
                  className={cn("w-full gap-2 font-bold h-11 border-2", wakeLock && "bg-primary/10 text-primary border-primary")}
                  onClick={toggleWakeLock}
                >
                  <Zap className={cn("size-4", wakeLock && "fill-current")} />
                  {wakeLock ? "MODE ÉVEIL ACTIF (Background)" : "ACTIVER MODE ÉVEIL (Background)"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1 italic leading-tight">
                  Empêche la mise en veille de votre smartphone pour garantir un suivi GPS ininterrompu même en arrière-plan.
                </p>
              </div>
              
              {isSharing && (
                <Alert className={cn(isOnline ? "border-green-200 bg-green-50" : "border-destructive/20 bg-destructive/5")}>
                  {isOnline ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-destructive" />}
                  <AlertTitle>{isOnline ? "En ligne" : "Réseau perdu"}</AlertTitle>
                  <AlertDescription>
                    {isOnline 
                      ? "Vos coordonnées sont transmises en temps réel." 
                      : "L'application synchronisera votre position dès le retour du réseau."}
                  </AlertDescription>
                </Alert>
              )}

              {isSharing && (
                <div className="p-4 border rounded-lg space-y-2">
                  <p className="text-sm font-medium">Votre ID de partage :</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted p-2 rounded font-mono text-center text-xs overflow-hidden truncate">{user?.uid}</code>
                    <Button variant="outline" size="icon" onClick={() => {
                      navigator.clipboard.writeText(user?.uid || '');
                      toast({ title: "ID copié !" });
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ID du navire à suivre</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Coller l'ID ici..." 
                    value={vesselIdToFollow} 
                    onChange={e => setVesselIdToFollow(e.target.value)} 
                  />
                </div>
              </div>

              <div className="pt-1">
                <Button 
                  variant={wakeLock ? "secondary" : "outline"} 
                  size="sm"
                  className={cn("w-full gap-2 font-bold h-11 border-2", wakeLock && "bg-primary/10 text-primary border-primary")}
                  onClick={toggleWakeLock}
                >
                  <Zap className={cn("size-4", wakeLock && "fill-current")} />
                  {wakeLock ? "MODE ÉVEIL ACTIF" : "GARDER L'ÉCRAN ALLUMÉ"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1 italic leading-tight">
                  Recommandé pour surveiller la position sur la carte sans que le téléphone ne se verrouille.
                </p>
              </div>

              {remoteVessel && (
                <Alert className={cn(
                  remoteVessel.status === 'moving' && "bg-blue-50 border-blue-200",
                  remoteVessel.status === 'stationary' && "bg-amber-50 border-amber-200",
                  remoteVessel.status === 'offline' && "bg-destructive/5 border-destructive/20"
                )}>
                  <div className="flex items-center gap-2">
                    {remoteVessel.status === 'moving' && <Move className="h-4 w-4 text-blue-600 animate-pulse" />}
                    {remoteVessel.status === 'stationary' && <Anchor className="h-4 w-4 text-amber-600" />}
                    {remoteVessel.status === 'offline' && <WifiOff className="h-4 w-4 text-destructive" />}
                    <AlertTitle>
                      {remoteVessel.status === 'moving' && "Le bateau est en mouvement"}
                      {remoteVessel.status === 'stationary' && "L'utilisateur n'a pas bougé depuis 5min"}
                      {remoteVessel.status === 'offline' && "L'utilisateur n'a plus de réseau internet"}
                    </AlertTitle>
                  </div>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {(mode === 'sender' ? isSharing : remoteVessel) && (
        <Card className="overflow-hidden">
          <div className="h-96 relative">
            <GoogleMap
              mapContainerClassName="w-full h-full"
              center={displayVessel?.location ? { lat: displayVessel.location.latitude, lng: displayVessel.location.longitude } : { lat: -22.27, lng: 166.45 }}
              zoom={15}
              onLoad={setMap}
              options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}
            >
              {displayVessel?.location && (
                <OverlayView
                  position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
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
            <Button size="icon" className="absolute top-4 right-4 shadow-lg" onClick={handleRecenter}>
              <LocateFixed className="size-5" />
            </Button>
          </div>
          <CardFooter className="bg-muted/30 p-4 flex flex-col gap-4">
            <div className="w-full grid grid-cols-1 gap-2">
              <Button variant="outline" className="text-sm h-10" onClick={() => copyCoordinates(displayVessel!.location.latitude, displayVessel!.location.longitude)}>
                <Copy className="size-4 mr-2" /> Copier les coordonnées GPS
              </Button>
            </div>

            <div className="w-full space-y-3 border-t pt-4 border-border/50">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="emergency-num" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Contact à prévenir (Proche / Famille)
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    title="Sauvegarder ce numéro"
                    onClick={handleSaveEmergencyContact}
                    disabled={isSavingContact}
                  >
                    <Save className={cn("h-4 w-4", isSavingContact && "animate-pulse")} />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input 
                    id="emergency-num"
                    type="tel"
                    placeholder="Numéro SMS..."
                    value={emergencyContact}
                    onChange={e => setEmergencyContact(e.target.value)}
                    className="bg-background h-12"
                  />
                </div>
              </div>
              
              <Button 
                variant="destructive" 
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-base font-bold shadow-lg flex items-center justify-center gap-3"
                onClick={() => sendEmergencySms(displayVessel!.location.latitude, displayVessel!.location.longitude, displayVessel!.displayName)}
              >
                <ShieldAlert className="size-6" /> ENVOYER ALERTE SMS
              </Button>

              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-lg space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-red-800 dark:text-red-300 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> RAPPEL SECOURS EN MER :
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 text-[11px] text-red-700 dark:text-red-400">
                    <p className="flex items-center gap-2">
                      <Phone className="size-3" /> SNSM : <span className="font-bold">+687 23.66.66</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="size-3" /> Urgence CROSS : <span className="font-bold text-sm">196</span> (Gratuit)
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-red-200/50 dark:border-red-800/50 pt-2">
                  <p className="text-[10px] font-bold text-red-800 dark:text-red-300 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> SECOURS TERRESTRES :
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 text-[11px] text-red-700 dark:text-red-400">
                    <p className="flex items-start gap-2">
                      <Phone className="size-3 mt-0.5" /> 
                      <span><span className="font-bold">SAMU (15) :</span> Malaise cardiaque, urgence médicale.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Phone className="size-3 mt-0.5" /> 
                      <span><span className="font-bold">Pompiers (18) :</span> Incendie, accident de la route.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {mode === 'receiver' && (
              <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest pt-2">
                Dernière activité : {remoteVessel?.lastActive ? new Date(remoteVessel.lastActive.toDate()).toLocaleTimeString('fr-FR') : 'Inconnue'}
              </p>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
