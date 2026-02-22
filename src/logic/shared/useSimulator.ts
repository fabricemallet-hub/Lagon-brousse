
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * HOOK SIMULATEUR v80.3 : "Moteur de Mouvement Fluide & Boucle RAF"
 * Gère l'état et les commandes de simulation GPS avec rendu haute fréquence.
 * Correction v80.3 : Initialisation automatique de la position si null.
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
  const [simBattery, setSimBattery] = useState(100);
  const [simPos, setSimPos] = useState<{lat: number, lng: number} | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const [simBearing, setSimBearing] = useState(45); 
  
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Auto-initialisation de la position si la Sandbox est active
  useEffect(() => {
    if (isActive && !simPos) {
      // Point par défaut (Nouméa) si aucune position n'est injectée
      setSimPos({ lat: -22.27, lng: 166.45 });
    }
  }, [isActive, simPos]);

  const startSim = useCallback((currentPos: {lat: number, lng: number} | null) => {
    setIsActive(true);
    if (currentPos) setSimPos(currentPos);
    else if (!simPos) setSimPos({ lat: -22.27, lng: 166.45 }); 
  }, [simPos]);

  const stopSim = useCallback(() => {
    setIsActive(false);
    setIsMoving(false);
    setIsGpsCut(false);
    setIsComCut(false);
    setIsTeleportMode(false);
    setSimSpeed(0);
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
    setSimSpeed(1); 
    setIsActive(true);
    setIsMoving(true);
  }, [isActive]);

  // MOTEUR DE NAVIGATION FICTIVE (v80.3) - BOUCLE FLUIDE
  useEffect(() => {
    if (isActive && isMoving && simSpeed > 0 && !isGpsCut) {
        lastUpdateRef.current = performance.now();

        const animate = (time: number) => {
            const dt = (time - lastUpdateRef.current) / 1000; // Delta en secondes
            lastUpdateRef.current = time;

            // On ne calcule le déplacement que si le temps a avancé
            if (dt > 0) {
                setSimPos(prev => {
                    // Si prev est null, on utilise le point par défaut pour démarrer le mouvement
                    const current = prev || { lat: -22.27, lng: 166.45 };
                    
                    // 1 nds = 0.514444 m/s
                    const metersPerSec = simSpeed * 0.514444;
                    const distanceMoved = metersPerSec * dt;
                    
                    const degPerMeter = 1 / 111320;
                    const lngCorrection = 1 / Math.cos(current.lat * Math.PI / 180);
                    const rad = (simBearing * Math.PI) / 180;
                    
                    const dLat = Math.cos(rad) * (distanceMoved * degPerMeter);
                    const dLng = Math.sin(rad) * (distanceMoved * degPerMeter * lngCorrection);
                    
                    return { 
                        lat: current.lat + dLat, 
                        lng: current.lng + dLng 
                    };
                });
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
    } else {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, isMoving, simSpeed, isGpsCut, simBearing]);

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
    isMoving,
    setIsMoving,
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
    setTimeOffset,
    simBearing,
    setSimBearing
  }), [
    isActive, simPos, simSpeed, simAccuracy, simBattery, isGpsCut, isComCut, isTeleportMode, isMoving, timeOffset, simBearing,
    startSim, stopSim, teleport, forceDrift, setTimeOffset
  ]);
}
