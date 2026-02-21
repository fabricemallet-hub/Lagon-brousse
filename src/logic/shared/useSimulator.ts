
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * HOOK SIMULATEUR v78.0 : "Sandbox Tactique Totale"
 * Gère l'état et les commandes de simulation GPS, vitesse et batterie.
 */
export function useSimulator() {
  const [isActive, setIsActive] = useState(false);
  const [isGpsCut, setIsGpsCut] = useState(false);
  const [isComCut, setIsComCut] = useState(false);
  const [isTeleportMode, setIsTeleportMode] = useState(false);
  
  // États simulés
  const [simSpeed, setSimSpeed] = useState(0);
  const [simAccuracy, setSimAccuracy] = useState(5);
  const [simBattery, setSimBattery] = useState(100);
  const [simPos, setSimPos] = useState<{lat: number, lng: number} | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startSim = useCallback((currentPos: {lat: number, lng: number} | null) => {
    setIsActive(true);
    if (!simPos && currentPos) setSimPos(currentPos);
    else if (!simPos) setSimPos({ lat: -22.27, lng: 166.45 }); 
  }, [simPos]);

  const stopSim = useCallback(() => {
    setIsActive(false);
    setIsGpsCut(false);
    setIsComCut(false);
    setIsTeleportMode(false);
    setSimSpeed(0);
    setTimeOffset(0);
    setSimPos(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const teleport = useCallback((lat: number, lng: number) => {
    setSimPos({ lat, lng });
    if (!isActive) setIsActive(true);
    setIsTeleportMode(false);
  }, [isActive]);

  const forceDrift = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const driftDist = radius + 20; // Juste assez pour sortir
    const angle = 45 * (Math.PI / 180);
    const offsetLat = Math.cos(angle) * (driftDist * degPerMeter);
    const offsetLng = Math.sin(angle) * (driftDist * degPerMeter);
    setSimPos({ lat: anchorPos.lat + offsetLat, lng: anchorPos.lng + offsetLng });
    setSimSpeed(1); // Faible vitesse pour simuler la dérive
    setIsActive(true);
  }, []);

  // Boucle de mouvement automatique (vitesse > 0)
  useEffect(() => {
    if (isActive && simSpeed > 0 && !isGpsCut) {
        timerRef.current = setInterval(() => {
            setSimPos(prev => {
                if (!prev) return prev;
                // Calcul du déplacement par seconde : 1 nds = 0.514 m/s
                const metersPerSec = simSpeed * 0.514444;
                const degPerMeter = 1 / 111320;
                const step = metersPerSec * degPerMeter;
                return { lat: prev.lat + step, lng: prev.lng + step };
            });
        }, 1000);
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, simSpeed, isGpsCut]);

  return useMemo(() => ({
    isActive,
    setIsActive,
    startSim,
    stopSim,
    isGpsCut,
    setIsGpsCut,
    isComCut,
    setIsComCut,
    isTeleportMode,
    setIsTeleportMode,
    simSpeed,
    setSimSpeed,
    simAccuracy,
    setSimAccuracy,
    simBattery,
    setSimBattery,
    simPos,
    setSimPos,
    teleport,
    forceDrift,
    timeOffset,
    setTimeOffset
  }), [
    isActive, simPos, simSpeed, simAccuracy, simBattery, isGpsCut, isComCut, isTeleportMode, timeOffset,
    startSim, stopSim, teleport, forceDrift, setTimeOffset
  ]);
}
