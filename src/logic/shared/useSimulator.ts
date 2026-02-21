
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * HOOK SIMULATEUR v77.0 : Gère l'état et les commandes de simulation tactique.
 * Ajout de la gestion du décalage temporel (Time Offset) pour les tests de seuils.
 */
export function useSimulator() {
  const [isActive, setIsActive] = useState(false);
  const [isGpsCut, setIsGpsCut] = useState(false);
  const [isComCut, setIsComCut] = useState(false);
  const [simSpeed, setSimSpeed] = useState(15);
  const [simAccuracy, setSimAccuracy] = useState(5);
  const [simPos, setSimPos] = useState<{lat: number, lng: number} | null>(null);
  
  // Décalage temporel en minutes (pour simuler le passé)
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
    setTimeOffset(0);
    setSimPos(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const teleport = useCallback((newPos: {lat: number, lng: number}) => {
    setSimPos(newPos);
    setIsActive(true);
  }, []);

  const nudge = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const nudgeDist = radius * 0.9;
    const angle = Math.random() * Math.PI * 2;
    const offsetLat = Math.cos(angle) * (nudgeDist * degPerMeter);
    const offsetLng = Math.sin(angle) * (nudgeDist * degPerMeter);
    setSimPos({ lat: anchorPos.lat + offsetLat, lng: anchorPos.lng + offsetLng });
    setIsActive(true);
  }, []);

  const forceDrift = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const driftDist = radius + 30;
    const angle = Math.random() * Math.PI * 2;
    const offsetLat = Math.cos(angle) * (driftDist * degPerMeter);
    const offsetLng = Math.sin(angle) * (driftDist * degPerMeter);
    setSimPos({ lat: anchorPos.lat + offsetLat, lng: anchorPos.lng + offsetLng });
    setIsActive(true);
  }, []);

  useEffect(() => {
    if (isActive && simSpeed > 0 && !isGpsCut) {
        timerRef.current = setInterval(() => {
            setSimPos(prev => {
                if (!prev) return prev;
                const degPerSecAt15Kts = 0.00007; 
                const step = (simSpeed / 15) * degPerSecAt15Kts;
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
    simSpeed,
    setSimSpeed,
    simAccuracy,
    setSimAccuracy,
    simPos,
    setSimPos,
    teleport,
    forceDrift,
    nudge,
    timeOffset,
    setTimeOffset
  }), [
    isActive, simPos, simSpeed, simAccuracy, isGpsCut, isComCut, timeOffset,
    startSim, stopSim, teleport, forceDrift, nudge, setTimeOffset
  ]);
}
