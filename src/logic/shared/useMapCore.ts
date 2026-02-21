'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useGoogleMaps } from '@/context/google-maps-context';
import { getDistance } from '@/lib/utils';

export type ViewMode = 'alpha' | 'beta' | 'gamma';

/**
 * HOOK PARTAGÉ : Gestion de la carte, des traces et du verrouillage.
 * Version 47.0 : Persistance du centre et synchronisation des modes.
 */
export function useMapCore() {
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();
  const [viewMode, setViewMode] = useState<ViewMode>('alpha');
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // State pour le rendu React des traces
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  
  // Références pour les objets de carte
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const lastTracePosRef = useRef<{ lat: number, lng: number } | null>(null);

  // RESTAURATION DU CENTRE AU CHARGEMENT
  useEffect(() => {
    if (googleMap && typeof window !== 'undefined') {
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
      // Force le rendu des tuiles (équivalent invalidateSize)
      google.maps.event.trigger(googleMap, 'resize');
    }
  }, [googleMap]);

  // SAUVEGARDE DU CENTRE LORS DES DÉPLACEMENTS
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

  // MISE À JOUR DE LA TRACE (30 min / 2m)
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

  // SYNCHRONISATION DES MODES (Sync du centre lors du passage Maps -> Météo)
  const switchViewMode = useCallback((newMode: ViewMode) => {
    if (googleMap) {
        saveMapState(); // On sauve avant de switcher
        const center = googleMap.getCenter();
        setViewMode(newMode);
        
        // On redonne le centre à la carte après un court délai pour laisser React respirer
        setTimeout(() => {
            if (center) googleMap.setCenter(center);
            google.maps.event.trigger(googleMap, 'resize');
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
