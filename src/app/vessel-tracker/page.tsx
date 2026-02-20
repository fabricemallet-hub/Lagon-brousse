
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
  WifiOff,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  ShieldAlert,
  History,
  MapPin,
  AlertCircle,
  Copy,
  Info,
  ArrowUp,
  ChevronDown,
  Database,
  Layers,
  Search,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, Tide } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchWindyWeather } from '@/lib/windy-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getDataForDate } from '@/lib/data';

const MAP_FORECAST_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const MeteoDataPanel = ({ data, onClose, isLoading, tides }: { data: any, onClose: () => void, isLoading: boolean, tides: Tide[] | null }) => {
    if (!data) return null;
    return (
        <div className="absolute z-[110] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border-2 border-white/20 min-w-[280px] animate-in zoom-in-95" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -110%)' }}>
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Activity className="size-3" /> Analyse Marine
                </span>
                {isLoading && <RefreshCw className="size-3 animate-spin text-primary" />}
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Wind className="size-2" /> Vent / Rafale</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-blue-400">
                            {data.windSpeed ?? '--'} <span className="text-[8px] opacity-60">ND</span>
                        </span>
                        {data.windDir !== undefined && (
                            <ArrowUp className="size-3 text-white/40" style={{ transform: `rotate(${data.windDir}deg)` }} />
                        )}
                    </div>
                    {data.gustSpeed > 0 && <span className="text-[9px] font-bold text-orange-400">Rafales : {data.gustSpeed} ND</span>}
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Waves className="size-2" /> Mer / Houle</span>
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

            {tides && (
                <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="grid grid-cols-2 gap-2">
                        {tides.slice(0, 2).map((t, i) => (
                            <div key={i} className="bg-white/5 rounded p-1.5 text-center">
                                <p className={cn("text-[7px] font-black uppercase", t.type === 'haute' ? 'text-primary' : 'text-orange-400')}>Mer {t.type}</p>
                                <p className="text-[10px] font-black">{t.time} • {t.height.toFixed(2)}m</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
  const [currentOrigin, setCurrentOrigin] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState('ecmwf');
  const [currentOverlay, setCurrentOverlay] = useState('wind');
  
  const [mapClickResult, setMapClickResult] = useState<any>(null);
  const [pointTides, setPointTides] = useState<Tide[] | null>(null);
  const [isQueryingWindy, setIsQueryingWindy] = useState(false);
  
  const mapRef = useRef<any>(null);
  const windyMapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const isMapInitializedRef = useRef<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const pickerTimerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setCurrentOrigin(window.location.host);
  }, []);

  const sharingId = useMemo(() => (user?.uid || '').toUpperCase(), [user]);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

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

    isMapInitializedRef.current = true;

    // Délai prolongé pour Cloud Workstations
    setTimeout(() => {
        const options = {
          key: MAP_FORECAST_KEY,
          lat: INITIAL_CENTER.lat,
          lon: INITIAL_CENTER.lng,
          zoom: 10,
          verbose: true,
          externalAllowedOrigins: ["cloudworkstations.dev", "web.app"],
          overlays: ['wind', 'waves', 'pressure', 'temp', 'sst', 'rh', 'swell'],
          product: 'ecmwf',
        };

        try {
            window.windyInit(options, (windyAPI: any) => {
              if (!windyAPI) {
                  setAuthError(window.location.host);
                  isMapInitializedRef.current = false;
                  return;
              }

              const { map, store, picker, broadcast } = windyAPI;
              mapRef.current = map;
              windyMapInstance.current = windyAPI;

              store.set('overlay', 'wind');
              store.set('product', 'ecmwf');

              // Optimisation du Picker avec Debounce (Evite les violations de thread)
              broadcast.on('pickerMoved', (latLon: any) => {
                if (pickerTimerRef.current) clearTimeout(pickerTimerRef.current);
                
                pickerTimerRef.current = setTimeout(async () => {
                    const { lat, lon } = latLon;
                    setMapClickResult({ lat, lon });
                    setIsQueryingWindy(true);
                    setPointTides(null);

                    try {
                      const weather = await fetchWindyWeather(lat, lon);
                      setMapClickResult((prev: any) => ({ ...prev, ...weather }));
                      const commune = getClosestCommune(lat, lon);
                      const tideData = getDataForDate(commune, new Date());
                      setPointTides(tideData.tides);
                    } catch (err) {} finally {
                      setIsQueryingWindy(false);
                    }
                }, 300);
              });

              map.on('click', (e: any) => {
                picker.open({ lat: e.latlng.lat, lon: e.latlng.lng });
              });

              setTimeout(() => { map.invalidateSize(); }, 1000);
            });
        } catch (e: any) {
            setAuthError(window.location.host);
            isMapInitializedRef.current = false;
        }
    }, 800);
  }, []);

  useEffect(() => {
    if (isLeafletLoaded && isWindyLoaded) initWindy();
  }, [isLeafletLoaded, isWindyLoaded, initWindy]);

  useEffect(() => {
    if (!mapRef.current || !followedVessels || !window.L) return;
    const L = window.L;

    const renderFleet = () => {
        followedVessels.forEach(v => {
          if (!v.location || !v.isSharing) {
            if (markersRef.current[v.id]) { markersRef.current[v.id].remove(); delete markersRef.current[v.id]; }
            return;
          }

          const pos = [v.location.latitude, v.location.longitude];
          const color = v.status === 'stationary' ? '#f97316' : '#2563eb';

          if (!markersRef.current[v.id]) {
            const icon = L.divIcon({
              className: 'vessel-marker',
              html: `<div class="flex flex-col items-center" style="transform: translate(-50%, -100%)">
                      <div class="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 mb-1">
                        ${v.displayName || v.id}
                      </div>
                      <div class="p-1.5 rounded-full border-2 border-white shadow-xl" style="background-color: ${color}">
                        <svg class="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <path d="M12 2v18M5 12h14"></path>
                        </svg>
                      </div>
                    </div>`,
              iconSize: [0, 0]
            });
            markersRef.current[v.id] = L.marker(pos, { icon }).addTo(mapRef.current);
          } else {
            markersRef.current[v.id].setLatLng(pos);
          }
        });
    };

    const frame = requestAnimationFrame(renderFleet);
    return () => cancelAnimationFrame(frame);
  }, [followedVessels]);

  const handleSetModel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = e.target.value;
    setCurrentModel(m);
    if (window.windyStore) window.windyStore.set('product', m);
  };

  const handleSetOverlay = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const o = e.target.value;
    setCurrentOverlay(o);
    if (window.windyStore) window.windyStore.set('overlay', o);
  };

  const copyHost = () => {
    navigator.clipboard.writeText(currentOrigin);
    toast({ title: "Hôte copié !" });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Script src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js" strategy="afterInteractive" onLoad={() => setIsLeafletLoaded(true)} />
      <Script src={`https://api.windy.com/assets/map-forecast/libBoot.js?v=${Date.now()}`} strategy="lazyOnload" crossOrigin="anonymous" onLoad={() => setIsWindyLoaded(true)} />

      <meta name="referrer" content="no-referrer-when-downgrade" />

      {authError && (
        <Alert variant="destructive" className="bg-red-50 border-red-600 rounded-2xl border-2 shadow-xl animate-in slide-in-from-top-4">
            <ShieldAlert className="size-6" />
            <AlertTitle className="font-black uppercase text-sm mb-2">ERREUR 401 : CONFIGURATION REQUISE</AlertTitle>
            <AlertDescription className="space-y-4">
                <div className="p-4 bg-white/80 rounded-xl border border-red-200">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Copiez cet hôte dans vos restrictions Windy (Clé 1gGm...) :</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-red-100 rounded font-mono text-[10px] select-all break-all">{currentOrigin}</code>
                        <Button size="icon" variant="ghost" onClick={copyHost}><Copy className="size-4" /></Button>
                    </div>
                </div>
                <div className="bg-white/50 p-3 rounded-lg text-[9px] font-bold text-red-900 italic">
                    {"Assurez-vous d'avoir également *.cloudworkstations.dev dans votre console Windy."}
                </div>
            </AlertDescription>
        </Alert>
      )}

      <Card className="border-2 shadow-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
              <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partage GPS</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">{isSharing ? 'En cours' : 'Inactif'}</p></div>
              <Switch checked={isSharing} onCheckedChange={setIsSharing} className="touch-manipulation" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Modèle</Label>
                  <div className="relative">
                      <select value={currentModel} onChange={handleSetModel} className="w-full h-11 border-2 rounded-xl bg-white font-black uppercase text-[10px] px-3 appearance-none shadow-sm outline-none">
                          <option value="ecmwf">ECMWF (9km)</option>
                          <option value="gfs">GFS (22km)</option>
                          <option value="icon">ICON (7km)</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 opacity-30 pointer-events-none" />
                  </div>
              </div>
              <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Calque Tactique</Label>
                  <div className="relative">
                      <select value={currentOverlay} onChange={handleSetOverlay} className="w-full h-11 border-2 rounded-xl bg-white font-black uppercase text-[10px] px-3 appearance-none shadow-sm outline-none">
                          <option value="wind">Vent & Rafales</option>
                          <option value="waves">Mer & Vagues</option>
                          <option value="sst">Eau (SST)</option>
                          <option value="pressure">Pression</option>
                          <option value="rh">Humidité</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 opacity-30 pointer-events-none" />
                  </div>
              </div>
          </div>
        </CardContent>
      </Card>

      <div className={cn("overflow-hidden border-2 shadow-2xl flex flex-col transition-all relative bg-slate-100 rounded-[2rem]", isFullscreen ? "fixed inset-0 z-[150] w-screen h-screen rounded-none" : "min-h-[550px]")}>
        <div id="windy" className="absolute inset-0 w-full h-full z-10" style={{ minHeight: isFullscreen ? '100vh' : '550px', position: 'relative' }}>
          <MeteoDataPanel data={mapClickResult} tides={pointTides} onClose={() => setMapClickResult(null)} isLoading={isQueryingWindy} />
          
          <div className="absolute top-4 right-4 flex flex-col gap-3 z-20">
            <Button size="icon" className="shadow-2xl h-12 w-12 bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-2xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-6 text-primary" /> : <Expand className="size-6 text-primary" />}</Button>
            <Button onClick={handleRecenter} className="shadow-2xl h-12 w-12 bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-2xl p-0"><LocateFixed className="size-6 text-primary" /></Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <History className="size-4" /> Analyse Tactique
          </h3>
          <Alert className="bg-muted/10 border-dashed border-2">
              <Info className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-bold uppercase leading-relaxed">
                  Cliquez n'importe où sur la mer pour ouvrir l'analyseur Windy et obtenir un rapport complet incluant les marées et la température de l'eau.
              </AlertDescription>
          </Alert>
      </div>
    </div>
  );
}

