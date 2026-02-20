
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  AlertTriangle,
  Bell,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  History as HistoryIcon,
  MapPin,
  ChevronDown,
  X,
  Play,
  Volume2,
  Check,
  Trash2,
  Ship,
  Home,
  RefreshCw,
  Settings,
  Battery,
  MessageSquare,
  Eye,
  Smartphone,
  Phone,
  Waves,
  Info,
  Search,
  Copy,
  Layers,
  Database,
  Activity,
  Thermometer,
  Gauge,
  ArrowUp,
  Wind
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fetchWindyWeather } from '@/lib/windy-api';
import { getDataForDate } from '@/lib/data';
import { locations } from '@/lib/locations';

const MAP_FORECAST_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const getClosestCommune = (lat: number, lon: number) => {
    let closestName = 'Nouméa';
    let minDistance = Infinity;
    Object.entries(locations).forEach(([name, coords]) => {
        const dist = getDistance(lat, lon, coords.lat, coords.lon);
        if (dist < minDistance) { closestName = name; minDistance = dist; }
    });
    return closestName;
};

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const MeteoDataPanel = ({ data, onClose, isLoading, tides }: { data: any, onClose: () => void, isLoading: boolean, tides: any[] | null }) => {
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
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Wind className="size-2" /> Vent</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-blue-400">{data.windSpeed ?? '--'} <span className="text-[8px] opacity-60">ND</span></span>
                        {data.windDir !== undefined && <ArrowUp className="size-3 text-white/40" style={{ transform: `rotate(${data.windDir}deg)` }} />}
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Waves className="size-2" /> Mer</span>
                    <span className="text-sm font-black text-cyan-400">{data.waves ?? '--'}<span className="text-[8px] ml-0.5">m</span></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Thermometer className="size-2" /> Eau (SST)</span>
                    <span className="text-sm font-black text-emerald-400">{data.sst ?? '--'}°C</span>
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

  const [authError, setAuthError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState('ecmwf');
  const [currentOverlay, setCurrentOverlay] = useState('wind');
  
  const [mapClickResult, setMapClickResult] = useState<any>(null);
  const [pointTides, setPointTides] = useState<any[] | null>(null);
  const [isQueryingWindy, setIsQueryingWindy] = useState(false);
  
  const mapRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const pickerTimerRef = useRef<any>(null);

  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || isInitializingRef.current) return;
    isInitializingRef.current = true;

    const loadScript = (id: string, src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) { resolve(); return; }
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    };

    const attemptInit = async () => {
        try {
            await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
            
            let retries = 0;
            while (!(window as any).L && retries < 50) { 
                await new Promise(r => setTimeout(r, 100)); 
                retries++; 
            }
            
            if (!(window as any).L) throw new Error("Leaflet (L) non trouvé.");

            await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');
            
            const options = {
                key: MAP_FORECAST_KEY,
                lat: INITIAL_CENTER.lat,
                lon: INITIAL_CENTER.lng,
                zoom: 10,
                verbose: false,
                overlays: ['wind', 'waves', 'pressure', 'temp', 'sst', 'rh', 'swell'],
                product: 'ecmwf',
            };

            (window as any).windyInit(options, (windyAPI: any) => {
                if (!windyAPI) { 
                    setAuthError(window.location.host); 
                    return; 
                }
                const { map, store, broadcast, picker } = windyAPI;
                mapRef.current = map;
                store.set('overlay', 'wind');
                store.set('product', 'ecmwf');

                broadcast.on('pickerMoved', (latLon: any) => {
                    if (pickerTimerRef.current) clearTimeout(pickerTimerRef.current);
                    pickerTimerRef.current = setTimeout(async () => {
                        const { lat, lon } = latLon;
                        setMapClickResult({ lat, lon });
                        setIsQueryingWindy(true);
                        try {
                            const weather = await fetchWindyWeather(lat, lon);
                            setMapClickResult((prev: any) => ({ ...prev, ...weather }));
                            const commune = getClosestCommune(lat, lon);
                            const tideData = getDataForDate(commune, new Date());
                            setPointTides(tideData.tides);
                        } catch (err) {} finally { setIsQueryingWindy(false); }
                    }, 500);
                });

                map.on('click', (e: any) => { picker.open({ lat: e.latlng.lat, lon: e.latlng.lng }); });
                setTimeout(() => { if(map) map.invalidateSize(); }, 1500);
            });
        } catch (e: any) {
            console.error("Windy init error:", e);
            setAuthError(window.location.host);
            isInitializingRef.current = false;
        }
    };

    attemptInit();
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(initWindy, 1000);
    const diagTimer = setTimeout(() => {
        if (!mapRef.current) setAuthError(window.location.host);
    }, 6000);
    return () => { clearTimeout(timer); clearTimeout(diagTimer); };
  }, [initWindy]);

  const handleRecenter = () => {
    if (mapRef.current) {
        mapRef.current.panTo([INITIAL_CENTER.lat, INITIAL_CENTER.lng]);
        mapRef.current.setZoom(10);
    }
  };

  const copyOrigin = () => {
    if (typeof window !== 'undefined') {
        const host = window.location.host;
        navigator.clipboard.writeText(host);
        toast({ title: "HÔTE COPIÉ !", description: `Copié : ${host}` });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <meta name="referrer" content="no-referrer-when-downgrade" />

      {authError && (
        <Alert variant="destructive" className="bg-red-50 border-red-600 rounded-2xl border-2 shadow-xl animate-in slide-in-from-top-4">
            <ShieldAlert className="size-6" />
            <AlertTitle className="font-black uppercase text-sm mb-2">DIAGNOSTIC WINDY (401)</AlertTitle>
            <AlertDescription className="space-y-4">
                <div className="p-4 bg-white/80 rounded-xl border border-red-200">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Copiez cette valeur exacte (Hôte JavaScript) :</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-red-100 rounded font-mono text-[10px] select-all break-all">{authError}</code>
                        <Button size="icon" variant="ghost" onClick={copyOrigin} className="h-10 w-10 hover:bg-red-200">
                            <Copy className="size-4" />
                        </Button>
                    </div>
                </div>
                <div className="bg-red-100/50 p-3 rounded-lg text-[9px] font-bold text-red-900 space-y-2">
                    <p>1. Allez sur <strong>api.windy.com/keys</strong></p>
                    <p>2. Modifiez la clé Map Forecast (<strong>1gGm...</strong>)</p>
                    <p>3. Supprimez les espaces et utilisez des <strong>VIRGULES</strong>.</p>
                    <p className="font-black text-xs text-red-600">Exemple: domaine1.dev,domaine2.app,localhost</p>
                </div>
            </AlertDescription>
        </Alert>
      )}

      <Card className="border-2 shadow-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Modèle Météo</Label>
                  <div className="relative">
                      <select value={currentModel} onChange={(e) => { setCurrentModel(e.target.value); if(mapRef.current) mapRef.current.fire('changeModel', e.target.value); }} className="w-full h-11 border-2 rounded-xl bg-white font-black uppercase text-[10px] px-3 appearance-none shadow-sm outline-none">
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
                      <select value={currentOverlay} onChange={(e) => { setCurrentOverlay(e.target.value); if(mapRef.current) mapRef.current.fire('changeOverlay', e.target.value); }} className="w-full h-11 border-2 rounded-xl bg-white font-black uppercase text-[10px] px-3 appearance-none shadow-sm outline-none">
                          <option value="wind">Vent & Rafales</option>
                          <option value="waves">Mer & Vagues</option>
                          <option value="sst">Temp. Eau (SST)</option>
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
        <div id="windy" className="absolute inset-0 w-full h-full z-10">
          <MeteoDataPanel data={mapClickResult} tides={pointTides} onClose={() => setMapClickResult(null)} isLoading={isQueryingWindy} />
          <div className="absolute top-4 right-4 flex flex-col gap-3 z-20">
            <Button size="icon" className="shadow-2xl h-12 w-12 bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-2xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-6 text-primary" /> : <Expand className="size-6 text-primary" />}</Button>
            <Button onClick={handleRecenter} className="shadow-2xl h-12 w-12 bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-2xl p-0"><LocateFixed className="size-6 text-primary" /></Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <HistoryIcon className="size-4" /> Analyse Tactique
          </h3>
          <Alert className="bg-muted/10 border-dashed border-2">
              <Info className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-bold uppercase leading-relaxed">
                  Cliquez n'importe où sur la mer pour obtenir un rapport complet incluant les marées et la température de l'eau.
              </AlertDescription>
          </Alert>
      </div>
    </div>
  );
}
