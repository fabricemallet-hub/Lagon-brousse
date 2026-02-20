
'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Globe, ShieldAlert, CheckCircle2, Copy, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MAP_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

export default function VesselTrackerPage() {
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [origin, setOrigin] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHost(window.location.host);
    setOrigin(window.location.origin);

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
        script.referrerPolicy = 'unsafe-url';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // Injection forcée de la Referrer Policy dans le document
        let meta = document.querySelector('meta[name="referrer"]') as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = "referrer";
          document.head.appendChild(meta);
        }
        meta.content = "unsafe-url";

        // INTERCEPTION console.error pour éviter le crash Overlay de Next.js
        const originalConsoleError = console.error;
        console.error = (...args) => {
          if (args[0] && typeof args[0] === 'string' && args[0].includes('Windy API key')) {
            setError("401 Unauthorized - La clé a été rejetée par Windy.");
            return;
          }
          originalConsoleError.apply(console, args);
        };

        // Chargement séquentiel
        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        
        // Configuration globale requise par Windy
        (window as any).W = { apiKey: MAP_KEY };

        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        if (!(window as any).windyInit) {
            setError("L'objet window.windyInit est introuvable.");
            console.error = originalConsoleError;
            return;
        }

        const options = {
          key: MAP_KEY,
          lat: -21.3,
          lon: 165.5,
          zoom: 7,
        };

        // Lancement de l'initialisation
        (window as any).windyInit(options, (windyAPI: any) => {
          // Restauration de la console après init
          console.error = originalConsoleError;
          
          if (!windyAPI) {
            setError("401 Unauthorized - Échec de validation du domaine par Windy.");
            return;
          }
          setIsInitialized(true);
          console.log("Windy Map OK !");
        });
      } catch (e: any) {
        setError(e.message);
      }
    };

    // On attend 1s pour laisser le temps aux meta tags de s'appliquer
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
            <Globe className="text-primary" /> Diagnostic Windy v18.0
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Test d'authentification de production</p>
        </div>
        {isInitialized ? (
          <Badge className="bg-green-600 text-white font-black px-3 py-1">AUTH VALIDÉE</Badge>
        ) : error ? (
          <Badge variant="destructive" className="font-black px-3 py-1">ÉCHEC AUTH</Badge>
        ) : (
          <Badge variant="outline" className="font-black px-3 py-1 animate-pulse">INIT EN COURS...</Badge>
        )}
      </div>

      {error && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <Alert variant="destructive" className="border-2 shadow-xl bg-white text-destructive">
            <XCircle className="size-5" />
            <AlertTitle className="font-black uppercase text-sm mb-4">Erreur d'accès à la carte (401)</AlertTitle>
            <AlertDescription className="space-y-4">
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                Windy rejette la clé car l'URL envoyée par votre navigateur ne correspond pas à vos restrictions.
              </p>
              
              <div className="grid gap-3">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">Valeur Host (Hôte)</span>
                    <code className="text-[10px] font-black truncate select-all">{host}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(host)}><Copy className="size-3" /></Button>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">Valeur Origin (Origine)</span>
                    <code className="text-[10px] font-black truncate select-all">{origin}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(origin)}><Copy className="size-3" /></Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-[10px] font-black uppercase text-blue-800 flex items-center gap-2">
                  <CheckCircle2 className="size-3" /> Action corrective :
                </p>
                <ol className="text-[11px] space-y-2 list-decimal list-inside text-slate-700 font-medium">
                  <li>Copiez l'<strong>Hôte</strong> ci-dessus.</li>
                  <li>Allez sur <a href="https://api.windy.com/keys" target="_blank" className="underline font-black text-blue-600">votre console Windy</a>.</li>
                  <li>Remplacez vos restrictions par l'hôte exactement tel qu'il est écrit.</li>
                  <li>Sauvegardez et rafraîchissez cette page.</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div 
        id="windy" 
        className={cn(
            "w-full h-[500px] rounded-[2.5rem] border-4 shadow-2xl overflow-hidden transition-all duration-1000 relative",
            isInitialized ? "border-green-500/20" : "bg-slate-100 border-slate-200 grayscale"
        )}
      >
        {!isInitialized && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50">
                <RefreshCw className="size-10 animate-spin text-primary/40" />
                <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation des scripts...</p>
            </div>
        )}
      </div>
    </div>
  );
}
