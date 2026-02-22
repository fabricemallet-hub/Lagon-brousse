'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getDistance } from '@/lib/utils';
import type { RadarDanger } from '@/lib/types';

/**
 * HOOK RADAR IA v92.1 : SENTINEL V3 (Filtrage Chirurgical)
 * Scanne l'environnement satellite pour détecter les récifs et la terre.
 * Ajout v92.1 : Seuil bathymétrique strict (-1.2m à +0.5m) et veille auto en eaux profondes.
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
   * PerformScan v92.1 : Intègre le seuil strict et la validation de zone profonde.
   */
  const performScan = useCallback(async () => {
    if (!currentPos || typeof google === 'undefined') return;
    
    setIsScanning(true);
    const elevator = new google.maps.ElevationService();

    // v92.1 : Étape 1 - Vérification de la zone (Deep Water Check)
    // On vérifie la profondeur sous le bateau. Si c'est trop profond, on ne scanne pas le reste.
    try {
        const boatElevationRes = await new Promise<google.maps.ElevationResult[]>((resolve, reject) => {
            elevator.getElevationForLocations({ 
                locations: [new google.maps.LatLng(currentPos.lat, currentPos.lng)] 
            }, (res, status) => {
                if (status === 'OK' && res) resolve(res);
                else reject(status);
            });
        });

        const boatDepth = boatElevationRes[0]?.elevation || 0;
        // Si on est en plein bleu (fond > 10m), on désactive Sentinel pour économiser l'API
        if (boatDepth < -10) {
            setDangers([]);
            setClosestDanger(null);
            setIsScanning(false);
            return;
        }
    } catch (e) {
        // En cas d'erreur API, on continue par prudence
    }

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

            // v92.1 : SEUIL BATHYMÉTRIQUE STRICT (-1.2m à +0.5m)
            // On ignore tout ce qui est plus profond que 1.2m (pas de risque immédiat pour la coque)
            // On ignore tout ce qui est plus haut que 0.5m (terre ferme visible, évite les faux positifs sur les arbres/reliefs côtiers)
            const isCriticalDepth = elevation >= -1.2 && elevation <= 0.5;

            if (isCriticalDepth) {
                const prevCount = detectionHistoryRef.current[key] || 0;
                const newCount = prevCount + 1;
                newHistory[key] = newCount;

                // Validation sur 3 scans consécutifs (Persistance temporelle)
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
