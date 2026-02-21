
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import type { VesselStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) v72.0 : "Moteur Tactique & Énergie"
 * Force la création du document Firestore au démarrage pour visibilité immédiate.
 */
export function useEmetteur(
    handlePositionUpdate?: (lat: number, lng: number, status: string) => void, 
    handleStopCleanup?: () => void,
    simulator?: any
) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSharing, setIsSharing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [idsHistory, setIdsHistory] = useState<{ vId: string, fId: string }[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  const [battery, setBattery] = useState<{ level: number, charging: boolean }>({ level: 1, charging: false });

  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const isBatteryAlertSentRef = useRef<boolean>(false);
  
  const currentPosRef = useRef(currentPos);
  useEffect(() => { currentPosRef.current = currentPos; }, [currentPos]);

  const handlePositionUpdateRef = useRef(handlePositionUpdate);
  const handleStopCleanupRef = useRef(handleStopCleanup);
  useEffect(() => { handlePositionUpdateRef.current = handlePositionUpdate; }, [handlePositionUpdate]);
  useEffect(() => { handleStopCleanupRef.current = handleStopCleanup; }, [handleStopCleanup]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('getBattery' in navigator)) return;
    let batteryObj: any = null;
    const updateBatteryState = () => {
      if (batteryObj) {
        setBattery({ level: batteryObj.level, charging: batteryObj.charging });
      }
    };
    (navigator as any).getBattery().then((b: any) => {
      batteryObj = b;
      updateBatteryState();
      b.addEventListener('levelchange', updateBatteryState);
      b.addEventListener('chargingchange', updateBatteryState);
    });
    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', updateBatteryState);
        batteryObj.removeEventListener('chargingchange', updateBatteryState);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNickname = localStorage.getItem('lb_vessel_nickname');
      const savedVesselId = localStorage.getItem('lb_vessel_id');
      const savedFleetId = localStorage.getItem('lb_fleet_id');
      const savedHistory = localStorage.getItem('lb_ids_history');
      const savedStatus = localStorage.getItem('lb_vessel_status') as VesselStatus['status'];
      const savedRadius = localStorage.getItem('lb_mooring_radius');
      const savedEmergencyContact = localStorage.getItem('lb_emergency_contact');
      const savedSmsMessage = localStorage.getItem('lb_vessel_sms_message');
      const savedEmergencyEnabled = localStorage.getItem('lb_emergency_enabled');

      if (savedNickname) setVesselNickname(savedNickname);
      if (savedVesselId) setCustomSharingId(savedVesselId);
      if (savedFleetId) setCustomFleetId(savedFleetId);
      if (savedStatus) setVesselStatus(savedStatus);
      if (savedRadius) setMooringRadius(parseInt(savedRadius));
      if (savedEmergencyContact) setEmergencyContact(savedEmergencyContact);
      if (savedSmsMessage) setVesselSmsMessage(savedSmsMessage);
      if (savedEmergencyEnabled !== null) setIsEmergencyEnabled(savedEmergencyEnabled === 'true');
      if (savedHistory) {
        try { setIdsHistory(JSON.parse(savedHistory)); } catch (e) {}
      }
    }
  }, []);

  const addTechLog = useCallback(async (label: string, details?: string) => {
    if (!firestore || !sharingId) return;
    const logEntry = {
        label: label.toUpperCase(),
        details: details || '',
        time: new Date(),
        pos: currentPosRef.current
    };
    setTechLogs(prev => [logEntry, ...prev].slice(0, 50));
    addDoc(collection(firestore, 'vessels', sharingId, 'tech_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
  }, [firestore, sharingId]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>, force = false) => {
    if (!user || !firestore || (!isSharing && !force)) return;
    if (simulator?.isComCut) return; 
    
    const batteryLevel = Math.round(battery.level * 100);
    const isCharging = battery.charging;

    if (batteryLevel < 10 && !isBatteryAlertSentRef.current) {
        isBatteryAlertSentRef.current = true;
        addTechLog('ALERTE ÉNERGIE', `Batterie critique: ${batteryLevel}%`);
        if (currentPosRef.current) {
            updateDoc(doc(firestore, 'vessels', sharingId), {
                lastSafePos: {
                    latitude: currentPosRef.current.lat,
                    longitude: currentPosRef.current.lng,
                    timestamp: serverTimestamp()
                }
            }).catch(() => {});
        }
    } else if (batteryLevel >= 10) {
        isBatteryAlertSentRef.current = false;
    }

    const payload = {
      ...data,
      id: sharingId,
      userId: user.uid,
      displayName: vesselNickname || 'Capitaine',
      isSharing: force ? true : isSharing,
      lastActive: serverTimestamp(),
      fleetId: customFleetId.trim().toUpperCase() || null,
      mooringRadius: mooringRadius,
      batteryLevel,
      isCharging
    };

    return setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => {
          setLastSyncTime(Date.now());
          lastSentStatusRef.current = data.status || lastSentStatusRef.current;
      })
      .catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, customFleetId, mooringRadius, simulator?.isComCut, addTechLog, battery]);

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE' | 'DÉRIVE') => {
    if (!isSharing) return;
    setVesselStatus('emergency');
    updateVesselInFirestore({ status: 'emergency', eventLabel: type });
    addTechLog('URGENCE', `${type} DÉCLENCHÉ`);
    
    if (isEmergencyEnabled && emergencyContact) {
        const body = `[${(vesselNickname || 'KOOLAPIK').toUpperCase()}] ${isCustomMessageEnabled && vesselSmsMessage ? vesselSmsMessage : "Requiert assistance immédiate."} [${type}] à ${format(new Date(), 'HH:mm')}. Position : https://www.google.com/maps?q=${currentPosRef.current?.lat.toFixed(6)},${currentPosRef.current?.lng.toFixed(6)}`;
        window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    }
    toast({ variant: "destructive", title: `ALERTE ${type}` });
  }, [isSharing, updateVesselInFirestore, addTechLog, isEmergencyEnabled, emergencyContact, vesselNickname, isCustomMessageEnabled, vesselSmsMessage, toast]);

  const handlePositionLogic = useCallback((lat: number, lng: number, speed: number, heading: number, acc: number) => {
    const knotSpeed = speed * 1.94384;
    let nextStatus = vesselStatus;

    if (knotSpeed > 5) {
        if (vesselStatus !== 'moving') {
            nextStatus = 'moving';
            setAnchorPos(null);
            addTechLog('AUTO', 'Navigation détectée (>5 nds)');
        }
    } 
    else if (knotSpeed < 2 && vesselStatus === 'moving') {
        nextStatus = 'stationary';
        setAnchorPos({ lat, lng });
        addTechLog('AUTO', 'Mouillage stabilisé (<2 nds)');
    }

    if ((nextStatus === 'stationary' || nextStatus === 'drifting') && anchorPos) {
        const dist = getDistance(lat, lng, anchorPos.lat, anchorPos.lng);
        if (dist > mooringRadius) {
            if (acc <= 25) {
                nextStatus = 'drifting';
                if (vesselStatus !== 'drifting' && vesselStatus !== 'emergency') {
                    addTechLog('ALERTE', `Sortie de zone (${Math.round(dist)}m)`);
                    triggerEmergency('DÉRIVE');
                }
            }
        } else if (nextStatus === 'drifting') {
            nextStatus = 'stationary';
            addTechLog('INFO', 'Retour en zone de sécurité');
        }
    }

    setVesselStatus(nextStatus);
    setCurrentPos({ lat, lng });
    setCurrentHeading(heading);
    setCurrentSpeed(Math.round(knotSpeed));
    setAccuracy(Math.round(acc));

    handlePositionUpdateRef.current?.(lat, lng, nextStatus);

    updateVesselInFirestore({
        location: { latitude: lat, longitude: lng },
        status: nextStatus,
        speed: Math.round(knotSpeed),
        heading: heading,
        accuracy: Math.round(acc),
        anchorLocation: (nextStatus === 'stationary' || nextStatus === 'drifting' || nextStatus === 'emergency') && anchorPos 
            ? { latitude: anchorPos.lat, longitude: anchorPos.lng } 
            : null
    });
  }, [vesselStatus, anchorPos, mooringRadius, addTechLog, triggerEmergency, updateVesselInFirestore]);

  useEffect(() => {
    if (!simulator?.isActive || !simulator.simPos || !isSharing) return;
    handlePositionLogic(simulator.simPos.lat, simulator.simPos.lng, simulator.simSpeed / 1.94384, 0, simulator.isGpsCut ? 600 : simulator.simAccuracy);
  }, [simulator?.isActive, simulator?.simPos, simulator?.simSpeed, simulator?.simAccuracy, simulator?.isGpsCut, isSharing, handlePositionLogic]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    localStorage.setItem('lb_vessel_nickname', vesselNickname);
    localStorage.setItem('lb_vessel_id', customSharingId.trim().toUpperCase());
    localStorage.setItem('lb_fleet_id', customFleetId.trim().toUpperCase());

    setIsSharing(true);
    addTechLog('DÉMARRAGE', `ID: ${sharingId}`);

    // FORCE IMMEDIATE SYNC FOR INITIAL VISIBILITY
    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude });
        updateVesselInFirestore({
            location: { latitude, longitude },
            status: 'moving',
            isSharing: true
        }, true);
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (simulator?.isActive) return;
        handlePositionLogic(pos.coords.latitude, pos.coords.longitude, pos.coords.speed || 0, pos.coords.heading || 0, pos.coords.accuracy);
      },
      () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, sharingId, customSharingId, customFleetId, vesselNickname, simulator?.isActive, addTechLog, handlePositionLogic, toast, updateVesselInFirestore]);

  const stopSharing = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    
    if (firestore && sharingId) {
      const ref = doc(firestore, 'vessels', sharingId);
      const batch = writeBatch(firestore);
      const tactSnap = await getDocs(collection(firestore, 'vessels', sharingId, 'tactical_logs'));
      tactSnap.forEach(d => batch.delete(d.ref));
      const techSnap = await getDocs(collection(firestore, 'vessels', sharingId, 'tech_logs'));
      techSnap.forEach(d => batch.delete(d.ref));
      
      batch.set(ref, { 
        isSharing: false, 
        lastActive: serverTimestamp(),
        anchorLocation: null,
        status: 'offline',
        historyClearedAt: serverTimestamp()
      }, { merge: true });
      await batch.commit();
    }
    
    setCurrentPos(null);
    setAnchorPos(null);
    setTechLogs([]);
    setTacticalLogs([]);
    lastSentStatusRef.current = null;
    handleStopCleanupRef.current?.(); 
    toast({ title: "PARTAGE ARRÊTÉ" });
  }, [firestore, sharingId, toast]);

  const clearLogs = useCallback(async () => {
    setTechLogs([]);
    setTacticalLogs([]);
    if (firestore && sharingId) {
        await updateDoc(doc(firestore, 'vessels', sharingId), { historyClearedAt: serverTimestamp(), tacticalClearedAt: serverTimestamp() });
        const batch = writeBatch(firestore);
        const tactSnap = await getDocs(collection(firestore, 'vessels', sharingId, 'tactical_logs'));
        tactSnap.forEach(d => batch.delete(d.ref));
        const techSnap = await getDocs(collection(firestore, 'vessels', sharingId, 'tech_logs'));
        techSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    handleStopCleanupRef.current?.();
    toast({ title: "JOURNAUX PURGÉS" });
  }, [firestore, sharingId, toast]);

  const changeManualStatus = useCallback((st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving') setAnchorPos(null);
    else if (currentPosRef.current) setAnchorPos(currentPosRef.current);

    updateVesselInFirestore({ 
        status: st, 
        eventLabel: label || null,
        anchorLocation: (st === 'stationary' || st === 'drifting') && currentPosRef.current 
            ? { latitude: currentPosRef.current.lat, longitude: currentPosRef.current.lng } 
            : null
    });
    toast({ title: label || `Statut : ${st}` });
  }, [updateVesselInFirestore, toast]);

  const saveSmsSettings = useCallback(async () => {
    localStorage.setItem('lb_emergency_contact', emergencyContact);
    localStorage.setItem('lb_vessel_sms_message', vesselSmsMessage);
    localStorage.setItem('lb_emergency_enabled', String(isEmergencyEnabled));
    if (user && firestore) {
        await updateDoc(doc(firestore, 'users', user.uid), { emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled });
    }
    toast({ title: "Réglages SMS sauvegardés" });
  }, [user, firestore, emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled, toast]);

  const loadFromHistory = useCallback((vId: string, fId: string) => {
    setCustomSharingId(vId);
    setCustomFleetId(fId);
    toast({ title: "ID Chargé" });
  }, [toast]);

  const removeFromHistory = useCallback((vId: string) => {
    setIdsHistory(prev => {
        const newHistory = prev.filter(h => h.vId !== vId);
        localStorage.setItem('lb_ids_history', JSON.stringify(newHistory));
        return newHistory;
    });
  }, []);

  const addTacticalLog = useCallback(async (type: string, photoUrl?: string) => {
    if (!firestore || !sharingId || !currentPos) return;
    const logEntry = { type: type.toUpperCase(), time: new Date(), pos: currentPos, photoUrl: photoUrl || null, vesselName: vesselNickname || sharingId };
    setTacticalLogs(prev => [logEntry, ...prev].slice(0, 50));
    addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
  }, [firestore, sharingId, currentPos, vesselNickname]);

  return useMemo(() => ({
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, setAnchorPos, mooringRadius, setMooringRadius, accuracy, battery,
    vesselNickname, setVesselNickname, customSharingId, setCustomSharingId, customFleetId, setCustomFleetId, sharingId, idsHistory,
    loadFromHistory, removeFromHistory, lastSyncTime, techLogs, tacticalLogs, addTacticalLog,
    emergencyContact, setEmergencyContact, vesselSmsMessage, setVesselSmsMessage, isEmergencyEnabled, setIsEmergencyEnabled,
    isCustomMessageEnabled, setIsCustomMessageEnabled, saveSmsSettings, clearLogs
  }), [
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, mooringRadius, accuracy, battery,
    vesselNickname, customSharingId, customFleetId, sharingId, idsHistory,
    loadFromHistory, removeFromHistory, lastSyncTime, techLogs, tacticalLogs,
    addTacticalLog, emergencyContact, vesselSmsMessage, isEmergencyEnabled,
    isCustomMessageEnabled, saveSmsSettings, clearLogs
  ]);
}
