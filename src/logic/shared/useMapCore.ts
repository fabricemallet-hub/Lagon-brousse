
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useGoogleMaps } from '@/context/google-maps-context';
import { getDistance } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot, where, type DocumentData } from 'firebase/firestore';

export type ViewMode = 'alpha' | 'beta' | 'gamma';
export type WindyLayer = 'wind' | 'temp' | 'waves' | 'gust' | 'rain' | 'thunder' | 'uv';

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
 * HOOK PARTAGÉ v59.0 : Gestion de la carte et des calques météo.
 */
export function useMapCore() {
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();
  const firestore = useFirestore();
  const [viewMode, setViewMode] = useState<ViewMode>('alpha');
  const [windyLayer, setWindyLayer] = useState<WindyLayer>('wind');
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  const lastTracePosRef = useRef<{ lat: number, lng: number } | null>(null);

  const [tacticalMarkers, setTacticalMarkers] = useState<TacticalMarker[]>([]);
  const [isTacticalHidden, setIsTacticalHidden] = useState(false);

  useEffect(() => {
    if (googleMap) {
      google.maps.event.trigger(googleMap, 'resize');
      const saved = localStorage.getItem('lb_last_map_center');
      if (saved) {
        try {
          const { lat, lng, zoom } = JSON.parse(saved);
          googleMap.setCenter({ lat, lng });
          if (zoom) googleMap.setZoom(zoom);
        } catch (e) {
          console.warn("Erreur restauration centre map", e);
        }
      }
    }
  }, [googleMap]);

  const saveMapState = useCallback(() => {
    if (googleMap) {
      const center = googleMap.getCenter();
      const zoom = googleMap.getZoom();
      if (center) {
        localStorage.setItem('lb_last_map_center', JSON.stringify({ 
          lat: center.lat(), 
          lng: center.lng(),
          zoom: zoom
        }));
      }
    }
  }, [googleMap]);

  const syncTacticalMarkers = useCallback((vesselIds: string[]) => {
    if (!firestore || vesselIds.length === 0) return () => {};

    const unsubscribers = vesselIds.map(vid => {
        const q = query(
            collection(firestore, 'vessels', vid, 'tactical_logs'),
            orderBy('time', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            setTacticalMarkers(prev => {
                const newMarkers: TacticalMarker[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.pos) {
                        newMarkers.push({
                            id: `${vid}_${doc.id}`,
                            type: data.type,
                            pos: data.pos,
                            time: data.time?.toDate() || new Date(),
                            vesselName: data.vesselName || vid,
                            photoUrl: data.photoUrl,
                            weather: data.weather
                        });
                    }
                });
                const merged = [...prev.filter(m => !m.id.startsWith(vid)), ...newMarkers];
                return merged.slice(0, 100);
            });
        });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore]);

  const updateBreadcrumbs = useCallback((lat: number, lng: number) => {
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
    lastTracePosRef.current = null;
  }, []);

  const handleRecenter = useCallback((pos: { lat: number, lng: number } | null) => {
    if (pos && googleMap) {
      googleMap.panTo(pos);
      googleMap.setZoom(15);
      setIsFollowMode(true);
      saveMapState();
    }
  }, [googleMap, saveMapState]);

  const switchViewMode = useCallback((newMode: ViewMode) => {
    if (googleMap) {
        saveMapState();
        const center = googleMap.getCenter();
        setViewMode(newMode);
        
        setTimeout(() => {
            if (center) {
                googleMap.setCenter(center);
                google.maps.event.trigger(googleMap, 'resize');
            }
        }, 50);
    } else {
        setViewMode(newMode);
    }
  }, [googleMap, saveMapState]);

  return useMemo(() => ({
    isGoogleLoaded,
    viewMode,
    setViewMode: switchViewMode,
    windyLayer,
    setWindyLayer,
    googleMap,
    setGoogleMap,
    isFollowMode,
    setIsFollowMode,
    isFullscreen,
    setIsFullscreen,
    breadcrumbs,
    updateBreadcrumbs,
    clearBreadcrumbs,
    handleRecenter,
    saveMapState,
    tacticalMarkers,
    setTacticalMarkers,
    syncTacticalMarkers,
    isTacticalHidden,
    setIsTacticalHidden
  }), [
    isGoogleLoaded, viewMode, switchViewMode, windyLayer, googleMap, isFollowMode, isFullscreen,
    breadcrumbs, updateBreadcrumbs, clearBreadcrumbs, handleRecenter, saveMapState,
    tacticalMarkers, syncTacticalMarkers, isTacticalHidden
  ]);
}
