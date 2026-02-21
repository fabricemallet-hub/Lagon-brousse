'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useGoogleMaps } from '@/context/google-maps-context';
import { getDistance } from '@/lib/utils';

export type ViewMode = 'alpha' | 'beta' | 'gamma';

/**
 * HOOK PARTAGÉ : Gestion de la carte, des traces et du verrouillage.
 * Version 47.1 : Automatisation du rendu et du centrage initial.
 */
export function useMapCore() {
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();
  const [viewMode, setViewMode] = useState<ViewMode>('alpha');
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [isFollowMode, setIsFollowMode] = useState(true); // Verrouillage actif par défaut
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const lastTracePosRef = useRef<{ lat: number, lng: number } | null>(null);

  // FORCE LE RENDU ET RESTAURE LE CENTRE
  useEffect(() => {
    if (googleMap) {
      // 1. Déclenche le resize pour éviter la carte grise
      google.maps.event.trigger(googleMap, 'resize');

      // 2. Restaure la dernière position connue si disponible
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

  return {
    isGoogleLoaded,
    viewMode,
    setViewMode: switchViewMode,
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
    polylineRef
  };
}
