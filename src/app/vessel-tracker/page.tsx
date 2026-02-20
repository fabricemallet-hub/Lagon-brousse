'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
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
  Expand, 
  Shrink, 
  Zap, 
  RefreshCw,
  X,
  Wind,
  Waves,
  Activity,
  Thermometer,
  Gauge,
  Layers,
  Smartphone,
  ShieldAlert,
  Database,
  History,
  MapPin,
  WifiOff,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  AlertCircle,
  Eye,
  EyeOff,
  MessageSquare
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchWindyWeather } from '@/lib/windy-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const WINDY_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const MeteoDataPanel = ({ data, onClose, isLoading }: { data: any, onClose: () => void, isLoading: boolean }) => {
    if (!data) return null;
    return (
        <div className="absolute z-[110] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border-2 border-white/20 min-w-[280px] animate-in zoom-in-95" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -110%)' }}>
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Activity className="size-3" /> Analyse Tactique
                </span>
                {isLoading && <RefreshCw className="size-3 animate-spin text-primary" />}
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Wind className="size-2" /> Vent / Rafale</span>
                    <span className="text-sm font-black text-blue-400">
                        {data.windSpeed ?? '--'} <span className="text-[8px] opacity-60">ND</span>
                        {data.gustSpeed > 0 && <span className="text-orange-400 ml-1">({data.gustSpeed})</span>}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Waves className="size-2" /> Houle</span>
                    <span className="text-sm font-black text-cyan-400">{data.waves ?? '--'}<span className="text-[8px] ml-0.5">m</span></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Thermometer className="size-2" /> Air / Eau</span>
                    <span className="text-sm font-black">
                        {data.temp ?? '--'}° <span className="text-blue-300">/ {data.sst ?? '--'}°</span>
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Gauge className="size-2" /> Pression</span>
                    <span className="text-sm font-black">{data.pressure ?? '--'} <span className="text-[8px] opacity-60">hPa</span></span>
                </div>
            </div>

            <button onClick={onClose} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1.5 shadow-lg border-2 border-white/20"><X className="size-3" /></button>
        </div>
    );
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [detectedHost, setDetectedHost] = useState('');
  
  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState('ecmwf');
  const [currentOverlay, setCurrentOverlay] = useState('wind');
  
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapClickResult, setMapClickResult] = useState<any>(null);
  const [isQueryingWindy, setIsQueryingWindy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  const mapRef = useRef<any>(null);
  const windyMapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const isMapInitializedRef = useRef<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  const sharingId = useMemo(() => (user?.uid || '').toUpperCase(), [user]);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const labels = useMemo(() => ({
    title: "Vessel Tracker",
    status1: "Au Mouillage",
    status2: "En Route",
    emergency: "DÉTRESSE"
  }), []);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const ids = [...savedVesselIds];
    if (isSharing && !ids.includes(sharingId)) ids.push(sharingId);
    return query(collection(firestore, 'vessels'), where('isSharing', '==', true), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || !window.L || !window.windyInit || isMapInitializedRef.current) return;

    setDetectedHost(window.location.host);

    // DÉLAI DE PROTECTION DU THREAD (Fix Violations)
    setTimeout(() => {
        const options = {
          key: WINDY_KEY,
          lat: INITIAL_CENTER.lat,
          lon: INITIAL_CENTER.lng,
          zoom: 10,
          verbose: true,
          externalAllowedOrigins: ["cloudworkstations.dev", "web.app"],
          overlays: ['wind', 'waves', 'pressure', 'temp', 'sst'],
          product: 'ecmwf',
        };

        try {
            window.windyInit(options, (windyAPI: any) => {
              if (!windyAPI) {
                  setAuthError("Échec de l'initialisation. Vérifiez l'origine autorisée.");
                  return;
              }

              const { map, store, picker, broadcast } = windyAPI;
              mapRef.current = map;
              windyMapInstance.current = windyAPI;
              isMapInitializedRef.current = true;

              store.set('overlay', 'wind');
              store.set('product', 'ecmwf');

              // Forcer le redessin
              setTimeout(() => {
                map.invalidateSize();
                window.dispatchEvent(new Event('resize'));
              }, 1000);

              broadcast.on('pickerMoved', async (latLon: any) => {
                const { lat, lon } = latLon;
                setMapClickResult({ lat, lon });
                setIsQueryingWindy(true);
                try {
                  const weather = await fetchWindyWeather(lat, lon);
                  setMapClickResult((prev: any) => ({ ...prev, ...weather }));
                } catch (err) {
                } finally {
                  setIsQueryingWindy(false);
                }
              });

              map.on('click', (e: any) => {
                picker.open({ lat: e.latlng.lat, lon: e.latlng.lng });
              });
            });
        } catch (e: any) {
            setAuthError(e.message || "Erreur d'authentification Windy.");
        }
    }, 500);
  }, []);

  useEffect(() => {
    if (isLeafletLoaded && isWindyLoaded) initWindy();
  }, [isLeafletLoaded, isWindyLoaded, initWindy]);

  useEffect(() => {
    if (!mapRef.current || !followedVessels || !window.L) return;
    const L = window.L;

    followedVessels.forEach(v => {
      if (!v.location || !v.isSharing) {
        if (markersRef.current[v.id]) { markersRef.current[v.id].remove(); delete markersRef.current[v.id]; }
        return;
      }

      const pos = [v.location.latitude, v.location.longitude];
      const statusColor = v.status === 'stationary' ? '#f97316' : '#2563eb';

      if (!markersRef.current[v.id]) {
        const icon = L.divIcon({
          className: 'vessel-marker',
          html: `<div class="relative flex flex-col items-center" style="transform: translate(-50%, -100%)">
                  <div class="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap mb-1">
                    ${v.displayName || v.id}
                  </div>
                  <div class="p-1.5 rounded-full border-2 border-white shadow-xl" style="background-color: ${statusColor}">
                    <svg class="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M12 2v18M5 12h14M12 20c-3.3 0-6-2.7-6-6M12 20c3.3 0 6-2.7 6-6"></path>
                    </svg>
                  </div>
                </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });
        markersRef.current[v.id] = L.marker(pos, { icon }).addTo(mapRef.current);
      } else {
        markersRef.current[v.id].setLatLng(pos);
      }
    });
  }, [followedVessels]);

  const handleGpsUpdate = useCallback(async (pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords;
    setCurrentPos({ lat: latitude, lng: longitude });

    if (user && firestore && isSharing) {
        setDoc(doc(firestore, 'vessels', sharingId), { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || profile?.displayName || 'Capitaine', 
            location: { latitude, longitude },
            isSharing: true, 
            lastActive: serverTimestamp()
        }, { merge: true }).catch(() => {});
    }
  }, [user, firestore, isSharing, sharingId, vesselNickname, profile?.displayName]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(handleGpsUpdate, null, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    return () => { if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; } };
  }, [isSharing, mode, handleGpsUpdate]);

  const handleRecenter = () => {
    if (currentPos && mapRef.current) {
        mapRef.current.panTo([currentPos.lat, currentPos.lng]);
        mapRef.current.setZoom(15);
    }
  };

  const handleSetModel = (model: string) => {
    setCurrentModel(model);
    if (window.windyStore) window.windyStore.set('product', model);
  };

  const handleSetOverlay = (overlay: string) => {
    setCurrentOverlay(overlay);
    if (window.windyStore) window.windyStore.set('overlay', overlay);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Script src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js" strategy="afterInteractive" onLoad={() => setIsLeafletLoaded(true)} />
      <Script src={`https://api.windy.com/assets/map-forecast/libBoot.js?v=${Date.now()}`} strategy="lazyOnload" crossOrigin="anonymous" onLoad={() => setIsWindyLoaded(true)} />

      <meta name="referrer" content="no-referrer-when-downgrade" />

      {authError && (
        <Alert variant="destructive" className="bg-red-50 border-red-600 rounded-2xl border-2">
            <ShieldAlert className="size-5" />
            <AlertTitle className="font-black uppercase text-xs">Authentification Refusée (401)</AlertTitle>
            <AlertDescription className="text-[10px] font-bold space-y-2">
                <p>Veuillez autoriser l'hôte suivant sur <a href="https://api.windy.com/keys" target="_blank" className="underline">api.windy.com</a> :</p>
                <div className="p-2 bg-white rounded border font-mono text-[9px] select-all uppercase">
                    {detectedHost || 'Calcul...'}
                </div>
                <p className="text-red-800 italic">Sans cette étape, la carte Windy restera bloquée sur cet environnement.</p>
            </AlertDescription>
        </Alert>
      )}

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
              <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partage GPS</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">{isSharing ? 'En cours' : 'Inactif'}</p></div>
              <Switch checked={isSharing} onCheckedChange={setIsSharing} />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase ml-1 opacity-40">Modèle Météo</Label>
                  <select 
                    value={currentModel}
                    onChange={(e) => handleSetModel(e.target.value)}
                    className="w-full h-10 border-2 rounded-md bg-white font-black uppercase text-[10px] px-2 outline-none"
                  >
                      <option value="ecmwf">ECMWF (9km)</option>
                      <option value="gfs">GFS (22km)</option>
                      <option value="icon">ICON (7km)</option>
                  </select>
              </div>
              <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase ml-1 opacity-40">Calque Tactique</Label>
                  <select 
                    value={currentOverlay}
                    onChange={(e) => handleSetOverlay(e.target.value)}
                    className="w-full h-10 border-2 rounded-md bg-white font-black uppercase text-[10px] px-2 outline-none"
                  >
                      <option value="wind">Vent & Rafales</option>
                      <option value="waves">Vagues & Houle</option>
                      <option value="sst">Temp. Eau (SST)</option>
                      <option value="pressure">Pression</option>
                      <option value="rh">Humidité</option>
                  </select>
              </div>
          </div>
        </CardContent>
      </Card>

      <div className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all relative bg-slate-100 rounded-2xl", isFullscreen ? "fixed inset-0 z-[150] w-screen h-screen rounded-none" : "min-h-[550px]")}>
        <div id="windy" className="absolute inset-0 w-full h-full z-10" style={{ minHeight: isFullscreen ? '100vh' : '550px', position: 'relative' }}>
          <MeteoDataPanel data={mapClickResult} onClose={() => setMapClickResult(null)} isLoading={isQueryingWindy} />
          
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5" /></Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
          <Card className="border-2 shadow-sm">
              <CardHeader className="p-4 border-b bg-muted/10">
                  <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><History className="size-3"/> Journal de bord</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {history.length > 0 ? history.map((h, i) => (
                      <div key={i} className="flex justify-between items-center text-[9px] font-bold p-2 bg-white rounded border animate-in fade-in">
                          <span className="uppercase text-primary">{h.vesselName}</span>
                          <span className="uppercase">{h.statusLabel}</span>
                          <span className="opacity-40">{format(h.time, 'HH:mm')}</span>
                      </div>
                  )) : (
                      <div className="text-center py-8 opacity-30 italic text-[10px] font-black uppercase tracking-widest">En attente de signaux...</div>
                  )}
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
