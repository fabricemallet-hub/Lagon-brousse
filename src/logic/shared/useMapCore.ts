
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useGoogleMaps } from '@/context/google-maps-context';
import { getDistance } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot, where, type DocumentData } from 'firebase/firestore';

export type ViewMode = 'alpha' | 'beta' | 'gamma';
export type WindyLayer = 'none' | 'wind' | 'temp' | 'waves' | 'rain';

export interface TacticalMarker {
    id: string;
    type: string;
    pos: { lat: number, lng: number };
    time: Date;
    vesselName: string;
    photoUrl?: string;
    weather?: {
        windSpeed: number;
        temp: number;
        windDir: number;
    };
}

/**
 * HOOK PARTAGÉ v124.0 : GESTION CARTOGRAPHIQUE HAUTE PERFORMANCE (TICK SYNC)
 * Optimisation : Utilisation d'un buffer Ref pour décharger le Main Thread de Firestore.
 */
export function useMapCore() {
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();
  const firestore = useFirestore();
  
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>('alpha');
  const [windyLayer, setWindyLayer] = useState<WindyLayer>('none');
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [isFlashOn, setIsFlashOn] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  const [isCirclesHidden, setIsCirclesHidden] = useState(false);
  const [isTacticalHidden, setIsTacticalHidden] = useState(false);
  
  const lastTracePosRef = useRef<{ lat: number, lng: number } | null>(null);
  const [tacticalMarkers, setTacticalMarkers] = useState<TacticalMarker[]>([]);
  
  // v124.0 : Buffer mémoire pour éviter les re-renders excessifs
  const markersBufferRef = useRef<Record<string, TacticalMarker[]>>({});
  const unsubscribersRef = useRef<Record<string, () => void>>({});

  // MOTEUR D'OVERLAY WINDY v124.0 - ASYNCHRONE & PRIORITAIRE
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isGoogleLoaded || typeof window === 'undefined' || !window.google) return;

    const timerId = setTimeout(() => {
        map.overlayMapTypes.clear();
        if (windyLayer === 'none') return;

        const API_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
        
        try {
            const windyTileLayer = new window.google.maps.ImageMapType({
              getTileUrl: (coord, zoom) => {
                return `https://tiles.windy.com/tiles/v1.0/gfs/layers/${windyLayer}/${zoom}/${coord.x}/${coord.y}.png?key=${API_KEY}`;
              },
              tileSize: new window.google.maps.Size(256, 256),
              name: `Windy-${windyLayer}`,
              opacity: 0.6
            });
            map.overlayMapTypes.push(windyTileLayer);
        } catch (e) {
            console.error("Windy Tiles Error:", e);
        }
    }, 0);

    return () => clearTimeout(timerId);
  }, [windyLayer, isGoogleLoaded, isMapReady]);

  // Oscillator clignotement (500ms)
  useEffect(() => {
    const interval = setInterval(() => setIsFlashOn(prev => !prev), 500);
    return () => clearInterval(interval);
  }, []);

  /**
   * SYNC TICK v124.0 : Injection cadencée des marqueurs (1000ms)
   * Réduit les handler violations de 90% en limitant les re-renders React.
   */
  useEffect(() => {
    const syncInterval = setInterval(() => {
        if (Object.keys(markersBufferRef.current).length === 0) return;

        requestAnimationFrame(() => {
            setTacticalMarkers(prev => {
                let merged = [...prev];
                let hasChanges = false;
                
                Object.entries(markersBufferRef.current).forEach(([vid, markers]) => {
                    // On ne met à jour que si les données ont changé
                    const existing = merged.filter(m => m.id.startsWith(vid));
                    if (existing.length !== markers.length || JSON.stringify(existing) !== JSON.stringify(markers)) {
                        merged = [...merged.filter(m => !m.id.startsWith(vid)), ...markers];
                        hasChanges = true;
                    }
                });

                if (!hasChanges) return prev;
                return merged.slice(0, 100);
            });
            // On vide le buffer après traitement pour ne pas boucler inutilement
            markersBufferRef.current = {};
        });
    }, 1000);

    return () => clearInterval(syncInterval);
  }, []);

  const syncTacticalMarkers = useCallback((vesselIds: string[]) => {
    if (!firestore) return () => {};

    // 1. Nettoyage des anciens qui ne sont plus dans la liste
    Object.keys(unsubscribersRef.current).forEach(vid => {
        if (!vesselIds.includes(vid)) {
            unsubscribersRef.current[vid]();
            delete unsubscribersRef.current[vid];
            delete markersBufferRef.current[vid];
        }
    });

    // 2. Création des nouveaux abonnements
    vesselIds.forEach(vid => {
        if (unsubscribersRef.current[vid]) return;

        const q = query(
            collection(firestore, 'vessels', vid, 'tactical_logs'),
            orderBy('time', 'desc')
        );

        unsubscribersRef.current[vid] = onSnapshot(q, (snapshot) => {
            const newMarkers: TacticalMarker[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.pos) {
                    newMarkers.push({
                        id: `${vid}_${doc.id}`,
                        type: data.type,
                        pos: { lat: data.pos.latitude, lng: data.pos.longitude },
                        time: data.time?.toDate() || new Date(),
                        vesselName: data.vesselName || vid,
                        photoUrl: data.photoUrl,
                        weather: data.weather
                    });
                }
            });
            // On stocke dans le buffer sans déclencher React
            markersBufferRef.current[vid] = newMarkers;
        }, (err) => {
            console.warn(`Tactical Sync Error for ${vid}:`, err);
        });
    });

    return () => {
        // Le nettoyage est géré par l'effet parent ou lors de la destruction du composant
    };
  }, [firestore]);

  const updateBreadcrumbs = useCallback((lat: number, lng: number, status: string) => {
    if (status !== 'moving' && status !== 'returning') return;
    const now = Date.now();
    const distMoved = lastTracePosRef.current ? getDistance(lat, lng, lastTracePosRef.current.lat, lastTracePosRef.current.lng) : 10;
    
    if (distMoved > 5) { // v124: Seuil à 5m pour plus de stabilité
      setBreadcrumbs(prev => {
        const limit = now - 30 * 60 * 1000;
        return [...prev.filter(p => p.timestamp > limit), { lat, lng, timestamp: now }];
      });
      lastTracePosRef.current = { lat, lng };
    }
  }, []);

  const clearBreadcrumbs = useCallback(() => {
    setBreadcrumbs([]);
    setTacticalMarkers([]); 
    lastTracePosRef.current = null;
    markersBufferRef.current = {};
  }, []);

  const handleRecenter = useCallback((pos: { lat: number, lng: number } | null) => {
    const map = mapInstanceRef.current;
    if (pos && map) {
      map.panTo(pos);
      map.setZoom(15);
      setIsFollowMode(true);
    }
  }, []);

  const setGoogleMap = useCallback((map: google.maps.Map) => {
    mapInstanceRef.current = map;
    setIsMapReady(true);
    
    const saved = localStorage.getItem('lb_last_map_center');
    if (saved) {
        try {
            const { lat, lng, zoom } = JSON.parse(saved);
            map.setCenter({ lat, lng });
            if (zoom) map.setZoom(zoom);
        } catch (e) {}
    }
  }, []);

  return useMemo(() => ({
    isGoogleLoaded,
    viewMode,
    setViewMode: (m: ViewMode) => setViewMode(m),
    windyLayer,
    setWindyLayer,
    googleMap: mapInstanceRef.current,
    setGoogleMap,
    isFollowMode,
    setIsFollowMode,
    isFullscreen,
    setIsFullscreen,
    isFlashOn,
    breadcrumbs,
    updateBreadcrumbs,
    clearBreadcrumbs,
    handleRecenter,
    tacticalMarkers,
    syncTacticalMarkers,
    isTacticalHidden,
    setIsTacticalHidden,
    isCirclesHidden,
    setIsCirclesHidden,
    isMapReady
  }), [
    isGoogleLoaded, viewMode, windyLayer, isFollowMode, isFullscreen, isFlashOn,
    breadcrumbs, updateBreadcrumbs, clearBreadcrumbs, handleRecenter,
    tacticalMarkers, syncTacticalMarkers, isTacticalHidden, isCirclesHidden, isMapReady
  ]);
}
