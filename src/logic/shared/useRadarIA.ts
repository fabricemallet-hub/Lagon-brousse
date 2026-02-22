'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getDistance } from '@/lib/utils';
import type { RadarDanger } from '@/lib/types';

/**
 * HOOK RADAR IA v100.0 : SENTINEL V3.1 (Optimisation Flux & Pause)
 * Ajout v100.0 : Paramètre isPaused pour libérer le thread lors des interactions UX lourdes.
 */
export function useRadarIA(
    currentPos: { lat: number, lng: number } | null, 
    speedKnots: number = 0, 
    vesselStatus?: string,
    isPaused: boolean = false
) {
  const [dangers, setDangers] = useState<RadarDanger[]>([]);
  const [closestDanger, setClosestDanger] = useState<RadarDanger | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const lastScanPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const detectionHistoryRef = useRef<Record<string, number>>({});
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  const ignoreDanger = useCallback((id: string) => {
    setIgnoredIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
    });
  }, []);

  const performScan = useCallback(async () => {
    // v100.0 : Protection UX - On ne scanne pas si en pause ou en mouvement rapide
    if (isPaused) return;

    const isStatusStable = vesselStatus === 'stationary' || vesselStatus === 'drifting' || vesselStatus === 'emergency';
    if (!currentPos || typeof google === 'undefined' || !isStatusStable) {
        if (dangers.length > 0) setDangers([]);
        return;
    }
    
    setIsScanning(true);
    const elevator = new google.maps.ElevationService();

    try {
        const radarRadius = 200;
        const step = 45;
        const pointsToScan: google.maps.LatLng[] = [];
        const currentBatchKeys: string[] = [];

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
            // Seuil bathymétrique strict v92.1
            const isCriticalDepth = elevation >= -1.2 && elevation <= 0.5;

            if (isCriticalDepth) {
                const prevCount = detectionHistoryRef.current[key] || 0;
                const newCount = prevCount + 1;
                newHistory[key] = newCount;

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
    } finally {
        setIsScanning(false);
        lastScanPosRef.current = currentPos;
    }
  }, [currentPos, ignoredIds, vesselStatus, dangers.length, isPaused]);

  useEffect(() => {
    if (isPaused) return;
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
  }, [currentPos, speedKnots, performScan, dangers.length, closestDanger, isScanning, isPaused]);

  return { dangers, closestDanger, isScanning, ignoreDanger };
}
