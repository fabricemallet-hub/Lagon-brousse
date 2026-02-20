'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, where, deleteDoc } from 'firebase/firestore';
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
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  MapPin,
  X,
  Play,
  Volume2,
  RefreshCw,
  Wind,
  Waves,
  Thermometer,
  Compass,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchWindyWeather } from '@/lib/windy-api';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level !== undefined && level <= 20) return <BatteryLow {...props} className="text-red-600" />;
  if (level !== undefined && level <= 60) return <BatteryMedium {...props} className="text-orange-500" />;
  return <BatteryFull {...props} className="text-green-600" />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [isSharing, setIsSharing] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customSharingId, setCustomSharingId] = useState('');

  // States Cartographiques
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapClickResult, setMapClickResult] = useState<{ lat: number, lon: number, wind?: number, temp?: number, waves?: number } | null>(null);
  const [isQueryingWindy, setIsQueryingWindy] = useState(false);
  
  // Windy Refs
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const lastUpdateTimestampRef = useRef<number>(0);
  const lastMapClickTimeRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userProfileRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  // INITIALISATION WINDY MAP (Conformité v5.2)
  const initWindy = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).windyInit || mapRef.current) return;

    const options = {
      key: '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4',
      lat: INITIAL_CENTER.lat,
      lon: INITIAL_CENTER.lng,
      zoom: 10,
    };

    (window as any).windyInit(options, (windyAPI: any) => {
      const { map, picker } = windyAPI;
      mapRef.current = map;

      // Click Listener Tactique
      map.on('click', async (e: any) => {
        const now = Date.now();
        if (now - lastMapClickTimeRef.current < 2000) return; // Debounce 2s
        lastMapClickTimeRef.current = now;

        const { lat, lng } = e.latlng;
        setMapClickResult({ lat, lon: lng });
        setIsQueryingWindy(true);
        picker.open({ lat, lon: lng });

        try {
          const weather = await fetchWindyWeather(lat, lng);
          if (weather.success) {
            setMapClickResult({ 
                lat, 
                lon: lng, 
                wind: weather.windSpeed, 
                temp: weather.temperature, 
                waves: weather.waves 
            });
          }
        } finally {
          setIsQueryingWindy(false);
        }
      });
    });
  }, []);

  // Synchronisation des marqueurs sur la carte Windy (Leaflet)
  useEffect(() => {
    if (!mapRef.current || !followedVessels || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    followedVessels.forEach(v => {
      if (!v.location || !v.isSharing) {
        if (markersRef.current[v.id]) { markersRef.current[v.id].remove(); delete markersRef.current[v.id]; }
        return;
      }

      const pos = [v.location.latitude, v.location.longitude];
      const statusColor = v.status === 'stationary' ? '#f97316' : '#2563eb';

      if (!markersRef.current[v.id]) {
        // RENDU VISEUR v5.2 : Opacité 85% et point bleu central
        const icon = L.divIcon({
          className: 'custom-vessel-icon',
          html: `<div class="relative flex items-center justify-center" style="transform: translate(-50%, -50%)">
                  <div class="size-16 rounded-full border-4 border-white shadow-2xl flex items-center justify-center transition-all duration-500" 
                       style="background-color: ${statusColor}; opacity: 0.85">
                    <svg class="size-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        ${v.status === 'stationary' ? '<path d="M12 2v18M5 12h14M12 20c-3.3 0-6-2.7-6-6M12 20c3.3 0 6-2.7 6-6"></path>' : '<path d="M3 11l19-9-9 19-2-8-8-2z"></path>'}
                    </svg>
                  </div>
                  <div class="absolute size-5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] z-[100] animate-pulse"></div>
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

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || !sharingId) return;
    
    // PERFORMANCE : Throttling à 5 secondes
    const now = Date.now();
    if (now - lastUpdateTimestampRef.current < 5000) return;
    lastUpdateTimestampRef.current = now;

    let batteryInfo = {};
    if ('getBattery' in navigator) {
        const b: any = await (navigator as any).getBattery();
        batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
    }

    await setDoc(doc(firestore, 'vessels', sharingId), { 
        id: sharingId,
        userId: user.uid, 
        displayName: vesselNickname || user.displayName || 'Capitaine', 
        isSharing: isSharing, 
        lastActive: serverTimestamp(),
        ...batteryInfo,
        ...data 
    }, { merge: true });
  }, [user, firestore, sharingId, vesselNickname, isSharing]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCurrentPos(newPos);
        updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving' });
      },
      null,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, updateVesselInFirestore]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Script src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js" strategy="beforeInteractive" />
      <Script src="https://api.windy.com/assets/lib/libBoot.js" onLoad={initWindy} />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.4.0/dist/leaflet.css" />

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
              <div className="space-y-0.5">
                  <Label className="text-sm font-black uppercase">{mode === 'sender' ? 'Partage GPS' : 'Suivi Flotte'}</Label>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">{isSharing ? 'En cours de diffusion' : 'Service inactif'}</p>
              </div>
              <Switch checked={isSharing} onCheckedChange={setIsSharing} />
          </div>
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[150] w-screen h-screen rounded-none")}>
        <div 
            id="windy" 
            className={cn("relative w-full bg-muted/20 z-10", isFullscreen ? "flex-grow" : "min-h-[500px] h-[500px]")}
        >
          {/* OVERLAY MÉTÉO TACTIQUE (v5.2) */}
          {mapClickResult && (
            <div 
              className="absolute z-[110] bg-slate-900/85 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border-2 border-white/20 min-w-[140px] animate-in zoom-in-95 pointer-events-none"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -130%)' }}
            >
              <div className="flex items-center justify-between gap-4 mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">WINDY LIVE</span>
                {isQueryingWindy && <RefreshCw className="size-3 animate-spin text-primary" />}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3"><Wind className="size-5 text-blue-400" /><div className="flex flex-col"><span className="text-xl font-black">{mapClickResult.wind ?? '--'}</span><span className="text-[8px] uppercase opacity-60">Noeuds</span></div></div>
                <div className="flex items-center gap-3"><Waves className="size-5 text-cyan-400" /><div className="flex flex-col"><span className="text-sm font-black">{mapClickResult.waves ?? '--'}m</span><span className="text-[8px] uppercase opacity-60">Houle</span></div></div>
                <div className="flex items-center gap-3"><Thermometer className="size-5 text-orange-400" /><div className="flex flex-col"><span className="text-sm font-black">{mapClickResult.temp ?? '--'}°C</span><span className="text-[8px] uppercase opacity-60">Air</span></div></div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 border-r-2 border-b-2 border-white/20"></div>
            </div>
          )}

          <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
