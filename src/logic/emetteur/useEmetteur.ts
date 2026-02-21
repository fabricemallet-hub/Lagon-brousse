
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, deleteDoc, collection, addDoc, query, orderBy, getDoc } from 'firebase/firestore';
import type { VesselStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) : Envoi GPS, Gestion IDs, Historique, Journaux Technique & Tactique.
 */
export function useEmetteur(onPositionUpdate?: (lat: number, lng: number) => void, onStopCleanup?: () => void) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSharing, setIsSharing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [accuracy, setAccuracy] = useState<number>(0);
  
  // Références pour les objets cartographiques Google
  const anchorCircleRef = useRef<google.maps.Circle | null>(null);
  const anchorMarkerRef = useRef<google.maps.Marker | null>(null);

  // Identité & IDs
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [vesselHistory, setVesselHistory] = useState<string[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // Journaux de bord
  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  const lastLoggedBattery = useRef<number>(100);
  const lastLoggedAccuracy = useRef<number>(100);

  const watchIdRef = useRef<number | null>(null);

  // Initialisation LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNickname = localStorage.getItem('lb_vessel_nickname');
      const savedVesselId = localStorage.getItem('lb_vessel_id');
      const savedFleetId = localStorage.getItem('lb_fleet_id');
      if (savedNickname) setVesselNickname(savedNickname);
      if (savedVesselId) setCustomSharingId(savedVesselId);
      if (savedFleetId) setCustomFleetId(savedFleetId);
      try {
        const vh = JSON.parse(localStorage.getItem('lb_vessel_history') || '[]');
        setVesselHistory(vh);
        if (savedVesselId) {
            setTechLogs(JSON.parse(localStorage.getItem(`lb_tech_logs_${savedVesselId}`) || '[]'));
            setTacticalLogs(JSON.parse(localStorage.getItem(`lb_tact_logs_${savedVesselId}`) || '[]'));
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  // Fonctions de Log
  const addTechLog = useCallback(async (label: string, details?: string) => {
    if (!firestore || !sharingId) return;
    
    let batteryLevel = 100;
    if ('getBattery' in navigator) {
        const b: any = await (navigator as any).getBattery();
        batteryLevel = Math.round(b.level * 100);
    }

    const logEntry = {
        label: label.toUpperCase(),
        details: details || '',
        time: new Date(),
        battery: batteryLevel,
        accuracy: accuracy,
        pos: currentPos
    };

    setTechLogs(prev => {
        const next = [logEntry, ...prev].slice(0, 50);
        localStorage.setItem(`lb_tech_logs_${sharingId}`, JSON.stringify(next));
        return next;
    });

    addDoc(collection(firestore, 'vessels', sharingId, 'tech_logs'), {
        ...logEntry,
        time: serverTimestamp()
    }).catch(() => {});
  }, [firestore, sharingId, accuracy, currentPos]);

  const addTacticalLog = useCallback(async (type: string, photoUrl?: string) => {
    if (!firestore || !sharingId || !currentPos) return;

    const logEntry = {
        type: type.toUpperCase(),
        time: new Date(),
        pos: currentPos,
        photoUrl: photoUrl || null
    };

    setTacticalLogs(prev => {
        const next = [logEntry, ...prev].slice(0, 50);
        localStorage.setItem(`lb_tact_logs_${sharingId}`, JSON.stringify(next));
        return next;
    });

    addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), {
        ...logEntry,
        time: serverTimestamp()
    }).then(() => toast({ title: `Signalement ${type} enregistré` }));
  }, [firestore, sharingId, currentPos, toast]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    
    let batteryInfo = { batteryLevel: 100, isCharging: false };
    if ('getBattery' in navigator) {
      try {
        const b: any = await (navigator as any).getBattery();
        batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        
        if (lastLoggedBattery.current - batteryInfo.batteryLevel >= 10) {
            addTechLog('BATTERIE', `${batteryInfo.batteryLevel}%`);
            lastLoggedBattery.current = batteryInfo.batteryLevel;
        }
      } catch (e) {}
    }

    const payload = {
      ...data,
      id: sharingId,
      userId: user.uid,
      displayName: vesselNickname || 'Capitaine',
      isSharing: true,
      lastActive: serverTimestamp(),
      fleetId: customFleetId.trim().toUpperCase() || null,
      ...batteryInfo
    };

    setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => setLastSyncTime(Date.now()))
      .catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, customFleetId, addTechLog]);

  const clearMooring = useCallback(() => {
    setAnchorPos(null);
    if (anchorCircleRef.current) {
        anchorCircleRef.current.setMap(null);
        anchorCircleRef.current = null;
    }
    if (anchorMarkerRef.current) {
        anchorMarkerRef.current.setMap(null);
        anchorMarkerRef.current = null;
    }
  }, []);

  // Correction Double Cercle : Update dynamique quand le radius change
  useEffect(() => {
    if (anchorCircleRef.current) {
      anchorCircleRef.current.setRadius(mooringRadius);
    }
  }, [mooringRadius]);

  const startSharing = () => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    localStorage.setItem('lb_vessel_nickname', vesselNickname);
    localStorage.setItem('lb_vessel_id', customSharingId);
    localStorage.setItem('lb_fleet_id', customFleetId);

    const cleanItem = customSharingId.trim().toUpperCase();
    if (cleanItem) {
        const newList = [cleanItem, ...vesselHistory.filter(i => i !== cleanItem)].slice(0, 5);
        setVesselHistory(newList);
        localStorage.setItem('lb_vessel_history', JSON.stringify(newList));
    }

    setIsSharing(true);
    addTechLog('DÉMARRAGE', `ID: ${sharingId}`);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy: acc } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        const knotSpeed = (speed || 0) * 1.94384;
        
        const roundedAcc = Math.round(acc);
        setAccuracy(roundedAcc);
        setCurrentPos(newPos);
        onPositionUpdate?.(latitude, longitude);

        if (roundedAcc < 10 && lastLoggedAccuracy.current >= 10) {
            addTechLog('GPS FIX', `Précision: +/- ${roundedAcc}m`);
        }
        lastLoggedAccuracy.current = roundedAcc;

        let nextStatus: VesselStatus['status'] = vesselStatus;
        if (vesselStatus === 'moving' || vesselStatus === 'stationary' || vesselStatus === 'drifting') {
          if (anchorPos) {
            const dist = getDistance(latitude, longitude, anchorPos.lat, anchorPos.lng);
            if (dist > mooringRadius) {
                nextStatus = 'drifting';
            } else if (knotSpeed < 0.2) {
                nextStatus = 'stationary';
            } else {
                nextStatus = 'moving';
            }
          } else {
            nextStatus = knotSpeed < 0.2 ? 'stationary' : 'moving';
          }
          setVesselStatus(nextStatus);
        }

        updateVesselInFirestore({ 
          location: { latitude, longitude }, 
          status: nextStatus,
          heading: heading || 0,
          speed: Math.round(knotSpeed),
          accuracy: roundedAcc
        });
      },
      () => {
          addTechLog('GPS ERROR', 'Signal perdu');
          toast({ variant: 'destructive', title: "GPS perdu" });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopSharing = async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    addTechLog('ARRÊT', 'Partage désactivé');
    
    if (firestore && sharingId) {
      await deleteDoc(doc(firestore, 'vessels', sharingId));
    }
    
    clearMooring();
    onStopCleanup?.();
    
    setCurrentPos(null);
    setLastSyncTime(0);
    toast({ title: "Partage arrêté" });
  };

  const toggleAnchor = () => {
      if (vesselStatus === 'stationary' || anchorPos) {
          setVesselStatus('moving');
          clearMooring();
          addTechLog('ANCRE LEVÉE');
      } else {
          clearMooring(); // Sécurité reset avant pose
          setVesselStatus('stationary');
          setAnchorPos(currentPos);
          addTechLog('MOUILLAGE ACTIF', `Rayon: ${mooringRadius}m`);
      }
  };

  const deleteFromHistory = async (id: string) => {
    const newList = vesselHistory.filter(i => i !== id);
    setVesselHistory(newList);
    localStorage.setItem('lb_vessel_history', JSON.stringify(newList));
    if (firestore) await deleteDoc(doc(firestore, 'vessels', id));
    toast({ title: "ID supprimé" });
  };

  const setManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving') clearMooring();
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    addTechLog('STATUS CHANGE', label || st.toUpperCase());
    toast({ title: label || "Statut mis à jour" });
  };

  const handleSelectFromHistory = (id: string) => {
    setCustomSharingId(id);
    // On ne lance pas startSharing tout de suite pour laisser le choix à l'utilisateur
    toast({ title: `ID ${id} chargé`, description: "Cliquez sur Lancer le Partage pour activer." });
  };

  return {
    isSharing,
    startSharing,
    stopSharing,
    currentPos,
    vesselStatus,
    setManualStatus,
    anchorPos,
    toggleAnchor,
    mooringRadius,
    setMooringRadius,
    accuracy,
    vesselNickname,
    setVesselNickname,
    customSharingId,
    setCustomSharingId,
    customFleetId,
    setCustomFleetId,
    vesselHistory,
    deleteFromHistory,
    handleSelectFromHistory,
    lastSyncTime,
    techLogs,
    tacticalLogs,
    addTacticalLog,
    addTechLog,
    clearLogs: () => { setTechLogs([]); setTacticalLogs([]); localStorage.removeItem(`lb_tech_logs_${sharingId}`); localStorage.removeItem(`lb_tact_logs_${sharingId}`); },
    anchorCircleRef,
    anchorMarkerRef
  };
}
