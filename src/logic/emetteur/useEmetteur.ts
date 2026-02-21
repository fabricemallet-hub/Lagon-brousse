'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) : Envoi GPS, Gestion IDs, Historique, LED Sync.
 */
export function useEmetteur(onPositionUpdate?: (lat: number, lng: number) => void) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSharing, setIsSharing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [battery, setBattery] = useState<{ level: number, charging: boolean }>({ level: 1, charging: false });
  
  // Identité & IDs
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  
  // Historique & Sync
  const [vesselHistory, setVesselHistory] = useState<string[]>([]);
  const [fleetHistory, setFleetHistory] = useState<string[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);

  // 1. Initialisation depuis LocalStorage
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
        const fh = JSON.parse(localStorage.getItem('lb_fleet_history') || '[]');
        setVesselHistory(vh);
        setFleetHistory(fh);
      } catch (e) {
        setVesselHistory([]);
        setFleetHistory([]);
      }
    }
  }, []);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  // 2. Logique de synchronisation Firestore
  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    
    let batteryInfo = {};
    if ('getBattery' in navigator) {
      try {
        const b: any = await (navigator as any).getBattery();
        batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
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
  }, [user, firestore, isSharing, sharingId, vesselNickname, customFleetId]);

  // 3. Commandes de Partage
  const startSharing = () => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    // Sauvegarder les IDs actuels
    localStorage.setItem('lb_vessel_nickname', vesselNickname);
    localStorage.setItem('lb_vessel_id', customSharingId);
    localStorage.setItem('lb_fleet_id', customFleetId);

    // Mettre à jour l'historique
    const updateHistoryList = (list: string[], item: string, key: string) => {
      const cleanItem = item.trim().toUpperCase();
      if (!cleanItem) return list;
      const newList = [cleanItem, ...list.filter(i => i !== cleanItem)].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(newList));
      return newList;
    };
    
    if (customSharingId) setVesselHistory(prev => updateHistoryList(prev, customSharingId, 'lb_vessel_history'));
    if (customFleetId) setFleetHistory(prev => updateHistoryList(prev, customFleetId, 'lb_fleet_history'));

    setIsSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        const knotSpeed = (speed || 0) * 1.94384;
        
        setCurrentPos(newPos);
        onPositionUpdate?.(latitude, longitude);

        // Détection auto de dérive/mouillage
        let nextStatus: VesselStatus['status'] = vesselStatus;
        if (vesselStatus === 'moving' || vesselStatus === 'stationary' || vesselStatus === 'drifting') {
          if (!anchorPos) setAnchorPos(newPos);
          const dist = getDistance(latitude, longitude, anchorPos?.lat || latitude, anchorPos?.lng || longitude);
          
          if (dist > mooringRadius) {
            nextStatus = 'drifting';
          } else if (knotSpeed < 0.2) {
            nextStatus = 'stationary';
          } else {
            nextStatus = 'moving';
          }
          setVesselStatus(nextStatus);
        }

        updateVesselInFirestore({ 
          location: { latitude, longitude }, 
          status: nextStatus,
          heading: heading || 0,
          speed: Math.round(knotSpeed)
        });
      },
      () => toast({ variant: 'destructive', title: "GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopSharing = async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    
    if (firestore && sharingId) {
      // Suppression du document pour disparaître des cartes
      await deleteDoc(doc(firestore, 'vessels', sharingId));
    }
    
    setCurrentPos(null);
    setAnchorPos(null);
    setLastSyncTime(0);
    toast({ title: "Partage arrêté et navire retiré" });
  };

  // 4. Gestion de l'historique
  const deleteFromHistory = async (type: 'vessel' | 'fleet', id: string) => {
    if (type === 'vessel') {
      const newList = vesselHistory.filter(i => i !== id);
      setVesselHistory(newList);
      localStorage.setItem('lb_vessel_history', JSON.stringify(newList));
      // Nettoyage Firebase associé
      if (firestore) await deleteDoc(doc(firestore, 'vessels', id));
    } else {
      const newList = fleetHistory.filter(i => i !== id);
      setFleetHistory(newList);
      localStorage.setItem('lb_fleet_history', JSON.stringify(newList));
    }
    toast({ title: "ID supprimé de l'historique" });
  };

  const setManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving') setAnchorPos(currentPos);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || "Statut mis à jour" });
  };

  return {
    isSharing,
    startSharing,
    stopSharing,
    currentPos,
    vesselStatus,
    setManualStatus,
    anchorPos,
    setAnchorPos,
    mooringRadius,
    setMooringRadius,
    battery,
    vesselNickname,
    setVesselNickname,
    customSharingId,
    setCustomSharingId,
    customFleetId,
    setCustomFleetId,
    vesselHistory,
    fleetHistory,
    deleteFromHistory,
    lastSyncTime
  };
}
