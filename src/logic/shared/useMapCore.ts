
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
 * HOOK PARTAGÉ v123.0 : GESTION CARTOGRAPHIQUE HAUTE PERFORMANCE
 * Optimisation : Découplage de l'instance Map et Throttling des snapshots.
 */
export function useMapCore() {
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();
  const firestore = useFirestore();
  
  // Instance Map isolée pour éviter les re-renders inutiles
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>('alpha');
  const [windyLayer, setWindyLayer] = useState<WindyLayer>('none');
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Oscillateur pour le clignotement des alertes
  const [isFlashOn, setIsFlashOn] = useState(true);
  
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  const [isCirclesHidden, setIsCirclesHidden] = useState(false);
  const [isTacticalHidden, setIsTacticalHidden] = useState(false);
  
  const lastTracePosRef = useRef<{ lat: number, lng: number } | null>(null);
  const [tacticalMarkers, setTacticalMarkers] = useState<TacticalMarker[]>([]);
  
  // Buffer et Throttling pour les marqueurs
  const markersBufferRef = useRef<Record<string, TacticalMarker[]>>({});
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // MOTEUR D'OVERLAY WINDY v123.0 - ASYNCHRONE
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isGoogleLoaded || typeof window === 'undefined' || !window.google) return;

    // Utilisation de setTimeout pour décharger le thread principal immédiatement
    const timerId = setTimeout(() => {
        // Purge explicite avant changement pour éviter les fuites de mémoire
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

  // Oscillator clignotement
  useEffect(() => {
    const interval = setInterval(() => setIsFlashOn(prev => !prev), 500);
    return () => clearInterval(interval);
  }, []);

  const saveMapState = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (center) {
        localStorage.setItem('lb_last_map_center', JSON.stringify({ 
          lat: center.lat(), 
          lng: center.lng(),
          zoom: zoom
        }));
      }
    }
  }, []);

  /**
   * Synchronisation des marqueurs tactiques avec THROTTLING v123
   * Regroupe les messages Firestore pour libérer le CPU.
   */
  const syncTacticalMarkers = useCallback((vesselIds: string[]) => {
    if (!firestore || vesselIds.length === 0) return () => {};

    const unsubscribers = vesselIds.map(vid => {
        const q = query(
            collection(firestore, 'vessels', vid, 'tactical_logs'),
            orderBy('time', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
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

            // Accumulation dans le buffer
            markersBufferRef.current[vid] = newMarkers;

            // Déclenchement du throttling (100ms)
            if (!throttleTimerRef.current) {
                throttleTimerRef.current = setTimeout(() => {
                    requestAnimationFrame(() => {
                        setTacticalMarkers(prev => {
                            let merged = [...prev];
                            Object.entries(markersBufferRef.current).forEach(([id, markers]) => {
                                merged = [...merged.filter(m => !m.id.startsWith(id)), ...markers];
                            });
                            return merged.slice(0, 100);
                        });
                        throttleTimerRef.current = null;
                    });
                }, 100);
            }
        });
    });

    return () => {
        unsubscribers.forEach(unsub => unsub());
        if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, [firestore]);

  const updateBreadcrumbs = useCallback((lat: number, lng: number, status: string) => {
    if (status !== 'moving' && status !== 'returning') return;
    const now = Date.now();
    const distMoved = lastTracePosRef.current ? getDistance(lat, lng, lastTracePosRef.current.lat, lastTracePosRef.current.lng) : 10;
    
    if (distMoved > 2) {
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
  }, []);

  const handleRecenter = useCallback((pos: { lat: number, lng: number } | null) => {
    const map = mapInstanceRef.current;
    if (pos && map) {
      map.panTo(pos);
      map.setZoom(15);
      setIsFollowMode(true);
      saveMapState();
    }
  }, [saveMapState]);

  const setGoogleMap = useCallback((map: google.maps.Map) => {
    mapInstanceRef.current = map;
    setIsMapReady(true);
    
    // Restauration état
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
    setViewMode: (m: ViewMode) => { setViewMode(m); saveMapState(); },
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
    saveMapState,
    tacticalMarkers,
    syncTacticalMarkers,
    isTacticalHidden,
    setIsTacticalHidden,
    isCirclesHidden,
    setIsCirclesHidden,
    isMapReady
  }), [
    isGoogleLoaded, viewMode, windyLayer, isFollowMode, isFullscreen, isFlashOn,
    breadcrumbs, updateBreadcrumbs, clearBreadcrumbs, handleRecenter, saveMapState,
    tacticalMarkers, syncTacticalMarkers, isTacticalHidden, isCirclesHidden, setGoogleMap, isMapReady
  ]);
}
