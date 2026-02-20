'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, where, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import Script from 'next/script';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  MapPin,
  X,
  Play,
  Volume2,
  Check,
  RefreshCw,
  Settings,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  Bird,
  Fish,
  Waves,
  Camera,
  Home,
  Wind,
  Compass,
  Thermometer
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry, HuntingMarker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryStatusIcon = ({ level, charging, className }: { level: number; charging: boolean, className?: string }) => {
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 20) return <BatteryLow {...props} className="text-red-600" />;
  if (level < 60) return <BatteryMedium {...props} className="text-orange-500" />;
  return <BatteryFull {...props} className="text-green-600" />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [customSharingId, setCustomSharingId] = useState('');
  const [mooringRadius, setMooringRadius] = useState(20);

  // States pour la carte et GPS
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status'] | 'offline'>('moving');
  
  // Windy Map Instance
  const [windyStore, setWindyStore] = useState<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  
  // Météo interactive (v5.1)
  const [mapClickResult, setMapClickResult] = useState<{ lat: number, lon: number, wind?: number, temp?: number, waves?: number, units?: any } | null>(null);
  const [isQueryingWindy, setIsQueryingWindy] = useState(false);
  const lastMapClickTimeRef = useRef<number>(0);

  const currentPosRef = useRef<any>(null);
  const anchorPosRef = useRef<any>(null);
  const statusRef = useRef<VesselStatus['status'] | 'offline'>('moving');
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateTimestampRef = useRef<number>(0);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const currentVesselData = useMemo(() => {
    return followedVessels?.find(v => v.id === sharingId);
  }, [followedVessels, sharingId]);

  const activeDuration = useMemo(() => {
    if (!currentVesselData?.statusChangedAt) return "ACTIF 0 MIN";
    const start = currentVesselData.statusChangedAt.toDate();
    const mins = Math.max(0, differenceInMinutes(new Date(), start));
    return `ACTIF ${mins} MIN`;
  }, [currentVesselData]);

  // Initialisation Windy (v5.1)
  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).windyInit) return;

    const options = {
      key: '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4',
      lat: INITIAL_CENTER.lat,
      lon: INITIAL_CENTER.lng,
      zoom: 10,
    };

    (window as any).windyInit(options, (windyAPI: any) => {
      const { map, picker, store } = windyAPI;
      mapRef.current = map;
      setWindyStore(store);

      // ÉCOUTEUR DE CLIC (v5.1) : Récupération météo
      map.on('click', async (e: any) => {
        const now = Date.now();
        // Protection Debounce : 2 secondes entre les clics (Optimisation Performance)
        if (now - lastMapClickTimeRef.current < 2000) return;
        lastMapClickTimeRef.current = now;

        const { lat, lng } = e.latlng;
        const lon = lng; // Conversion explicite lng -> lon pour Windy

        // UI immédiate : Positionnement du picker natif et reset du label
        setMapClickResult({ lat, lon });
        setIsQueryingWindy(true);
        picker.open({ lat, lon });

        try {
          // Appel API Point Forecast v2 conforme
          const weather = await fetchWindyWeather(lat, lon);
          if (weather.success) {
            setMapClickResult({ 
                lat, 
                lon, 
                wind: weather.windSpeed, 
                temp: weather.temperature, 
                waves: weather.waves,
                units: weather.units 
            });
            toast({ 
                title: "Météo au point cliqué", 
                description: `Vent: ${weather.windSpeed} ND | Mer: ${weather.waves}m | Temp: ${weather.temperature}°C` 
            });
          } else {
            setMapClickResult(null);
            toast({ variant: "destructive", title: "Erreur Windy", description: weather.error });
          }
        } catch (err) {
          console.error("Windy Click Error:", err);
          setMapClickResult(null);
        } finally {
          setIsQueryingWindy(false);
        }
      });
    });
  }, [toast]);

  // Synchronisation des marqueurs sur la carte Windy (Leaflet)
  useEffect(() => {
    if (!mapRef.current || !followedVessels || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    followedVessels.forEach(v => {
      if (!v.location || !v.isSharing) {
        if (markersRef.current[v.id]) {
          markersRef.current[v.id].remove();
          delete markersRef.current[v.id];
        }
        return;
      }

      const pos = [v.location.latitude, v.location.longitude];
      const isMe = v.id === sharingId;
      const statusColor = v.status === 'stationary' ? '#f97316' : '#2563eb';

      if (!markersRef.current[v.id]) {
        // Rendu Viseur v5.1 : Opacité 85% et centrage parfait
        const icon = L.divIcon({
          className: 'custom-vessel-icon',
          html: `<div class="relative flex items-center justify-center" style="transform: translate(-50%, -50%)">
                  <div class="size-16 rounded-full border-4 border-white shadow-2xl flex items-center justify-center transition-all duration-500" 
                       style="background-color: ${statusColor}; opacity: 0.85">
                    <svg class="size-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        ${v.status === 'stationary' ? '<path d="M12 2v18M5 12h14M12 20c-3.3 0-6-2.7-6-6M12 20c3.3 0 6-2.7 6-6"></path>' : '<path d="M3 11l19-9-9 19-2-8-8-2z"></path>'}
                    </svg>
                  </div>
                  <div class="absolute size-5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] z-[100] animate-pulse"></div>
                </div>`,
          iconSize: [0, 0], // On gère le positionnement via CSS translate pour un centrage pixel-perfect
          iconAnchor: [0, 0]
        });
        markersRef.current[v.id] = L.marker(pos, { icon, zIndexOffset: isMe ? 1000 : 0 }).addTo(mapRef.current);
      } else {
        markersRef.current[v.id].setLatLng(pos);
      }
    });
  }, [followedVessels, sharingId]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>, force = false) => {
    if (!user || !firestore || !sharingId) return;
    
    // PERFORMANCE PILIER : Throttling à 5 secondes (évite les violations de thread)
    const now = Date.now();
    if (!force && (now - lastUpdateTimestampRef.current < 5000)) return;
    lastUpdateTimestampRef.current = now;

    const updatePayload: any = { 
        id: sharingId,
        userId: user.uid, 
        displayName: vesselNickname || user.displayName || 'Capitaine', 
        isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
        lastActive: serverTimestamp(),
        ...data 
    };
    if (data.status || data.isSharing === true) updatePayload.statusChangedAt = serverTimestamp();
    await setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true });
  }, [user, firestore, sharingId, vesselNickname, isSharing]);

  const handleStopSharing = async () => {
    setIsSharing(false);
    // NETTOYAGE CRITIQUE : clearWatch pour libérer les ressources
    if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    if (firestore) await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    setCurrentPos(null);
    toast({ title: "Partage GPS arrêté", description: "Service libéré." });
  };

  const handleRecenter = () => {
    if (mode === 'sender' && currentPos && mapRef.current) {
      mapRef.current.panTo([currentPos.lat, currentPos.lng]);
      mapRef.current.setZoom(15);
    }
  };

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;
    
    // GESTION GPS v5.1 : Stabilisation et Throttling matériel
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        
        // On ne met à jour l'état UI que toutes les 5s pour économiser le CPU
        const now = Date.now();
        if (now - lastUpdateTimestampRef.current < 5000) return;

        currentPosRef.current = newPos;
        setCurrentPos(newPos);
        updateVesselInFirestore({ 
            location: { latitude, longitude }, 
            status: 'moving', 
            accuracy: Math.round(accuracy) 
        });
      },
      null,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // CLEANUP : Garantie de suppression de l'instance au démontage
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, updateVesselInFirestore]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Script 
        src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js"
        strategy="beforeInteractive"
      />
      <Script 
        src="https://api.windy.com/assets/lib/libBoot.js"
        onLoad={initWindy}
      />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.4.0/dist/leaflet.css" />

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
                    <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partage GPS</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Diffusion en direct</p></div>
                    <Switch checked={isSharing} onCheckedChange={val => val ? setIsSharing(true) : handleStopSharing()} />
                </div>
              ) : (
                <div className="space-y-4">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden text-white bg-primary")}>
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                        <Badge variant="outline" className="bg-green-500/30 border-white/30 text-white font-black text-[10px] px-3 h-6 mt-4">EN LIGNE</Badge>
                    </div>
                    <Button variant="destructive" className="w-full h-14 font-black uppercase shadow-lg" onClick={handleStopSharing}><X className="mr-2 size-5" /> Arrêter le partage</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div id="windy" className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[500px]")}>
          
          {/* LABEL MÉTÉO AU CLIC (v5.1) : Overlay Tactique */}
          {mapClickResult && (
            <div 
              className="absolute z-[110] bg-slate-900/85 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border-2 border-white/20 min-w-[140px] animate-in zoom-in-95 pointer-events-none"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -130%)'
              }}
            >
              <div className="flex items-center justify-between gap-4 mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">WINDY LIVE</span>
                {isQueryingWindy && <RefreshCw className="size-3 animate-spin text-primary" />}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Wind className="size-5 text-blue-400" />
                  <div className="flex flex-col">
                    <span className="text-xl font-black leading-none">{mapClickResult.wind ?? '--'}</span>
                    <span className="text-[8px] font-black uppercase opacity-60">Noeuds</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Waves className="size-5 text-cyan-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-black leading-none">{mapClickResult.waves ?? '--'}m</span>
                    <span className="text-[8px] font-black uppercase opacity-60">Houle</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Thermometer className="size-5 text-orange-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-black leading-none">{mapClickResult.temp ?? '--'}°C</span>
                    <span className="text-[8px] font-black uppercase opacity-60">Air</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 border-r-2 border-b-2 border-white/20"></div>
            </div>
          )}

          <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 border-2 p-0"><Compass className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>

          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <div className="size-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,1)]"></div>
            <span className="text-[9px] font-black uppercase text-white tracking-widest">Mise à jour GPS : 5s</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
