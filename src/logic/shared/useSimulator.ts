
'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * HOOK SIMULATEUR : Gère l'état et les commandes de simulation tactique.
 * v58.1 : Mémorisation de l'objet retourné pour éviter les boucles de rendu.
 */
export function useSimulator() {
  const [isActive, setIsActive] = useState(false);
  const [isGpsCut, setIsGpsCut] = useState(false);
  const [isComCut, setIsComCut] = useState(false);
  const [simSpeed, setSimSpeed] = useState(15);
  const [simAccuracy, setSimAccuracy] = useState(5);
  const [simPos, setSimPos] = useState<{lat: number, lng: number} | null>(null);

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
  }, []);

  const teleport = useCallback((newPos: {lat: number, lng: number}) => {
    setSimPos(newPos);
    setIsActive(true);
  }, []);

  const forceDrift = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const offset = (radius + 5) * degPerMeter;
    setSimPos({ lat: anchorPos.lat + offset, lng: anchorPos.lng });
    setIsActive(true);
  }, []);

  const nudge = useCallback((anchorPos: {lat: number, lng: number} | null, radius: number) => {
    if (!anchorPos) return;
    const degPerMeter = 1 / 111320;
    const offset = (radius * 0.5) * degPerMeter;
    setSimPos({ 
        lat: anchorPos.lat + (Math.random() - 0.5) * offset,
        lng: anchorPos.lng + (Math.random() - 0.5) * offset 
    });
    setIsActive(true);
  }, []);

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
