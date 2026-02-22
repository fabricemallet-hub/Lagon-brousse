
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * HOOK SIMULATEUR v98.0 : "Moteur de Mouvement & Sandbox Haute Précision"
 * Ajout v98.0 : simSpeed step 0.1 pour les tests de dérive fine.
 */
export function useSimulator() {
  const [isActive, setIsActive] = useState(false);
  const [isGpsCut, setIsGpsCut] = useState(false);
  const [isComCut, setIsComCut] = useState(false);
  const [isTeleportMode, setIsTeleportMode] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  
  // États simulés
  const [simSpeed, setSimSpeed] = useState(0);
  const [simAccuracy, setSimAccuracy] = useState(5);
  const [simGpsNoise, setSimGpsNoise] = useState(0);
  const [simBattery, setSimBattery] = useState(100);
  const [simPos, setSimPos] = useState<{lat: number, lng: number} | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const [simBearing, setSimBearing] = useState(45); 
  
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (isActive && !simPos) {
      setSimPos({ lat: -22.27, lng: 166.45 });
    }
  }, [isActive, simPos]);

  const stopSim = useCallback(() => {
    setIsActive(false);
    setIsMoving(false);
    setIsGpsCut(false);
    setIsComCut(false);
    setIsTeleportMode(false);
    setSimSpeed(0);
    setSimGpsNoise(0);
    setTimeOffset(0);
    setSimPos(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const teleport = useCallback((lat: number, lng: number) => {
    setSimPos({ lat, lng });
    if (!isActive) setIsActive(true);
    setIsTeleportMode(false);
  }, [isActive]);

  const forceDrift = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const driftDist = radius + 20; 
    const angle = 45 * (Math.PI / 180);
    const offsetLat = Math.cos(angle) * (driftDist * degPerMeter);
    const offsetLng = Math.sin(angle) * (driftDist * degPerMeter);
    setSimPos({ lat: anchorPos.lat + offsetLat, lng: anchorPos.lng + offsetLng });
    setSimSpeed(0.5); // v98.0 : Vitesse de dérive type
    setIsActive(true);
    setIsMoving(true);
  }, [isActive]);

  useEffect(() => {
    if (isActive && isMoving && simSpeed > 0 && !isGpsCut) {
        lastUpdateRef.current = performance.now();
        const animate = (time: number) => {
            const dt = (time - lastUpdateRef.current) / 1000;
            lastUpdateRef.current = time;
            if (dt > 0) {
                setSimPos(prev => {
                    const current = prev || { lat: -22.27, lng: 166.45 };
                    const metersPerSec = simSpeed * 0.514444;
                    const distanceMoved = metersPerSec * dt;
                    const degPerMeter = 1 / 111320;
                    const lngCorrection = 1 / Math.cos(current.lat * Math.PI / 180);
                    const rad = (simBearing * Math.PI) / 180;
                    const dLat = Math.cos(rad) * (distanceMoved * degPerMeter);
                    const dLng = Math.sin(rad) * (distanceMoved * degPerMeter * lngCorrection);
                    let jitterLat = 0, jitterLng = 0;
                    if (simGpsNoise > 0) {
                        jitterLat = (Math.random() - 0.5) * (simGpsNoise * degPerMeter);
                        jitterLng = (Math.random() - 0.5) * (simGpsNoise * degPerMeter * lngCorrection);
                    }
                    return { lat: current.lat + dLat + jitterLat, lng: current.lng + dLng + jitterLng };
                });
            }
            rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
    } else if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, isMoving, simSpeed, isGpsCut, simBearing, simGpsNoise]);

  return useMemo(() => ({
    isActive, setIsActive, stopSim, isGpsCut, setIsGpsCut, isComCut, setIsComCut,
    isTeleportMode, setIsTeleportMode, isMoving, setIsMoving,
    simSpeed, setSimSpeed, simAccuracy, setSimAccuracy, simGpsNoise, setSimGpsNoise,
    simBattery, setSimBattery, simPos, setSimPos, teleport, forceDrift,
    timeOffset, setTimeOffset, simBearing, setSimBearing
  }), [isActive, simPos, simSpeed, simAccuracy, simGpsNoise, simBattery, isGpsCut, isComCut, isTeleportMode, isMoving, timeOffset, simBearing, stopSim, teleport, forceDrift]);
}
