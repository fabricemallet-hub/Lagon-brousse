'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
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
  Copy, 
  Phone,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const INITIAL_CENTER = { lat: -22.27, lng: 166.45 };
const IMMOBILITY_THRESHOLD_METERS = 20; 

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
  const [isGpsActiveForReceiver, setIsGpsActiveForReceiver] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const shouldPanOnNextFix = useRef(false);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<'moving' | 'stationary'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const activeVesselId = useMemo(() => mode === 'sender' ? sharingId : vesselIdToFollow.trim().toUpperCase(), [mode, sharingId, vesselIdToFollow]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const vesselRef = useMemoFirebase(() => {
    if (!firestore || !activeVesselId) return null;
    return doc(firestore, 'vessels', activeVesselId);
  }, [firestore, activeVesselId]);
  const { data: remoteVessel } = useDoc<VesselStatus>(vesselRef);

  const currentEffectiveStatus = useMemo(() => {
    if (mode === 'sender') return isSharing ? vesselStatus : 'offline';
    return (remoteVessel && remoteVessel.isSharing) ? remoteVessel.status : 'offline';
  }, [mode, isSharing, vesselStatus, remoteVessel]);

  const finalSmsBody = useMemo(() => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    return `SOS Lagon & Brousse NC : Besoin d'assistance en mer.\nMa position : ${posUrl}`;
  }, [currentPos, remoteVessel, mode]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.displayName && !vesselNickname) setVesselNickname(userProfile.displayName);
      if (userProfile.lastSelectedLocation && !customSharingId && mode === 'sender') {
          // Utiliser un ID par défaut ou laisser vide
      }
    }
  }, [userProfile, vesselNickname, mode]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    setDoc(doc(firestore, 'vessels', sharingId), { 
      userId: user.uid, 
      displayName: vesselNickname || user.displayName || 'Capitaine', 
      isSharing: isSharing, 
      lastActive: serverTimestamp(), 
      ...data 
    }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        if (!anchorPos) { 
          setAnchorPos(newPos); 
          updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true }); 
          return; 
        }
        if (getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng) > IMMOBILITY_THRESHOLD_METERS) {
          setVesselStatus('moving'); 
          setAnchorPos(newPos); 
          updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true });
        } else {
          setVesselStatus('stationary');
          updateVesselInFirestore({ status: 'stationary' });
        }
      },
      () => {
        toast({ variant: "destructive", title: "Erreur GPS", description: "Veuillez activer la localisation." });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map, toast]);

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      toast({ variant: "destructive", title: "Non supporté", description: "Le maintien de l'écran n'est pas supporté sur ce navigateur." });
      return;
    }
    if (wakeLock) {
      try { await wakeLock.release(); setWakeLock(null); toast({ title: "Mode éveil désactivé" }); } catch (e) { setWakeLock(null); }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil activé", description: "L'écran restera allumé." });
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Permission bloquée", description: "Impossible d'activer le mode éveil." });
      }
    }
  };

  const handleRecenter = () => {
    if (mode === 'receiver' && !isGpsActiveForReceiver) {
        setIsGpsActiveForReceiver(true);
        navigator.geolocation.getCurrentPosition((p) => {
            const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
            setCurrentPos(pos);
            map?.panTo(pos);
            map?.setZoom(15);
        });
        toast({ title: "Localisation active" });
    }
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : currentPos);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const copyCoordinates = () => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : null);
    if (pos) {
      const coords = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
      navigator.clipboard.writeText(coords);
      toast({ title: "Coordonnées copiées", description: coords });
    }
  };

  const handleSaveEmergencyContact = () => {
    if (!user || !firestore || !emergencyContact) return;
    updateDoc(doc(firestore, 'users', user.uid), { emergencyContact }).then(() => toast({ title: "Contact enregistré" }));
  };

  const sendEmergencySms = () => {
    if (!emergencyContact.trim()) { toast({ variant: "destructive", title: "Numéro requis", description: "Saisissez un numéro de contact en bas de page." }); return; }
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(finalSmsBody)}`;
  };

  const displayVessel = mode === 'sender' ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: vesselNickname || 'Ma Position' } : null) : remoteVessel;

  if (loadError) return <div className="p-4 text-destructive">Erreur Maps</div>;
  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Navigation className="text-primary size-6" /> Vessel Tracker NC
          </CardTitle>
          <CardDescription className="text-xs font-medium">Partage de position et sécurité maritime.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-2 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="flex bg-muted/30 p-1">
            <Button 
              variant={mode === 'sender' ? 'default' : 'ghost'} 
              className={cn("flex-1 font-black uppercase text-xs h-12 rounded-lg transition-all", mode === 'sender' && "shadow-md")} 
              onClick={() => setMode('sender')}
            >
              Émetteur (A)
            </Button>
            <Button 
              variant={mode === 'receiver' ? 'default' : 'ghost'} 
              className={cn("flex-1 font-black uppercase text-xs h-12 rounded-lg transition-all", mode === 'receiver' && "shadow-md")} 
              onClick={() => setMode('receiver')}
            >
              Récepteur (B)
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {mode === 'sender' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black uppercase leading-none">Partager ma position</Label>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Flux GPS en direct</p>
                  </div>
                  <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID de partage personnalisé</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ex: TEST1234" 
                      value={customSharingId} 
                      onChange={e => setCustomSharingId(e.target.value.toUpperCase())} 
                      className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" 
                    />
                    <Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={() => toast({ title: "ID Prêt", description: "Partagez cet ID avec votre récepteur." })}>
                      <Save className="size-5" />
                    </Button>
                  </div>
                </div>

                <Button 
                  variant={wakeLock ? "secondary" : "outline"} 
                  className={cn("w-full h-12 font-black uppercase text-xs tracking-widest border-2 gap-2", wakeLock && "bg-primary/10 border-primary/30 text-primary")}
                  onClick={toggleWakeLock}
                >
                  <Zap className={cn("size-4", wakeLock && "fill-primary")} />
                  {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du navire à suivre</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="ENTREZ L'ID PARTAGÉ..." 
                      value={vesselIdToFollow} 
                      onChange={e => setVesselIdToFollow(e.target.value.toUpperCase())} 
                      className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap 
            mapContainerClassName="w-full h-full" 
            defaultCenter={INITIAL_CENTER} 
            defaultZoom={15} 
            onLoad={setMap} 
            options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
          >
                {(mode === 'receiver' || isSharing) && currentPos && (
                  <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -50%)' }}>
                      <div className="size-5 bg-blue-500 rounded-full border-2 border-white shadow-lg relative">
                        <div className="absolute inset-0 size-full bg-blue-500 rounded-full animate-ping opacity-40"></div>
                      </div>
                    </div>
                  </OverlayView>
                )}
                {displayVessel?.location && displayVessel.location.latitude !== 0 && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap">
                          {displayVessel.displayName}
                        </div>
                        <div className={cn(
                          "p-2 rounded-full border-2 border-white shadow-xl animate-in zoom-in duration-300", 
                          displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600"
                        )}>
                          {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
          </GoogleMap>
          
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button 
                onClick={handleRecenter} 
                className={cn(
                    "shadow-lg h-10 w-auto px-3 z-10 border-2 gap-2 flex items-center bg-background/90 backdrop-blur-md", 
                    (mode === 'sender' && isSharing) || (mode === 'receiver' && isGpsActiveForReceiver) ? "border-primary text-primary" : ""
                )}
            >
                <LocateFixed className="size-5" />
            </Button>
            <Button 
              size="icon" 
              className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" 
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
          </div>
        </div>

        <div className="bg-card p-0 flex flex-col border-t-2">
            <Button 
              variant="ghost" 
              className="h-12 w-full rounded-none border-b bg-muted/10 font-black uppercase text-[10px] tracking-widest gap-2"
              onClick={copyCoordinates}
              disabled={!displayVessel?.location}
            >
              <Copy className="size-3" /> Copier les coordonnées GPS
            </Button>

            <div className="p-4 flex flex-col gap-4">
                <Button 
                  variant="destructive" 
                  className="w-full h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-sm tracking-widest animate-in slide-in-from-bottom-2" 
                  onClick={sendEmergencySms} 
                  disabled={!displayVessel?.location}
                >
                  <ShieldAlert className="size-6 mr-1" /> ENVOYER ALERTE SMS
                </Button>

                <div className="bg-muted/30 rounded-2xl border-2 border-dashed p-4 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-muted-foreground/10">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Secours en Mer (MRCC)</span>
                    <span className="font-black text-xs text-red-600">196 (OU VHF 16)</span>
                  </div>
                  
                  <Alert className="bg-red-50 border-red-100 text-red-800 py-2">
                    <Info className="size-3 text-red-600" />
                    <AlertDescription className="text-[9px] font-bold leading-tight uppercase italic">
                      Rappel : en mer, le CANAL 16 est le moyen le plus sûr. Le 196 est destiné aux appels depuis la terre.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase opacity-60">
                      <span>Sapeurs-Pompiers</span>
                      <span>18</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase opacity-60">
                      <span>Urgences Santé / SAMU</span>
                      <div className="text-right flex flex-col">
                        <span>15</span>
                        <span className="text-[8px]">+687 78.77.25</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase opacity-60">
                      <span>SNSM Nouméa</span>
                      <span>25.23.12</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Contact d'urgence (Alerte SMS)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="tel" 
                      value={emergencyContact} 
                      onChange={e => setEmergencyContact(e.target.value)} 
                      placeholder="+687..."
                      className="flex h-12 w-full rounded-xl border-2 bg-white px-4 font-black" 
                    />
                    <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveEmergencyContact}>
                      <Save className="size-5" />
                    </Button>
                  </div>
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
}
