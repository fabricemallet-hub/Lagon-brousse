
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import Script from 'next/script';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  RefreshCw,
  X,
  BatteryCharging,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  Wind,
  Waves,
  Thermometer,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- 1. ÉTATS DE CHARGEMENT DES SCRIPTS ---
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);

  // --- 2. CONSTANTES TACTIQUES ---
  const labels = useMemo(() => ({
    status1: "Au Mouillage",
    status2: "En Route",
    title: "Boat Tracker",
    alertBtn: "SIGNALER POISSON",
    alertTitle: "POISSON SIGNALÉ !",
    alertDesc: "Poisson repéré !"
  }), []);

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapClickResult, setMapClickResult] = useState<any>(null);
  const [isQueryingWindy, setIsQueryingWindy] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const lastUpdateTimestampRef = useRef<number>(0);
  const lastMapClickTimeRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const isMapInitializedRef = useRef<boolean>(false);

  const sharingId = useMemo(() => (user?.uid || '').toUpperCase(), [user]);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const ids = [...savedVesselIds];
    if (isSharing && !ids.includes(sharingId)) ids.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  // --- 3. INITIALISATION WINDY MAP ---
  const initWindy = useCallback(() => {
    // SÉCURITÉ : Vérifier que Leaflet et Windy sont prêts
    if (typeof window === 'undefined' || !window.L || !window.windyInit || isMapInitializedRef.current) {
        return;
    }

    console.log("[Windy Init] Tentative d'authentification pour :", window.location.origin);

    const options = {
      key: '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4',
      lat: INITIAL_CENTER.lat,
      lon: INITIAL_CENTER.lng,
      zoom: 10,
    };

    try {
        window.windyInit(options, (windyAPI: any) => {
          if (!windyAPI) {
              console.error("%c[Windy Auth Error] Échec d'autorisation.", "color: red; font-weight: bold;");
              console.error("%c[Windy Auth] AJOUTEZ CE DOMAINE À VOTRE CLÉ :", "color: orange; font-weight: bold;", window.location.origin);
              return;
          }

          const { map, picker } = windyAPI;
          mapRef.current = map;
          isMapInitializedRef.current = true;

          // Forced Reflow Optimization : Redessin différé
          setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
          }, 500);

          map.on('click', async (e: any) => {
            const now = Date.now();
            if (now - lastMapClickTimeRef.current < 2000) return; 
            lastMapClickTimeRef.current = now;

            const { lat, lng } = e.latlng;
            setMapClickResult({ lat, lon: lng });
            setIsQueryingWindy(true);
            picker.open({ lat, lon: lng });

            try {
              const weather = await fetchWindyWeather(lat, lng);
              setMapClickResult((prev: any) => ({ 
                  ...prev, 
                  wind: weather.windSpeed, 
                  temp: weather.temperature, 
                  waves: weather.waves,
                  success: weather.success
              }));
            } catch (err) {
              console.error("[Windy Click Forecast] Erreur :", err);
            } finally {
              setIsQueryingWindy(false);
            }
          });
        });
    } catch (e) {
        console.error("[Windy Critical Error] Échec chargement API");
    }
  }, []);

  useEffect(() => {
    if (isLeafletLoaded && isWindyLoaded) {
        initWindy();
    }
  }, [isLeafletLoaded, isWindyLoaded, initWindy]);

  // Synchronisation des marqueurs
  useEffect(() => {
    if (!mapRef.current || !followedVessels || typeof window === 'undefined' || !window.L) return;
    const L = window.L;

    followedVessels.forEach(v => {
      if (!v.location || !v.isSharing) {
        if (markersRef.current[v.id]) { 
            markersRef.current[v.id].remove(); 
            delete markersRef.current[v.id]; 
        }
        return;
      }

      const pos = [v.location.latitude, v.location.longitude];
      const statusColor = v.status === 'stationary' ? '#f97316' : '#2563eb';

      if (!markersRef.current[v.id]) {
        const icon = L.divIcon({
          className: 'vessel-marker',
          html: `<div class="relative flex flex-col items-center" style="transform: translate(-50%, -100%)">
                  <div class="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap mb-1">
                    ${v.displayName || v.id}
                  </div>
                  <div class="relative size-12 flex items-center justify-center">
                    <div class="absolute inset-0 rounded-full border-2 border-white shadow-xl flex items-center justify-center" 
                         style="background-color: ${statusColor}; opacity: 0.85">
                      <svg class="size-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          ${v.status === 'stationary' ? '<path d="M12 2v18M5 12h14M12 20c-3.3 0-6-2.7-6-6M12 20c3.3 0 6-2.7 6-6"></path>' : '<path d="M3 11l19-9-9 19-2-8-8-2z"></path>'}
                      </svg>
                    </div>
                    <div class="absolute size-3 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(59,130,246,1)] z-[100] animate-pulse"></div>
                  </div>
                  <div class="mt-1 flex flex-col items-center gap-1">
                    <div class="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full border shadow-sm">
                        <span class="text-[9px] font-black text-slate-700">${v.batteryLevel ?? '--'}%</span>
                    </div>
                  </div>
                </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });
        markersRef.current[v.id] = L.marker(pos, { icon }).addTo(mapRef.current);
      } else {
        markersRef.current[v.id].setLatLng(pos);
      }
    });
  }, [followedVessels, labels]);

  // --- 4. MOTEUR GPS AVEC THROTTLING 5S ---
  const handleGpsUpdate = useCallback(async (pos: GeolocationPosition) => {
    const now = Date.now();
    if (now - lastUpdateTimestampRef.current < 5000) return;
    lastUpdateTimestampRef.current = now;

    const { latitude, longitude } = pos.coords;
    setCurrentPos({ lat: latitude, lng: longitude });

    if (user && firestore && isSharing) {
        let batteryInfo = {};
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        setDoc(doc(firestore, 'vessels', sharingId), { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || profile?.displayName || 'Capitaine', 
            location: { latitude, longitude },
            isSharing: true, 
            lastActive: serverTimestamp(),
            ...batteryInfo
        }, { merge: true }).catch(() => {});
    }
  }, [user, firestore, isSharing, sharingId, vesselNickname, profile?.displayName]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        return;
    }
    
    watchIdRef.current = navigator.geolocation.watchPosition(handleGpsUpdate, null, { 
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 0 
    });

    return () => { 
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current); 
            watchIdRef.current = null;
        }
    };
  }, [isSharing, mode, handleGpsUpdate]);

  const handleRecenter = () => {
    const pos = currentPos;
    if (pos && mapRef.current) {
        mapRef.current.panTo([pos.lat, pos.lng]);
        mapRef.current.setZoom(15);
    } else {
        toast({ description: "En attente du signal GPS..." });
    }
  };

  const handleToggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) {
        try { await wakeLock.release(); setWakeLock(null); } catch (e) {}
    } else {
        try {
            const lock = await (navigator as any).wakeLock.request('screen');
            setWakeLock(lock);
            toast({ title: "Éveil actif", description: "L'écran ne se coupera plus." });
        } catch (err) {}
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Script 
        src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js" 
        id="leaflet-src"
        strategy="afterInteractive" 
        crossOrigin="anonymous" 
        onLoad={() => {
            console.log("[Script] Leaflet chargé.");
            setIsLeafletLoaded(true);
        }}
      />
      <Script 
        src="https://api.windy.com/assets/map-forecast/libBoot.js" 
        strategy="lazyOnload" 
        crossOrigin="anonymous" 
        onLoad={() => {
            console.log("[Script] Windy chargé.");
            setIsWindyLoaded(true);
        }}
      />

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
              <div className="space-y-0.5">
                  <Label className="text-sm font-black uppercase">Partage GPS</Label>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">{isSharing ? 'En cours' : 'Inactif'}</p>
              </div>
              <Switch checked={isSharing} onCheckedChange={setIsSharing} />
          </div>
          {isSharing && (
              <div className="grid grid-cols-2 gap-2 animate-in zoom-in-95">
                  <Button variant={wakeLock ? "secondary" : "outline"} className="h-12 font-black uppercase text-[9px] border-2 gap-2" onClick={handleToggleWakeLock}>
                      <Zap className={cn("size-4", wakeLock && "fill-primary")} /> {wakeLock ? "ÉVEIL ACTIF" : "MAINTENIR ÉCRAN"}
                  </Button>
                  <Button variant="outline" className="h-12 font-black uppercase text-[9px] border-2 gap-2" onClick={handleRecenter}>
                      <LocateFixed className="size-4" /> RECENTRER
                  </Button>
              </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all relative bg-slate-50", isFullscreen ? "fixed inset-0 z-[150] w-screen h-screen rounded-none" : "min-h-[500px]")}>
        <div 
            id="windy" 
            className="absolute inset-0 w-full h-full z-10"
            style={{ minHeight: isFullscreen ? '100vh' : '500px' }}
        >
          {mapClickResult && (
            <div 
              className="absolute z-[110] bg-slate-900/85 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border-2 border-white/20 min-w-[140px] animate-in zoom-in-95 pointer-events-none"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -130%)' }}
            >
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest">DIAGNOSTIC WINDY</span>
                {isQueryingWindy && <RefreshCw className="size-3 animate-spin text-primary" />}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <Wind className="size-5 text-blue-400" />
                    <div className="flex flex-col"><span className="text-xl font-black">{mapClickResult.wind ?? '--'}</span><span className="text-[8px] uppercase opacity-60">Noeuds</span></div>
                </div>
                <div className="flex items-center gap-3">
                    <Waves className="size-5 text-cyan-400" />
                    <div className="flex flex-col"><span className="text-sm font-black">{mapClickResult.waves ?? '--'}m</span><span className="text-[8px] uppercase opacity-60">Houle</span></div>
                </div>
                <div className="flex items-center gap-3">
                    <Thermometer className="size-5 text-orange-400" />
                    <div className="flex flex-col"><span className="text-sm font-black">{mapClickResult.temp ?? '--'}°C</span><span className="text-[8px] uppercase opacity-60">Air</span></div>
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 border-r-2 border-b-2 border-white/20"></div>
            </div>
          )}

          <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
            <Button 
                size="icon" 
                className="shadow-lg h-10 w-10 bg-background/90 border-2" 
                onClick={() => {
                    setIsFullscreen(!isFullscreen);
                    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
                }}
            >
                {isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
          </div>
        </div>
      </Card>

      <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-4 flex gap-3 shadow-sm">
          <Info className="size-5 text-primary shrink-0" />
          <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-primary leading-none">Conseil Tactique</h4>
              <p className="text-[10px] leading-relaxed font-medium text-slate-600">
                  Cliquez n'importe où sur la carte pour interroger les stations météo Windy en temps réel.
              </p>
          </div>
      </div>
    </div>
  );
}
