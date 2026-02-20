
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  ShieldAlert,
  Send,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

export default function VesselTrackerPage() {
  const { toast } = useToast();

  // --- 1. FONCTIONS DE NAVIGATION (HOISTED) ---
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

  // --- 2. ÉTATS DE DIAGNOSTIC & INITIALISATION ---
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [origin, setOrigin] = useState('');
  const [referrer, setReferrer] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // États de Test API
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number, ok: boolean, msg: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Capturer les infos exactes pour le diagnostic 401
    setHost(window.location.host);
    setOrigin(window.location.origin);
    setReferrer(document.referrer || 'Aucun (Direct)');

    // Forcer la politique de Referrer pour Windy (Crucial pour Iframe)
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
        // Interception console.error pour éviter l'overlay fatal de Next.js
        const originalConsoleError = console.error;
        console.error = (...args) => {
          const msg = args[0] ? String(args[0]) : '';
          if (msg.includes('Windy API key') || msg.includes('authorize') || msg.includes('401')) {
            setError("ERREUR 401 : Authentification refusée pour ce domaine.");
            return;
          }
          originalConsoleError.apply(console, args);
        };

        // 1. Leaflet (Pré-requis Windy)
        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        
        // 2. Configuration API
        (window as any).W = { apiKey: MAP_KEY };
        
        // 3. Windy Boot
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        // 4. Attente et Initialisation
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
                        setError("Échec critique : Windy n'a pas pu s'initialiser.");
                        return;
                    }
                    setIsInitialized(true);
                });
            }
            if (attempts > 50) {
                clearInterval(checkInit);
                setError("Délai d'attente dépassé (windyInit introuvable).");
            }
        }, 200);

      } catch (e: any) {
        setError(e.message);
      }
    };

    const timer = setTimeout(init, 1000);
    return () => {
        clearTimeout(timer);
        if (document.head.contains(meta)) document.head.removeChild(meta);
    };
  }, []);

  const handleApiTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    console.log("--- START WINDY API TRACE ---");
    console.log("Target URL: https://api.windy.com/api/map-forecast/v2/auth");
    console.log("Key used:", MAP_KEY);
    console.log("Referrer Policy used: no-referrer-when-downgrade");
    
    try {
        const payload = { key: MAP_KEY };
        console.log("Request Payload:", payload);

        const res = await fetch('https://api.windy.com/api/map-forecast/v2/auth', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // Note: Referer and Origin are protected headers, browser handles them
            },
            body: JSON.stringify(payload)
        });
        
        console.log("Response Status:", res.status);
        console.log("Response OK:", res.ok);

        if (res.status === 200) {
            setTestResult({ status: 200, ok: true, msg: "Authentification RÉUSSIE ! La carte devrait s'afficher." });
            toast({ title: "Test API OK ✅", description: "Communication Windy rétablie." });
        } else if (res.status === 401) {
            setTestResult({ status: 401, ok: false, msg: "ÉCHEC 401 : Le domaine n'est toujours pas autorisé." });
            toast({ variant: "destructive", title: "Test API Échoué 401 ❌", description: "Vérifiez vos restrictions Windy." });
        } else if (res.status === 400) {
            setTestResult({ status: 400, ok: false, msg: "ÉCHEC 400 : Requête mal formée. Windy attend peut-être un format différent." });
        } else {
            setTestResult({ status: res.status, ok: false, msg: `Erreur inattendue : Statut ${res.status}` });
        }
    } catch (e: any) {
        console.error("Fetch Error Trace:", e);
        setTestResult({ status: 0, ok: false, msg: `Erreur réseau : ${e.message}` });
    } finally {
        console.log("--- END WINDY API TRACE ---");
        setIsTesting(false);
    }
  };

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
          <Badge className="bg-green-600 text-white font-black px-3 py-1 shadow-sm">AUTH OK</Badge>
        ) : error ? (
          <Badge variant="destructive" className="font-black px-3 py-1 shadow-sm animate-pulse">AUTH 401</Badge>
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

      {error && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <Alert variant="destructive" className="border-2 shadow-xl bg-white text-destructive rounded-3xl overflow-hidden p-6">
            <ShieldAlert className="size-6 mb-2" />
            <AlertTitle className="font-black uppercase text-base mb-4 tracking-tighter">Échec Authentification (401)</AlertTitle>
            <AlertDescription className="space-y-6 text-foreground">
              <p className="text-xs font-medium text-slate-700 leading-relaxed italic border-l-4 border-red-200 pl-3">
                Windy rejette la clé. Copiez-collez les **3 valeurs exactes** ci-dessous dans votre console [api.windy.com/keys](https://api.windy.com/keys) :
              </p>
              
              <div className="grid gap-3">
                <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-100 flex items-center justify-between shadow-inner">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase text-red-800 opacity-60 tracking-widest">1. Referrer (Parent / Iframe)</span>
                    <code className="text-[10px] font-black truncate text-red-950 mt-1">{referrer}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-10 w-10 hover:bg-red-100 rounded-xl" onClick={() => copyToClipboard(referrer)}><Copy className="size-4" /></Button>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-100 flex items-center justify-between shadow-inner">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase text-red-800 opacity-60 tracking-widest">2. Origin (Navigateur)</span>
                    <code className="text-[10px] font-black truncate text-red-950 mt-1">{origin}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-10 w-10 hover:bg-red-100 rounded-xl" onClick={() => copyToClipboard(origin)}><Copy className="size-4" /></Button>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-100 flex items-center justify-between shadow-inner">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase text-red-800 opacity-60 tracking-widest">3. Host (Hébergement)</span>
                    <code className="text-[10px] font-black truncate text-red-950 mt-1">{host}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-10 w-10 hover:bg-red-100 rounded-xl" onClick={() => copyToClipboard(host)}><Copy className="size-4" /></Button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-red-100">
                <h4 className="text-[10px] font-black uppercase text-red-800 tracking-widest flex items-center gap-2">
                    <Zap className="size-3 fill-red-600" /> Test de communication Deep Trace
                </h4>
                
                <Button 
                    variant="outline" 
                    className="w-full h-14 border-2 font-black uppercase tracking-widest text-xs gap-3 shadow-md active:scale-95 transition-all bg-white"
                    onClick={handleApiTest}
                    disabled={isTesting}
                >
                    {isTesting ? <RefreshCw className="size-5 animate-spin" /> : <Send className="size-5" />}
                    {isTesting ? "Test en cours..." : "Lancer un Test de Connexion"}
                </Button>

                {testResult && (
                    <div className={cn(
                        "p-4 rounded-2xl border-2 text-center animate-in zoom-in-95",
                        testResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                    )}>
                        <p className="text-xs font-black uppercase">{testResult.msg}</p>
                        <p className="text-[10px] font-bold opacity-60 mt-1">HTTP STATUS: {testResult.status}</p>
                    </div>
                )}
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100 flex items-start gap-3 shadow-sm">
                <AlertTriangle className="size-5 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[10px] leading-relaxed text-blue-900 font-bold">
                  Note Studio : Si le Referrer est `studio.firebase.google.com`, vous DEVEZ l'ajouter car l'application s'affiche dans une Iframe.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ISOLATION DOM (Fix removeChild) */}
      <div className={cn(
          "relative w-full transition-all duration-500 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden",
          isFullscreen ? "fixed inset-0 z-[200] h-screen w-screen rounded-none" : "h-[500px]"
      )}>
        <div 
          id="windy" 
          key="windy-map-canvas"
          className={cn(
              "w-full h-full transition-opacity duration-1000",
              isInitialized ? "opacity-100" : "opacity-0"
          )}
        ></div>
        
        <div className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-900 transition-all duration-700 pointer-events-none",
            (isInitialized || error) ? "opacity-0" : "opacity-100"
        )}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation tactique...</p>
        </div>

        <Button 
            size="icon" 
            variant="secondary"
            onClick={() => setIsFullscreen(!isFullscreen)} 
            className="absolute top-4 left-4 shadow-2xl h-10 w-10 z-[210] bg-white/90 backdrop-blur-md border-2 hover:bg-white"
        >
            {isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}
        </Button>
      </div>
    </div>
  );
}
