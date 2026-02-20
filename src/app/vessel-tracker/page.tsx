
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
  Info
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, SoundLibraryEntry, UserAccount } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_FORECAST_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // Navigation & UI States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState('ecmwf');
  const [currentOverlay, setCurrentOverlay] = useState('wind');
  const [authError, setAuthError] = useState<boolean>(false);
  const [currentHost, setCurrentHost] = useState('');
  
  const mapRef = useRef<any>(null);
  const [hasLaunched, setHasLaunched] = useState(false);

  // RECENTER FUNCTION - DEFINED AT TOP FOR STABILITY
  const handleRecenter = useCallback(() => {
    if (mapRef.current) {
        mapRef.current.panTo([INITIAL_CENTER.lat, INITIAL_CENTER.lng]);
        mapRef.current.setZoom(10);
    }
  }, []);

  // REFERRER POLICY FIX
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCurrentHost(window.location.host);
    
    // Inject Referrer Policy
    const meta = document.createElement('meta');
    meta.name = "referrer";
    meta.content = "no-referrer-when-downgrade";
    document.head.appendChild(meta);
    document.referrerPolicy = "no-referrer-when-downgrade";
  }, []);

  const initWindyMap = useCallback(() => {
    if (typeof window === 'undefined' || hasLaunched) return;

    const loadScript = (id: string, src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) { resolve(); return; }
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.async = true;
            script.referrerPolicy = 'no-referrer-when-downgrade';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    };

    const attemptInit = async () => {
        try {
            await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
            let retries = 0;
            while (!(window as any).L && retries < 10) { await new Promise(r => setTimeout(r, 500)); retries++; }
            
            (window as any).W = { apiKey: MAP_FORECAST_KEY };
            await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');
            
            const options = {
                key: MAP_FORECAST_KEY,
                lat: INITIAL_CENTER.lat,
                lon: INITIAL_CENTER.lng,
                zoom: 10,
                overlays: ['wind', 'waves', 'pressure', 'temp', 'sst', 'rh', 'swell'],
                product: 'ecmwf',
            };

            if (!(window as any).windyInit) return;

            (window as any).windyInit(options, (windyAPI: any) => {
                if (!windyAPI) { setAuthError(true); return; }
                mapRef.current = windyAPI.map;
                setHasLaunched(true);
                setAuthError(false);
                setTimeout(() => { if(windyAPI.map) windyAPI.map.invalidateSize(); }, 1000);
            });
        } catch (e) {
            console.error("Windy Error:", e);
            setAuthError(true);
        }
    };

    attemptInit();
  }, [hasLaunched]);

  useEffect(() => {
    const timer = setTimeout(initWindyMap, 2000);
    return () => clearTimeout(timer);
  }, [initWindyMap]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      {authError && (
          <Alert variant="destructive" className="border-2 shadow-lg animate-in slide-in-from-top-2">
              <ShieldAlert className="size-5" />
              <AlertTitle className="font-black uppercase text-xs">Authentification Windy échouée (401)</AlertTitle>
              <AlertDescription className="space-y-3">
                  <p className="text-[10px] font-medium leading-relaxed">
                      L'hôte actuel n'est pas autorisé. Copiez l'hôte ci-dessous et ajoutez-le à votre clé sur Windy.com.
                  </p>
                  <div className="flex gap-2">
                      <Input value={currentHost} readOnly className="h-9 bg-white text-[9px] font-mono border-2" />
                      <Button size="sm" className="h-9 font-black uppercase text-[9px]" onClick={() => { navigator.clipboard.writeText(currentHost); toast({ title: "Copié !" }); }}>Copier</Button>
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
                      <select 
                        value={currentModel} 
                        onChange={(e) => { 
                            setCurrentModel(e.target.value); 
                            if(mapRef.current) mapRef.current.fire('changeModel', e.target.value); 
                        }} 
                        className="w-full h-11 border-2 rounded-xl bg-white font-black uppercase text-[10px] px-3 appearance-none outline-none"
                      >
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
                      <select 
                        value={currentOverlay} 
                        onChange={(e) => { 
                            setCurrentOverlay(e.target.value); 
                            if(mapRef.current) mapRef.current.fire('changeOverlay', e.target.value); 
                        }} 
                        className="w-full h-11 border-2 rounded-xl bg-white font-black uppercase text-[10px] px-3 appearance-none outline-none"
                      >
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
          {!hasLaunched && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4 p-8 text-center">
                  <RefreshCw className="size-12 text-primary animate-spin" />
                  <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Chargement carte maritime...</p>
              </div>
          )}
          
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
                  Consultez les conditions météo globales sur la carte. Les navires actifs s'affichent automatiquement dès leur mise en ligne.
              </AlertDescription>
          </Alert>
      </div>
    </div>
  );
}
