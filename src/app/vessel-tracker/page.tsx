
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, where, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
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
  LocateFixed, 
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  RefreshCw,
  ChevronDown,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, WindDirection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_FORECAST_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState('ecmwf');
  const [currentOverlay, setCurrentOverlay] = useState('wind');
  const [authError, setAuthError] = useState<boolean>(false);
  const [currentHost, setCurrentHost] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  
  const mapRef = useRef<any>(null);
  const [hasLaunched, setHasLaunched] = useState(false);

  /**
   * RÉSOLUTION DU CRASH ReferenceError
   * Fonctions déclarées avec useCallback pour garantir la disponibilité en production
   */
  const handleRecenter = useCallback(() => {
    if (mapRef.current) {
        // Windy API use setCenter([lat, lon]) or setView([lat, lon], zoom)
        try {
            mapRef.current.setView([INITIAL_CENTER.lat, INITIAL_CENTER.lng], 10);
        } catch (e) {
            console.log("Recenter using panTo fallback");
            if (mapRef.current.panTo) mapRef.current.panTo([INITIAL_CENTER.lat, INITIAL_CENTER.lng]);
        }
    } else {
        toast({ description: "Carte non initialisée" });
    }
  }, [toast]);

  const handleSearch = useCallback(() => { console.log('Search placeholder'); }, []);
  const handleFilter = useCallback(() => { console.log('Filter placeholder'); }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCurrentHost(window.location.host);
    
    // Forçage de la Referrer Policy pour l'authentification Windy
    // Essentiel pour studio.firebase.google.com
    const meta = document.createElement('meta');
    meta.name = "referrer";
    meta.content = "no-referrer-when-downgrade";
    document.head.appendChild(meta);
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
            // Windy nécessite Leaflet en premier
            await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
            
            // Attendre que L soit dispo
            let retries = 0;
            while (!(window as any).L && retries < 10) { 
                await new Promise(r => setTimeout(r, 500)); 
                retries++; 
            }
            
            // Initialisation de la clé globale Windy
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
                if (!windyAPI) { 
                    setAuthError(true); 
                    return; 
                }
                mapRef.current = windyAPI.map;
                setHasLaunched(true);
                setAuthError(false);
                // Rafraîchir la taille après chargement
                setTimeout(() => { 
                    if(windyAPI.map) windyAPI.map.invalidateSize(); 
                }, 1000);
            });
        } catch (e) {
            console.error("Windy Initialization Error:", e);
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
      {/* PANNEAU DE DIAGNOSTIC 401 - S'affiche uniquement en cas d'erreur auth */}
      {authError && (
          <Alert variant="destructive" className="border-2 shadow-lg animate-in slide-in-from-top-2 bg-white">
              <ShieldAlert className="size-5" />
              <AlertTitle className="font-black uppercase text-xs">Authentification Windy échouée (401)</AlertTitle>
              <AlertDescription className="space-y-3">
                  <p className="text-[10px] font-medium leading-relaxed">
                      L'hôte actuel n'est pas autorisé pour votre clé API. Ajoutez cet hôte exact à votre console Windy.com :
                  </p>
                  <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input value={currentHost} readOnly className="h-10 bg-slate-50 text-[10px] font-mono border-2 pl-3" />
                      </div>
                      <Button 
                        size="sm" 
                        className="h-10 font-black uppercase text-[9px] gap-2 px-4" 
                        onClick={() => { 
                            navigator.clipboard.writeText(currentHost); 
                            setHasCopied(true);
                            setTimeout(() => setHasCopied(false), 2000);
                            toast({ title: "Hôte copié !" }); 
                        }}
                      >
                        {hasCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                        {hasCopied ? "Copié" : "Copier l'hôte"}
                      </Button>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-dashed text-[9px] font-bold leading-relaxed text-slate-600">
                    <p>1. Allez sur <a href="https://api.windy.com/keys" target="_blank" className="underline text-primary">api.windy.com/keys</a></p>
                    <p>2. Modifiez la clé <strong>1gGm...</strong></p>
                    <p>3. Collez l'hôte ci-dessus dans "Domain restrictions"</p>
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
                  <p className="font-black uppercase text-[10px] tracking-widest text-slate-400">Initialisation de la carte maritime...</p>
              </div>
          )}
          
          <div className="absolute top-4 right-4 flex flex-col gap-3 z-20">
            <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="shadow-2xl h-12 w-12 bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-2xl">
                {isFullscreen ? <Shrink className="size-6 text-primary" /> : <Expand className="size-6 text-primary" />}
            </Button>
            <Button onClick={handleRecenter} className="shadow-2xl h-12 w-12 bg-background/90 backdrop-blur-md border-2 border-primary/20 rounded-2xl p-0">
                <LocateFixed className="size-6 text-primary" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <Zap className="size-4 text-primary" /> Analyse Tactique
          </h3>
          <Alert className="bg-muted/10 border-dashed border-2">
              <Info className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-bold uppercase leading-relaxed text-slate-600">
                  Visualisez les courants, les vents et l'état de la mer en temps réel. Cette vue est synchronisée avec les données de sécurité du Boat Tracker.
              </AlertDescription>
          </Alert>
      </div>
    </div>
  );
}
