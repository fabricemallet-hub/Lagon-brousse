'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getDistance } from '@/lib/utils';
import type { RadarDanger } from '@/lib/types';

/**
 * HOOK RADAR IA v92.0 : SENTINEL V2 (Filtre de Confiance)
 * Scanne l'environnement satellite pour détecter les récifs et la terre.
 * Ajout v92.0 : Analyse de persistance (3 scans) et fonction "Ignore".
 */
export function useRadarIA(currentPos: { lat: number, lng: number } | null, speedKnots: number = 0) {
  const [dangers, setDangers] = useState<RadarDanger[]>([]);
  const [closestDanger, setClosestDanger] = useState<RadarDanger | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const lastScanPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // HISTORIQUE DE PERSISTANCE : DangerKey -> Nombre de détections consécutives
  const detectionHistoryRef = useRef<Record<string, number>>({});
  // LISTE DES DANGERS IGNORÉS PAR L'UTILISATEUR
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  /**
   * Marque un danger spécifique comme ignoré pour la session.
   */
  const ignoreDanger = useCallback((id: string) => {
    setIgnoredIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
    });
  }, []);

  /**
   * PerformScan v92.0 : Intègre la persistance et la double validation.
   */
  const performScan = useCallback(async () => {
    if (!currentPos || typeof google === 'undefined') return;
    
    setIsScanning(true);
    const elevator = new google.maps.ElevationService();
    const radarRadius = 200; // 200m
    const step = 45; // 8 directions
    
    const pointsToScan: google.maps.LatLng[] = [];
    const currentBatchKeys: string[] = [];

    // Création d'une grille de points
    for (let angle = 0; angle < 360; angle += step) {
        for (let dist = 50; dist <= radarRadius; dist += 50) {
            const rad = (angle * Math.PI) / 180;
            const latOffset = (dist / 111320) * Math.cos(rad);
            const lngOffset = (dist / (111320 * Math.cos(currentPos.lat * Math.PI / 180))) * Math.sin(rad);
            const lat = currentPos.lat + latOffset;
            const lng = currentPos.lng + lngOffset;
            
            pointsToScan.push(new google.maps.LatLng(lat, lng));
            // Création d'une clé unique basée sur la position (précision 5m)
            currentBatchKeys.push(`${lat.toFixed(4)}_${lng.toFixed(4)}`);
        }
    }

    try {
        const results = await new Promise<google.maps.ElevationResult[]>((resolve, reject) => {
            elevator.getElevationForLocations({ locations: pointsToScan }, (res, status) => {
                if (status === 'OK' && res) resolve(res);
                else reject(status);
            });
        });

        const validatedDangers: RadarDanger[] = [];
        const newHistory: Record<string, number> = {};

        results.forEach((res, idx) => {
            const key = currentBatchKeys[idx];
            const elevation = res.elevation;

            // DOUBLE VALIDATION : Bathymétrie < 1.5m (Bathymétrie négative = eau peu profonde)
            // Note: En mode satellite, on simule ici que l'élévation renvoyée par Google inclut le fond marin proche.
            if (elevation > -1.5) {
                // PERSISTANCE : On incrémente le compteur pour cette coordonnée
                const prevCount = detectionHistoryRef.current[key] || 0;
                const newCount = prevCount + 1;
                newHistory[key] = newCount;

                // On ne valide que si détecté 3 fois de suite
                if (newCount >= 3) {
                    const id = `danger-${key}`;
                    if (!ignoredIds.has(id)) {
                        const dist = Math.round(getDistance(currentPos.lat, currentPos.lng, res.location.lat(), res.location.lng()));
                        validatedDangers.push({
                            id,
                            lat: res.location.lat(),
                            lng: res.location.lng(),
                            distance: dist,
                            type: elevation > 0 ? 'land' : 'reef'
                        });
                    }
                }
            }
        });

        // Mise à jour de l'historique (nettoyage des points disparus)
        detectionHistoryRef.current = newHistory;
        setDangers(validatedDangers);
        
        if (validatedDangers.length > 0) {
            const sorted = [...validatedDangers].sort((a, b) => a.distance - b.distance);
            setClosestDanger(sorted[0]);
        } else {
            setClosestDanger(null);
        }

    } catch (e) {
        console.warn("Radar IA: Scan aborted", e);
    } finally {
        setIsScanning(false);
        lastScanPosRef.current = currentPos;
    }
  }, [currentPos, ignoredIds]);

  useEffect(() => {
    if (speedKnots > 10) {
        if (dangers.length > 0) setDangers([]);
        if (closestDanger) setClosestDanger(null);
        return;
    }

    if (!currentPos) return;

    const shouldScan = !lastScanPosRef.current || 
                      getDistance(currentPos.lat, currentPos.lng, lastScanPosRef.current.lat, lastScanPosRef.current.lng) > 10;

    if (shouldScan && !isScanning) {
        performScan();
    }

    if (!scanTimerRef.current) {
        scanTimerRef.current = setInterval(() => {
            if (speedKnots <= 10) performScan();
        }, 10000);
    }

    return () => {
        if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
        }
    };
  }, [currentPos, speedKnots, performScan, dangers.length, closestDanger, isScanning]);

  return { dangers, closestDanger, isScanning, ignoreDanger };
}
