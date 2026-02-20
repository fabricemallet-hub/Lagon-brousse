
'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Globe,
  Search,
  Filter,
  XCircle,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MAP_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

export default function VesselTrackerPage() {
  // --- DÉFINITION DES FONCTIONS DE RECENTREMENT ---
  const handleRecenter = useCallback(() => {
    console.log('Action: Recenter triggered');
  }, []);

  const handleSearch = useCallback(() => {
    console.log('Action: Search triggered');
  }, []);

  const handleFilter = useCallback(() => {
    console.log('Action: Filter triggered');
  }, []);

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
        script.referrerPolicy = 'no-referrer-when-downgrade';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // Politique de referrer pour autoriser Studio
        let meta = document.querySelector('meta[name="referrer"]') as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = "referrer";
          document.head.appendChild(meta);
        }
        meta.content = "no-referrer-when-downgrade";

        // Interception console.error Windy (Fix Next.js crash Overlay)
        const originalConsoleError = console.error;
        console.error = (...args) => {
          if (args[0] && typeof args[0] === 'string' && args[0].includes('Windy API key')) {
            setError("401 Unauthorized - La clé a été rejetée.");
            return;
          }
          originalConsoleError.apply(console, args);
        };

        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        (window as any).W = { apiKey: MAP_KEY };
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        if (!(window as any).windyInit) {
            setError("L'objet window.windyInit est introuvable.");
            return;
        }

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
          console.log("Windy Map OK !");
        });
      } catch (e: any) {
        setError(e.message);
      }
    };

    const timer = setTimeout(init, 1000);
    return () => {
        clearTimeout(timer);
    };
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
            <Globe className="text-primary" /> Boat Tracker v18.2
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Surveillance & Diagnostic</p>
        </div>
        {isInitialized ? (
          <Badge className="bg-green-600 text-white font-black px-3 py-1">AUTH VALIDÉE</Badge>
        ) : error ? (
          <Badge variant="destructive" className="font-black px-3 py-1">ÉCHEC AUTH</Badge>
        ) : (
          <Badge variant="outline" className="font-black px-3 py-1 animate-pulse">INITIALISATION...</Badge>
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
          <Alert variant="destructive" className="border-2 shadow-xl bg-white text-destructive">
            <XCircle className="size-5" />
            <AlertTitle className="font-black uppercase text-sm mb-4">Erreur d'accès à la carte (401)</AlertTitle>
            <AlertDescription className="space-y-4">
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                Windy rejette la clé car l'URL envoyée ne correspond pas à vos restrictions.
              </p>
              
              <div className="grid gap-3">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">Hôte détecté</span>
                    <code className="text-[10px] font-black truncate select-all">{host}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(host)}><Copy className="size-3" /></Button>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase opacity-60">Origine détectée</span>
                    <code className="text-[10px] font-black truncate select-all">{origin}</code>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(origin)}><Copy className="size-3" /></Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-[10px] font-black uppercase text-blue-800 flex items-center gap-2">
                  <CheckCircle2 className="size-3" /> Action Requise :
                </p>
                <ol className="text-[11px] space-y-2 list-decimal list-inside text-slate-700 font-medium">
                  <li>Allez sur <a href="https://api.windy.com/keys" target="_blank" className="underline font-black text-blue-600">votre console Windy</a>.</li>
                  <li>Ajoutez l'<strong>Hôte</strong> et l'<strong>Origine</strong> ci-dessus à votre clé.</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* FIX removeChild : Le loader est un FRÈRE du div#windy pour ne pas perturber React */}
      <div className="relative w-full h-[500px] rounded-[2.5rem] border-4 shadow-2xl overflow-hidden group">
        <div 
          id="windy" 
          className={cn(
              "w-full h-full transition-all duration-1000",
              isInitialized ? "grayscale-0" : "grayscale bg-slate-100"
          )}
        ></div>
        
        {!isInitialized && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50 z-10">
                <RefreshCw className="size-10 animate-spin text-primary/40" />
                <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation de la carte...</p>
            </div>
        )}
      </div>
    </div>
  );
}
