'use client';

import { useState, useRef, useCallback } from 'react';
import { useGoogleMaps } from '@/context/google-maps-context';
import { getDistance } from '@/lib/utils';

export type ViewMode = 'alpha' | 'beta' | 'gamma';

/**
 * HOOK PARTAGÉ : Gestion de la carte, des traces et du verrouillage.
 */
export function useMapCore() {
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();
  const [viewMode, setViewMode] = useState<ViewMode>('alpha');
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // State pour le rendu React
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  
  // Référence persistante pour l'instance Google Maps de la trace
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const lastTracePosRef = useRef<{ lat: number, lng: number } | null>(null);

  // Mise à jour de la trace (Mémoire 30 min, filtre 2m)
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
    if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
    }
  }, []);

  const handleRecenter = (pos: { lat: number, lng: number } | null) => {
    if (pos && googleMap) {
      googleMap.panTo(pos);
      googleMap.setZoom(15);
      setIsFollowMode(true);
    }
  };

  return {
    isGoogleLoaded,
    viewMode,
    setViewMode,
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
    polylineRef
  };
}
