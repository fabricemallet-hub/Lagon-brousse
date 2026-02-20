
'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where } from 'firebase/firestore';
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
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

export default function VesselTrackerPage() {
  const { toast } = useToast();

  // --- ÉTAPE 1 : DÉFINITIONS STABLES (Fix ReferenceError) ---
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

  // --- ÉTAPE 2 : ÉTATS ET INITIALISATION ---
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [origin, setOrigin] = useState('');
  const [referrer, setReferrer] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setHost(window.location.host);
    setOrigin(window.location.origin);
    setReferrer(document.referrer || 'Aucun (Direct)');

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
        // Interception console.error Windy pour éviter le crash fatal de Next.js
        const originalConsoleError = console.error;
        console.error = (...args) => {
          if (args[0] && typeof args[0] === 'string' && (args[0].includes('Windy API key') || args[0].includes('authorize'))) {
            setError("401 Unauthorized - La clé a été rejetée par Windy.");
            return;
          }
          originalConsoleError.apply(console, args);
        };

        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        (window as any).W = { apiKey: MAP_KEY };
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

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
                        setError("401 Unauthorized - Échec de validation du domaine par Windy.");
                        return;
                    }
                    setIsInitialized(true);
                });
            }
            if (attempts > 50) {
                clearInterval(checkInit);
                setError("Délai d'attente dépassé (windyInit)");
            }
        }, 100);

      } catch (e: any) {
        setError(e.message);
      }
    };

    const timer = setTimeout(init, 1000);
    return () => clearTimeout(timer);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié !" });
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
          <Badge variant="destructive" className="font-black px-3 py-1">ERREUR 401</Badge>
        ) : (
          <Badge variant="outline" className="font-black px-3 py-1 animate-pulse">CHARGEMENT...</Badge>
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
            <AlertTitle className="font-black uppercase text-sm mb-4">Échec Authentification Windy (401)</AlertTitle>
            <AlertDescription className="space-y-4 text-foreground">
              <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                Windy rejette la clé car il ne reconnaît pas l'un de ces domaines. 
                Veuillez les ajouter exactement comme affichés sur [api.windy.com/keys](https://api.windy.com/keys) :
              </p>
              
              <div className="grid gap-2">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">Referrer (Studio Parent)</span>
                    <code className="text-[10px] font-black truncate">{referrer}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(referrer)}><Copy className="size-3" /></Button>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">Host (App Hosted)</span>
                    <code className="text-[10px] font-black truncate">{host}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(host)}><Copy className="size-3" /></Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <CheckCircle2 className="size-4 text-blue-600 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-slate-700 font-bold">
                  Astuce : Si vous utilisez **Firebase Studio**, Windy bloque souvent l'URL parente. Autorisez `studio.firebase.google.com` dans vos restrictions.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ISOLATION DU DOM (Fix removeChild) */}
      <div className="relative w-full h-[500px] rounded-[2.5rem] border-4 shadow-2xl overflow-hidden group bg-slate-100">
        {/* Windy Container : React ne touchera jamais aux enfants de ce div */}
        <div 
          id="windy" 
          key="windy-map-root"
          className={cn(
              "w-full h-full transition-opacity duration-1000",
              isInitialized ? "opacity-100" : "opacity-0"
          )}
        ></div>
        
        {/* LOADER OVERLAY : Sibling du div windy pour éviter les conflits DOM */}
        {!isInitialized && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 z-10 bg-slate-50">
                <RefreshCw className="size-10 animate-spin text-primary/40" />
                <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation tactique...</p>
            </div>
        )}
      </div>
    </div>
  );
}
