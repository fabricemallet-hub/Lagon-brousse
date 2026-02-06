'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Navigation, Anchor, LocateFixed, ShieldAlert, Save, WifiOff, Move, Expand, Shrink } from 'lucide-react';
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
  const [customSmsMessage, setCustomSmsMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
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
    const mainText = customSmsMessage.trim() || "SOS j'ai un souci avec le bateau. Voici mes coordonnées GPS.";
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    return `${mainText}\n\nPosition : ${posUrl}`;
  }, [customSmsMessage, currentPos, remoteVessel, mode]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.displayName && !vesselNickname) setVesselNickname(userProfile.displayName);
      if (userProfile.vesselSmsMessage !== undefined) setCustomSmsMessage(userProfile.vesselSmsMessage);
    }
  }, [userProfile, vesselNickname]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    setDoc(doc(firestore, 'vessels', sharingId), { userId: user.uid, displayName: vesselNickname || user.displayName || 'Capitaine', isSharing: isSharing, lastActive: serverTimestamp(), ...data }, { merge: true }).catch(() => {});
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
        if (!anchorPos) { setAnchorPos(newPos); updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true }); return; }
        if (getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng) > IMMOBILITY_THRESHOLD_METERS) {
          setVesselStatus('moving'); setAnchorPos(newPos); updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map]);

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

  const handleSaveEmergencyContact = () => {
    if (!user || !firestore || !emergencyContact) return;
    updateDoc(doc(firestore, 'users', user.uid), { emergencyContact }).then(() => toast({ title: "Contact enregistré" }));
  };

  const sendEmergencySms = () => {
    if (!emergencyContact.trim()) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(finalSmsBody)}`;
  };

  const displayVessel = mode === 'sender' ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: vesselNickname || 'Moi' } : null) : remoteVessel;

  if (loadError) return <div className="p-4 text-destructive">Erreur Maps</div>;
  if (!isLoaded) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6 pb-12">
      <Card className="border-2">
        <CardContent className="pt-6 space-y-6">
          <div className="flex bg-muted/50 p-1 rounded-xl border">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-bold" onClick={() => setMode('sender')}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-bold" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          </div>
          {mode === 'sender' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card"><Label className="text-base font-black uppercase">Partager ma position</Label><Switch checked={isSharing} onCheckedChange={setIsSharing} /></div>
              <Input placeholder="ID partagé..." value={customSharingId} onChange={e => setCustomSharingId(e.target.value.toUpperCase())} className="font-black text-center h-12 border-2" />
            </div>
          ) : (
            <div className="flex gap-2"><Input placeholder="ID à suivre..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value.toUpperCase())} className="font-black text-center h-12 border-2" /></div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-50 w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[350px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={15} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}>
                {isGpsActiveForReceiver && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><div style={{ transform: 'translate(-50%, -50%)' }}><div className="size-4 bg-blue-500 rounded-full border-2 border-white animate-pulse"></div></div></OverlayView>}
                {displayVessel?.location && displayVessel.location.latitude !== 0 && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900 text-white rounded text-[10px] font-black">{displayVessel.displayName}</div>
                        <div className={cn("p-2 rounded-full border-2 border-white", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>{displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}</div>
                    </div>
                    </OverlayView>
                )}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 border-2" onClick={handleRecenter}><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-3">
            {!currentPos && mode === 'receiver' && !isGpsActiveForReceiver && (
                <Alert className="bg-primary/5 border-primary/20">
                    <LocateFixed className="size-4 text-primary" />
                    <AlertTitle className="text-xs font-black uppercase">Localisation Inactive</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                        <p className="text-[10px] font-medium leading-relaxed">Activez votre position pour vous situer sur la carte par rapport au navire.</p>
                        <Button size="sm" onClick={handleRecenter} className="font-black uppercase text-[10px] h-8 tracking-widest">Activer ma position</Button>
                    </AlertDescription>
                </Alert>
            )}
            <div className={cn("flex items-center justify-between p-4 rounded-2xl border-2", currentEffectiveStatus === 'moving' ? "bg-green-50" : currentEffectiveStatus === 'stationary' ? "bg-amber-50" : "bg-red-50")}>
                <div className="flex items-center gap-4">
                    <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white", currentEffectiveStatus === 'moving' ? "bg-green-600" : currentEffectiveStatus === 'stationary' ? "bg-amber-600" : "bg-red-600")}>{currentEffectiveStatus === 'moving' ? <Move className="size-6" /> : currentEffectiveStatus === 'stationary' ? <Anchor className="size-6" /> : <WifiOff className="size-6" />}</div>
                    <div><p className="font-black text-lg uppercase leading-none">{currentEffectiveStatus === 'moving' ? 'EN ROUTE' : currentEffectiveStatus === 'stationary' ? 'MOUILLAGE' : 'HORS LIGNE'}</p></div>
                </div>
            </div>
            <div className="p-4 bg-muted/10 border-t-2 rounded-xl">
              <Label className="text-[10px] font-black uppercase">Contact d'urgence :</Label>
              <div className="flex gap-2 mt-1"><input type="tel" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="flex h-12 w-full rounded-xl border-2 bg-white px-4 font-black" /><Button variant="secondary" className="h-12" onClick={handleSaveEmergencyContact}><Save className="size-5" /></Button></div>
              <Button variant="destructive" className="w-full h-14 mt-4 font-black uppercase rounded-xl" onClick={sendEmergencySms} disabled={!displayVessel?.location}><ShieldAlert className="size-6 mr-2" /> ALERTE SMS</Button>
            </div>
        </div>
      </Card>
    </div>
  );
}
