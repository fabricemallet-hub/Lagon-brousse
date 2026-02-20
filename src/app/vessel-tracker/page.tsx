
'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  XCircle,
  CheckCircle2,
  Copy,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

export default function VesselTrackerPage() {
  const { toast } = useToast();

  // --- 1. DÉFINITIONS DES FONCTIONS (Fix ReferenceError) ---
  function handleRecenter() {
    console.log('Action: Recenter triggered');
    toast({ title: "Recentrer", description: "Recentrage sur votre position..." });
  }

  function handleSearch() {
    console.log('Action: Search triggered');
    toast({ title: "Recherche", description: "Outil de recherche actif." });
  }

  function handleFilter() {
    console.log('Action: Filter triggered');
    toast({ title: "Filtres", description: "Filtres de flotte actifs." });
  }

  // --- 2. ÉTATS DE DIAGNOSTIC ---
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [origin, setOrigin] = useState('');
  const [referrer, setReferrer] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Capturer les infos exactes pour le diagnostic 401
    setHost(window.location.host);
    setOrigin(window.location.origin);
    setReferrer(document.referrer || 'Aucun (Direct)');

    // Injecter la politique de Referrer à la volée pour Windy
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
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // Interception console.error pour éviter l'écran rouge fatal de Next.js
        const originalConsoleError = console.error;
        console.error = (...args) => {
          const msg = args[0] ? String(args[0]) : '';
          if (msg.includes('Windy API key') || msg.includes('authorize') || msg.includes('401')) {
            setError("ERREUR 401 : Windy a rejeté la clé pour ce domaine.");
            return;
          }
          originalConsoleError.apply(console, args);
        };

        // 1. Leaflet
        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        
        // 2. Config Globale
        (window as any).W = { apiKey: MAP_KEY };
        
        // 3. Windy Boot
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        // 4. Attente de l'objet windyInit
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
                        setError("Échec critique : L'API Windy n'a pas pu s'initialiser (Validation domaine).");
                        return;
                    }
                    setIsInitialized(true);
                });
            }
            if (attempts > 60) {
                clearInterval(checkInit);
                setError("Délai d'attente dépassé (windyInit non disponible).");
            }
        }, 200);

      } catch (e: any) {
        setError(e.message);
      }
    };

    // Délai de sécurité pour laisser le temps au DOM de se stabiliser
    const timer = setTimeout(init, 1500);
    return () => {
        clearTimeout(timer);
        if (document.head.contains(meta)) document.head.removeChild(meta);
    };
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papier !" });
  };

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
          <Badge className="bg-green-600 text-white font-black px-3 py-1">AUTH OK</Badge>
        ) : error ? (
          <Badge variant="destructive" className="font-black px-3 py-1">AUTH 401</Badge>
        ) : (
          <Badge variant="outline" className="font-black px-3 py-1 animate-pulse">AUTH...</Badge>
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
            <Filter className="size-3" /> Filtrer
        </Button>
      </div>

      {error && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <Alert variant="destructive" className="border-2 shadow-xl bg-white text-destructive rounded-2xl overflow-hidden">
            <XCircle className="size-5" />
            <AlertTitle className="font-black uppercase text-sm mb-4">Échec Authentification (401)</AlertTitle>
            <AlertDescription className="space-y-4 text-foreground">
              <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                Windy rejette la clé car il ne reconnaît pas l'un de ces domaines. 
                Veuillez ajouter ces **3 valeurs exactes** dans votre console [api.windy.com/keys](https://api.windy.com/keys) :
              </p>
              
              <div className="grid gap-3">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">1. Referrer (Parent Studio)</span>
                    <code className="text-[10px] font-black truncate">{referrer}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-100" onClick={() => copyToClipboard(referrer)}><Copy className="size-3" /></Button>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">2. Origin (Navigateur)</span>
                    <code className="text-[10px] font-black truncate">{origin}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-100" onClick={() => copyToClipboard(origin)}><Copy className="size-3" /></Button>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">3. Host (Hébergement)</span>
                    <code className="text-[10px] font-black truncate">{host}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-100" onClick={() => copyToClipboard(host)}><Copy className="size-3" /></Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <CheckCircle2 className="size-4 text-blue-600 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-slate-700 font-bold">
                  Note : Dans Firebase Studio, c'est souvent `studio.firebase.google.com` qui doit être autorisé.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ISOLATION DOM (Fix removeChild) */}
      <div className={cn(
          "relative w-full transition-all duration-500 bg-slate-100 rounded-[2.5rem] border-4 shadow-2xl overflow-hidden",
          isFullscreen ? "fixed inset-0 z-[200] h-screen w-screen rounded-none" : "h-[500px]"
      )}>
        {/* Le div Windy doit être permanent. React ne doit pas le supprimer. */}
        <div 
          id="windy" 
          key="windy-map-canvas"
          className={cn(
              "w-full h-full transition-opacity duration-1000",
              isInitialized ? "opacity-100" : "opacity-0"
          )}
        ></div>
        
        {/* Le Loader est un overlay ABSOLU. On utilise l'opacité pour le "cacher" sans le supprimer du DOM. */}
        <div className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50 transition-all duration-700",
            (isInitialized || error) ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse text-center px-8">
                Initialisation tactique...<br/>
                <span className="text-[8px] opacity-60 font-bold">Vérification de la clé de carte</span>
            </p>
        </div>

        <Button 
            size="icon" 
            variant="secondary"
            onClick={() => setIsFullscreen(!isFullscreen)} 
            className="absolute top-4 left-4 shadow-2xl h-10 w-10 z-10 bg-white/90 backdrop-blur-md border-2"
        >
            {isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}
        </Button>
      </div>
    </div>
  );
}
