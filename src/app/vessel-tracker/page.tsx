'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import Script from 'next/script';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  Expand, 
  Shrink, 
  Zap, 
  RefreshCw,
  X,
  Wind,
  Waves,
  Info,
  Thermometer,
  Gauge,
  Activity,
  ArrowUp,
  Clock,
  Layers,
  Ship,
  Phone,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { cn, getDistance, translateWindDirection } from '@/lib/utils';
import type { VesselStatus, UserAccount, WindDirection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchWindyWeather } from '@/lib/windy-api';
import { getDataForDate } from '@/lib/data';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

// --- COMPOSANT : PANNEAU DE DONNÉES MÉTÉO TACTIQUES ---
const MeteoDataPanel = ({ data, onClose, isLoading }: { data: any, onClose: () => void, isLoading: boolean }) => {
    if (!data) return null;
    return (
        <div className="absolute z-[110] bg-slate-900/90 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border-2 border-white/20 min-w-[260px] animate-in zoom-in-95" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -110%)' }}>
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Activity className="size-3" /> Analyse Marine & Marées
                </span>
                {isLoading && <RefreshCw className="size-3 animate-spin" />}
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Wind className="size-2" /> Vent / Rafale</span>
                    <span className="text-sm font-black text-blue-400">
                        {data.windSpeed ?? '--'} <span className="text-[8px] opacity-60">ND</span>
                        {data.gustSpeed > 0 && <span className="text-orange-400 ml-1">({data.gustSpeed})</span>}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Waves className="size-2" /> Houle</span>
                    <span className="text-sm font-black text-cyan-400">{data.waves ?? '--'}<span className="text-[8px] ml-0.5">m</span></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Thermometer className="size-2" /> Air / Eau</span>
                    <span className="text-sm font-black">
                        {data.temp ?? '--'}° <span className="text-blue-300">/ {data.sst ?? '--'}°</span>
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-50 flex items-center gap-1"><Gauge className="size-2" /> Pression / Hum</span>
                    <span className="text-sm font-black">{data.pressure ?? '--'} <span className="text-[8px] opacity-60">hPa</span></span>
                </div>
            </div>

            {data.tideData && (
                <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                    <p className="text-[8px] font-black uppercase text-primary text-center">Marées : {data.tideData.station}</p>
                    <div className="flex justify-around gap-1">
                        {data.tideData.tides.slice(0, 2).map((t: any, i: number) => (
                            <div key={i} className="bg-white/5 p-1 rounded text-center flex-1">
                                <span className="text-[7px] font-bold block opacity-60 uppercase">{t.type === 'haute' ? 'Pleine' : 'Basse'}</span>
                                <span className="text-[9px] font-black block">{t.time} ({t.height}m)</span>
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

  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [isWindyLoaded, setIsWindyLoaded] = useState(false);
  
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
  const isMapInitializedRef = useRef<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // Bust cache pour forcer la ré-autorisation
  const scriptBust = useMemo(() => Date.now(), []);
  const sharingId = useMemo(() => (user?.uid || '').toUpperCase(), [user]);

  const labels = useMemo(() => ({
    status1: "Au Mouillage",
    status2: "En Route"
  }), []);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userProfileRef);

  const savedVesselIds = profile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const ids = [...savedVesselIds];
    if (isSharing && !ids.includes(sharingId)) ids.push(sharingId);
    return query(collection(firestore, 'vessels'), where('isSharing', '==', true), where('id', 'in', ids.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const getTideInfoForPoint = (lat: number, lng: number) => {
    const { allCommuneNames, locations } = require('@/lib/locations');
    const sortedCommunes = [...allCommuneNames].sort((a: string, b: string) => {
        const coordsA = locations[a];
        const coordsB = locations[b];
        return getDistance(lat, lng, coordsA.lat, coordsA.lon) - getDistance(lat, lng, coordsB.lat, coordsB.lon);
    });
    const commune = sortedCommunes[0];

    if (!commune) return null;
    const data = getDataForDate(commune, new Date());
    return { commune, station: data.tideStation, tides: data.tides };
  };

  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || !window.L || !window.windyInit || isMapInitializedRef.current) return;

    console.log("Current Origin:", window.location.origin);

    const options = {
      key: '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4', // Clé injectée proprement
      lat: INITIAL_CENTER.lat,
      lon: INITIAL_CENTER.lng,
      zoom: 10,
      verbose: true,
      overlays: ['wind', 'pressure', 'waves', 'sst', 'rh', 'gust', 'temp', 'swell', 'currents'],
      product: 'gfs'
    };

    try {
        window.windyInit(options, (windyAPI: any) => {
          if (!windyAPI) return;

          const { map, store, picker, broadcast } = windyAPI;
          mapRef.current = map;
          isMapInitializedRef.current = true;

          // Activation des couches par défaut via windyStore
          store.set('overlay', 'wind');

          // Correction affichage (Resize)
          setTimeout(() => {
            document.querySelectorAll('.windy-error-msg, .error-boundary').forEach(el => el.remove());
            map.invalidateSize();
            window.dispatchEvent(new Event('resize'));
          }, 500);

          // Listener Picker (Moved)
          broadcast.on('pickerMoved', async (latLon: any) => {
            const { lat, lon } = latLon;
            const tideData = getTideInfoForPoint(lat, lon);
            
            setMapClickResult({ lat, lon, tideData });
            setIsQueryingWindy(true);

            try {
              const weather = await fetchWindyWeather(lat, lon);
              setMapClickResult((prev: any) => ({ ...prev, ...weather }));
            } catch (err) {
              console.error("Point Forecast failed:", err);
            } finally {
              setIsQueryingWindy(false);
            }
          });

          // Ouverture sélecteur au clic
          map.on('click', (e: any) => {
            picker.open({ lat: e.latlng.lat, lon: e.latlng.lng });
          });
        });
    } catch (e) {
        console.error("Windy Init Crash:", e);
    }
  }, []);

  useEffect(() => {
    if (isLeafletLoaded && isWindyLoaded) initWindy();
  }, [isLeafletLoaded, isWindyLoaded, initWindy]);

  useEffect(() => {
    if (!mapRef.current || !followedVessels || !window.L) return;
    const L = window.L;

    followedVessels.forEach(v => {
      if (!v.location || !v.isSharing) {
        if (markersRef.current[v.id]) { markersRef.current[v.id].remove(); delete markersRef.current[v.id]; }
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
                </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });
        markersRef.current[v.id] = L.marker(pos, { icon }).addTo(mapRef.current);
      } else {
        markersRef.current[v.id].setLatLng(pos);
      }
    });
  }, [followedVessels]);

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
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(handleGpsUpdate, null, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    return () => { if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; } };
  }, [isSharing, mode, handleGpsUpdate]);

  const handleRecenter = () => {
    if (currentPos && mapRef.current) {
        mapRef.current.panTo([currentPos.lat, currentPos.lng]);
        mapRef.current.setZoom(15);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Script src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js" strategy="afterInteractive" onLoad={() => setIsLeafletLoaded(true)} />
      <Script src={`https://api.windy.com/assets/map-forecast/libBoot.js?v=${scriptBust}`} strategy="afterInteractive" crossOrigin="anonymous" onLoad={() => setIsWindyLoaded(true)} />

      <meta name="referrer" content="no-referrer-when-downgrade" />

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
              <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partage GPS</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">{isSharing ? 'En cours' : 'Inactif'}</p></div>
              <Switch checked={isSharing} onCheckedChange={setIsSharing} />
          </div>
          {isSharing && mode === 'sender' && (
              <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2 gap-2" onClick={async () => {
                if (wakeLock) { await wakeLock.release(); setWakeLock(null); }
                else { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); }
              }}>
                  <Zap className={cn("size-4", wakeLock && "fill-primary")} />
                  {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
              </Button>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all relative bg-slate-100", isFullscreen ? "fixed inset-0 z-[150] w-screen h-screen rounded-none" : "min-h-[500px]")}>
        <div id="windy" className="absolute inset-0 w-full h-full z-10" style={{ minHeight: isFullscreen ? '100vh' : '500px', position: 'relative' }}>
          <MeteoDataPanel data={mapClickResult} onClose={() => setMapClickResult(null)} isLoading={isQueryingWindy} />
          
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5" /></Button>
          </div>
        </div>
      </Card>

      <div className="p-4 bg-primary/5 border-2 border-dashed rounded-xl flex gap-3 opacity-60">
          <Info className="size-5 text-primary shrink-0" />
          <p className="text-[10px] font-medium leading-relaxed">
            <strong>Météo Marine Full Stack :</strong> Cette version utilise Leaflet 1.4.0 et les couches natives Windy (SST, Houle, Pression). Cliquez n'importe où pour obtenir une analyse marine complète et les marées locales.
          </p>
      </div>
    </div>
  );
}
