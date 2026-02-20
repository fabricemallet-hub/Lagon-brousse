'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Navigation, 
  LocateFixed, 
  Expand, 
  Shrink, 
  Zap, 
  Globe, 
  Search, 
  Filter, 
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// CLÉ API WINDY VALIDE
const MAP_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';

export default function VesselTrackerPage() {
  const { toast } = useToast();

  // --- 1. FONCTIONS DE NAVIGATION ---
  function handleRecenter() {
    toast({ title: "Recentrer", description: "Recentrage sur votre position..." });
  }

  function handleSearch() {
    toast({ title: "Recherche", description: "Outil de recherche actif." });
  }

  function handleFilter() {
    toast({ title: "Filtres", description: "Filtres de flotte actifs." });
  }

  // --- 2. ÉTATS DU COMPOSANT ---
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Politique de Referrer pour l'Iframe Studio
    const meta = document.createElement('meta');
    meta.name = "referrer";
    meta.content = "no-referrer-when-downgrade";
    document.head.appendChild(meta);

    const loadScript = (id: string, src: string) => {
      return new Promise<void>((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.referrerPolicy = 'no-referrer-when-downgrade';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Échec chargement script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // 1. Leaflet (Pré-requis Windy)
        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        
        // 2. Configuration API
        (window as any).W = { apiKey: MAP_KEY };
        
        // 3. Windy Boot
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        // 4. Initialisation de la carte
        let attempts = 0;
        const checkInit = setInterval(() => {
            attempts++;
            if ((window as any).windyInit) {
                clearInterval(checkInit);
                const options = {
                    key: MAP_KEY,
                    lat: -21.3,
                    lon: 165.5,
                    zoom: 7,
                };

                (window as any).windyInit(options, (windyAPI: any) => {
                    if (!windyAPI) {
                        setError("Windy n'a pas pu s'initialiser.");
                        return;
                    }
                    setIsInitialized(true);
                });
            }
            if (attempts > 50) {
                clearInterval(checkInit);
                setError("Délai d'attente dépassé.");
            }
        }, 200);

      } catch (e: any) {
        setError(e.message);
      }
    };

    const timer = setTimeout(init, 500);
    return () => {
        clearTimeout(timer);
        if (document.head.contains(meta)) document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-32">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Globe className="text-primary" /> Boat Tracker
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Surveillance Maritime NC</p>
        </div>
        {isInitialized ? (
          <Badge className="bg-green-600 text-white font-black px-3 py-1 shadow-sm">AUTH OK</Badge>
        ) : error ? (
          <Badge variant="destructive" className="font-black px-3 py-1 shadow-sm">ERREUR AUTH</Badge>
        ) : (
          <Badge variant="outline" className="font-black px-3 py-1 animate-pulse border-2">INITIALISATION...</Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase border-2 gap-2" onClick={handleRecenter}>
            <LocateFixed className="size-3" /> Recentrer
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase border-2 gap-2" onClick={handleSearch}>
            <Search className="size-3" /> Chercher
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase border-2 gap-2" onClick={handleFilter}>
            <Filter className="size-3" /> Filtres
        </Button>
      </div>

      <div className={cn(
          "relative w-full transition-all duration-500 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden",
          isFullscreen ? "fixed inset-0 z-[200] h-screen w-screen rounded-none" : "h-[550px]"
      )}>
        {/* Conteneur Windy isolé */}
        <div 
          id="windy" 
          key="windy-map-canvas"
          className={cn(
              "w-full h-full transition-opacity duration-1000",
              isInitialized ? "opacity-100" : "opacity-0"
          )}
        ></div>
        
        {/* Loader Overly (Masqué par CSS pour éviter removeChild error) */}
        <div className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-900 transition-all duration-700 pointer-events-none",
            (isInitialized || error) ? "opacity-0 invisible" : "opacity-100 visible"
        )}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation tactique...</p>
        </div>

        {/* Bouton Plein Écran */}
        <Button 
            size="icon" 
            variant="secondary"
            onClick={() => setIsFullscreen(!isFullscreen)} 
            className="absolute top-4 left-4 shadow-2xl h-10 w-10 z-[210] bg-white/90 backdrop-blur-md border-2 hover:bg-white"
        >
            {isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}
        </Button>
      </div>

      {error && (
        <Card className="border-2 border-red-100 bg-red-50 p-4">
            <p className="text-xs font-bold text-red-600 uppercase text-center">
                Impossible de charger la carte Windy. Vérifiez votre clé API ou votre connexion.
            </p>
        </Card>
      )}
    </div>
  );
}
