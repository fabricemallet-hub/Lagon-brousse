
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * HOOK SIMULATEUR v66.0 : Gère l'état et les commandes de simulation tactique.
 * Nudge calibré à 90% du rayon pour tester la stabilité sans déclenchement.
 */
export function useSimulator() {
  const [isActive, setIsActive] = useState(false);
  const [isGpsCut, setIsGpsCut] = useState(false);
  const [isComCut, setIsComCut] = useState(false);
  const [simSpeed, setSimSpeed] = useState(15);
  const [simAccuracy, setSimAccuracy] = useState(5);
  const [simPos, setSimPos] = useState<{lat: number, lng: number} | null>(null);
  
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
    setSimPos(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const teleport = useCallback((newPos: {lat: number, lng: number}) => {
    setSimPos(newPos);
    setIsActive(true);
  }, []);

  // Déplacement dans le cercle (Simulation clapot) - Reste à 90% du rayon pour tester la stabilité
  const nudge = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const nudgeDist = radius * 0.9; // Reste à l'intérieur à 90% du rayon
    const angle = Math.random() * Math.PI * 2;
    const offsetLat = Math.cos(angle) * (nudgeDist * degPerMeter);
    const offsetLng = Math.sin(angle) * (nudgeDist * degPerMeter);
    setSimPos({ lat: anchorPos.lat + offsetLat, lng: anchorPos.lng + offsetLng });
    setIsActive(true);
  }, []);

  // Forcer la dérive (Déclenchement alarme) - Projette à coup sûr en dehors
  const forceDrift = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const driftDist = radius + 30; // Sort de 30m pour garantir le déclenchement de l'alarme
    const angle = Math.random() * Math.PI * 2;
    const offsetLat = Math.cos(angle) * (driftDist * degPerMeter);
    const offsetLng = Math.sin(angle) * (driftDist * degPerMeter);
    setSimPos({ lat: anchorPos.lat + offsetLat, lng: anchorPos.lng + offsetLng });
    setIsActive(true);
  }, []);

  // Moteur de déplacement 1Hz
  useEffect(() => {
    if (isActive && simSpeed > 0 && !isGpsCut) {
        timerRef.current = setInterval(() => {
            setSimPos(prev => {
                if (!prev) return prev;
                // Calcul de déplacement fluide à 1Hz
                const degPerSecAt15Kts = 0.00007; 
                const step = (simSpeed / 15) * degPerSecAt15Kts;
                return { lat: prev.lat + step, lng: prev.lng + step };
            });
        }, 1000); // 1Hz stable
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
    simSpeed,
    setSimSpeed,
    simAccuracy,
    setSimAccuracy,
    simPos,
    setSimPos,
    teleport,
    forceDrift,
    nudge
  }), [
    isActive, simPos, simSpeed, simAccuracy, isGpsCut, isComCut,
    startSim, stopSim, teleport, forceDrift, nudge
  ]);
}
