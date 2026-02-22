
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDistance } from '@/lib/utils';
import type { RadarDanger } from '@/lib/types';

/**
 * HOOK RADAR IA v90.0 : SENTINEL
 * Scanne l'environnement satellite pour détecter les récifs et la terre.
 */
export function useRadarIA(currentPos: { lat: number, lng: number } | null, speedKnots: number = 0) {
  const [dangers, setDangers] = useState<RadarDanger[]>([]);
  const [closestDanger, setClosestDanger] = useState<RadarDanger | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const lastScanPosRef = useRef<{ lat: number, lng: number } | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Simulation de segmentation IA par analyse de relief et chrominance satellite.
   * En production, cela utiliserait TensorFlow.js sur un canvas capture.
   */
  const performScan = useCallback(async () => {
    if (!currentPos || typeof google === 'undefined') return;
    
    setIsScanning(true);
    const elevator = new google.maps.ElevationService();
    const radarRadius = 200; // 200m
    const step = 45; // 8 directions
    
    const detectedDangers: RadarDanger[] = [];
    const pointsToScan: google.maps.LatLng[] = [];

    // Création d'une grille de points autour du navire
    for (let angle = 0; angle < 360; angle += step) {
        for (let dist = 50; dist <= radarRadius; dist += 50) {
            const rad = (angle * Math.PI) / 180;
            const latOffset = (dist / 111320) * Math.cos(rad);
            const lngOffset = (dist / (111320 * Math.cos(currentPos.lat * Math.PI / 180))) * Math.sin(rad);
            pointsToScan.push(new google.maps.LatLng(currentPos.lat + latOffset, currentPos.lng + lngOffset));
        }
    }

    try {
        const results = await new Promise<google.maps.ElevationResult[]>((resolve, reject) => {
            elevator.getElevationForLocations({ locations: pointsToScan }, (res, status) => {
                if (status === 'OK' && res) resolve(res);
                else reject(status);
            });
        });

        results.forEach((res, idx) => {
            if (res.elevation > -1.5) { // Seuil de danger : moins de 1.5m de fond ou terre
                const dist = Math.round(getDistance(currentPos.lat, currentPos.lng, res.location.lat(), res.location.lng()));
                detectedDangers.push({
                    id: `danger-${idx}`,
                    lat: res.location.lat(),
                    lng: res.location.lng(),
                    distance: dist,
                    type: res.elevation > 0 ? 'land' : 'reef'
                });
            }
        });

        setDangers(detectedDangers);
        
        if (detectedDangers.length > 0) {
            const sorted = [...detectedDangers].sort((a, b) => a.distance - b.distance);
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
  }, [currentPos]);

  useEffect(() => {
    // RÈGLE v90.0 : Masquer le radar si vitesse > 10 noeuds
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

    // Refresh toutes les 10 secondes
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
  }, [currentPos, speedKnots, performScan, dangers.length, closestDanger]);

  return { dangers, closestDanger, isScanning };
}