const getClosestCommune = (lat: number, lng: number) => {
    let closestName = 'Nouméa';
    let minDistance = Infinity;
    Object.entries(locations).forEach(([name, coords]) => {
        const dist = getDistance(lat, lng, coords.lat, coords.lon);
        if (dist < minDistance) {
            minDistance = dist;
            closestName = name;
        }
    });
    return closestName;
};

const locations: Record<string, { lat: number, lon: number }> = {
    'Bélep': { lat: -19.70, lon: 163.66 }, 'Boulouparis': { lat: -21.86, lon: 165.99 },
    'Bourail': { lat: -21.56, lon: 165.48 }, 'Canala': { lat: -21.52, lon: 165.96 },
    'Dumbéa': { lat: -22.15, lon: 166.44 }, 'Farino': { lat: -21.64, lon: 165.77 },
    'Hienghène': { lat: -20.68, lon: 164.93 }, 'Houaïlou': { lat: -21.28, lon: 165.62 },
    'Ile des Pins': { lat: -22.64, lon: 167.48 }, 'Kaala-Gomen': { lat: -20.66, lon: 164.40 },
    'Koné': { lat: -21.05, lon: 164.86 }, 'Kouaoua': { lat: -21.39, lon: 165.82 },
    'Koumac': { lat: -20.56, lon: 164.28 }, 'La Foa': { lat: -21.71, lon: 165.82 },
    'Lifou': { lat: -20.91, lon: 167.24 }, 'Maré': { lat: -21.48, lon: 167.98 },
    'Moindou': { lat: -21.69, lon: 165.68 }, 'Le Mont-Dore': { lat: -22.21, lon: 166.57 },
    'Nouméa': { lat: -22.27, lon: 166.45 }, 'Ouégoa': { lat: -20.35, lon: 164.43 },
    'Ouvéa': { lat: -20.45, lon: 166.56 }, 'Païta': { lat: -22.13, lon: 166.35 },
    'Poindimié': { lat: -20.94, lon: 165.33 }, 'Ponérihouen': { lat: -21.09, lon: 165.40 },
    'Pouébo': { lat: -20.39, lon: 164.58 }, 'Pouembout': { lat: -21.13, lon: 164.90 },
    'Poum': { lat: -20.23, lon: 164.02 }, 'Poya': { lat: -21.34, lon: 165.15 },
    'Sarraméa': { lat: -21.63, lon: 165.84 }, 'Thio': { lat: -21.61, lon: 166.21 },
    'Voh': { lat: -20.96, lon: 164.70 }, 'Yaté': { lat: -22.15, lon: 166.93 },
};
