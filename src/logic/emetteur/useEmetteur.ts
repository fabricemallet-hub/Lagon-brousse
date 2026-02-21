
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import type { VesselStatus, TechLogEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) v73.0 : "Heartbeat & Journal Temporel"
 * Gère le cycle de 30s, le calcul des durées par statut et les alertes critiques.
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

  const [techLogs, setTechLogs] = useState<TechLogEntry[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const lastStatusChangeRef = useRef<Date>(new Date());
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

  /**
   * Ajoute ou met à jour une entrée dans le journal technique.
   * Optimisé pour grouper par statut.
   */
  const addTechLog = useCallback(async (label: string, details?: string, statusOverride?: string) => {
    if (!firestore || !sharingId) return;
    
    const now = new Date();
    const currentStatus = statusOverride || vesselStatus;
    const batteryLevel = Math.round(battery.level * 100);

    setTechLogs(prev => {
        const lastLog = prev[0];
        const statusChanged = !lastLog || lastLog.status !== currentStatus || label === 'URGENCE' || label === 'ALERTE ÉNERGIE';

        if (!statusChanged && label === 'AUTO') {
            // Mise à jour de la durée sur la ligne existante
            const duration = differenceInMinutes(now, lastLog.time);
            const updatedLog = {
                ...lastLog,
                durationMinutes: duration,
                details: `Actif depuis ${duration} min`,
                batteryLevel,
                accuracy: accuracy
            };
            return [updatedLog, ...prev.slice(1)];
        }

        // Nouvelle ligne
        const logEntry: TechLogEntry = {
            label: label.toUpperCase(),
            details: details || '',
            time: now,
            pos: currentPosRef.current,
            status: currentStatus,
            batteryLevel,
            accuracy: accuracy,
            durationMinutes: 0
        };
        
        addDoc(collection(firestore, 'vessels', sharingId, 'tech_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
        return [logEntry, ...prev].slice(0, 50);
    });
  }, [firestore, sharingId, vesselStatus, battery, accuracy]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>, force = false) => {
    if (!user || !firestore || (!isSharing && !force)) return;
    if (simulator?.isComCut) return; 
    
    const batteryLevel = Math.round(battery.level * 100);
    const isCharging = battery.charging;

    // Alerte batterie critique (Seul le premier passage sous 10% déclenche le log)
    if (batteryLevel < 10 && !isBatteryAlertSentRef.current) {
        isBatteryAlertSentRef.current = true;
        addTechLog('ALERTE ÉNERGIE', `Batterie critique: ${batteryLevel}%`, 'emergency');
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

    const statusChanged = lastSentStatusRef.current !== (data.status || vesselStatus);

    const payload: any = {
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

    if (statusChanged) {
        payload.statusChangedAt = serverTimestamp();
        lastSentStatusRef.current = data.status || vesselStatus;
        lastStatusChangeRef.current = new Date();
    }

    return setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => {
          setLastSyncTime(Date.now());
      })
      .catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, customFleetId, mooringRadius, simulator?.isComCut, addTechLog, battery, vesselStatus]);

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE' | 'DÉRIVE') => {
    if (!isSharing) return;
    setVesselStatus('emergency');
    updateVesselInFirestore({ status: 'emergency', eventLabel: type });
    addTechLog('URGENCE', `${type} DÉCLENCHÉ`, 'emergency');
    
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
            addTechLog('CHGT STATUT', 'Navigation détectée (>5 nds)');
        }
    } 
    else if (knotSpeed < 2 && (vesselStatus === 'moving' || vesselStatus === 'drifting')) {
        nextStatus = 'stationary';
        setAnchorPos({ lat, lng });
        addTechLog('CHGT STATUT', 'Mouillage stabilisé (<2 nds)');
    }

    if ((nextStatus === 'stationary' || nextStatus === 'drifting') && anchorPos) {
        const dist = getDistance(lat, lng, anchorPos.lat, anchorPos.lng);
        if (dist > mooringRadius) {
            if (acc <= 25) {
                if (vesselStatus !== 'drifting' && vesselStatus !== 'emergency') {
                    nextStatus = 'drifting';
                    addTechLog('DÉRIVE', 'HORS ZONE DE SÉCURITÉ');
                } else {
                    nextStatus = 'drifting';
                }
            }
        } else if (nextStatus === 'drifting') {
            nextStatus = 'stationary';
            addTechLog('CHGT STATUT', 'Retour en zone de sécurité');
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
  }, [vesselStatus, anchorPos, mooringRadius, addTechLog, updateVesselInFirestore]);

  // CYCLE DE MISE À JOUR 30S (Heartbeat)
  useEffect(() => {
    if (isSharing) {
        heartbeatIntervalRef.current = setInterval(() => {
            addTechLog('AUTO', 'Heartbeat 30s');
            updateVesselInFirestore({});
        }, 30000);
    } else {
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    }
    return () => { if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current); };
  }, [isSharing, addTechLog, updateVesselInFirestore]);

  useEffect(() => {
    if (!simulator?.isActive || !simulator.simPos || !isSharing) return;
    handlePositionLogic(simulator.simPos.lat, simulator.simPos.lng, simulator.simSpeed / 1.94384, 0, simulator.isGpsCut ? 600 : simulator.simAccuracy);
  }, [simulator?.isActive, simulator?.simPos, simulator?.simSpeed, simulator?.simAccuracy, simulator?.isGpsCut, isSharing, handlePositionLogic]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    setIsSharing(true);
    addTechLog('LANCEMENT', 'Initialisation en cours...');

    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude });
        handlePositionLogic(latitude, longitude, pos.coords.speed || 0, pos.coords.heading || 0, pos.coords.accuracy);
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (simulator?.isActive) return;
        handlePositionLogic(pos.coords.latitude, pos.coords.longitude, pos.coords.speed || 0, pos.coords.heading || 0, pos.coords.accuracy);
      },
      () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, simulator?.isActive, addTechLog, handlePositionLogic, toast]);

  const stopSharing = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    
    if (firestore && sharingId) {
      addTechLog('ARRÊT', 'Le navire a quitté le groupe', 'offline');
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
        eventLabel: 'LE NAVIRE A QUITTÉ LE GROUPE',
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
  }, [firestore, sharingId, toast, addTechLog]);

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
    addTechLog('CHGT MANUEL', label || st.toUpperCase());
    toast({ title: label || `Statut : ${st}` });
  }, [updateVesselInFirestore, toast, addTechLog]);

  return useMemo(() => ({
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, setAnchorPos, mooringRadius, setMooringRadius, accuracy, battery,
    vesselNickname, setVesselNickname, customSharingId, setCustomSharingId, customFleetId, setCustomFleetId, sharingId, idsHistory,
    lastSyncTime, techLogs, tacticalLogs, addTacticalLog: async (type: string) => {
        if (!firestore || !sharingId || !currentPosRef.current) return;
        const logEntry = { type: type.toUpperCase(), time: new Date(), pos: currentPosRef.current, vesselName: vesselNickname || sharingId };
        setTacticalLogs(prev => [logEntry, ...prev].slice(0, 50));
        addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
    },
    emergencyContact, setEmergencyContact, vesselSmsMessage, setVesselSmsMessage, isEmergencyEnabled, setIsEmergencyEnabled,
    isCustomMessageEnabled, setIsCustomMessageEnabled, saveSmsSettings: async () => {
        if (user && firestore) await updateDoc(doc(firestore, 'users', user.uid), { emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled });
        toast({ title: "Réglages SMS sauvegardés" });
    }, clearLogs
  }), [
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, mooringRadius, accuracy, battery,
    vesselNickname, customSharingId, customFleetId, sharingId, idsHistory,
    lastSyncTime, techLogs, tacticalLogs, emergencyContact, vesselSmsMessage, isEmergencyEnabled,
    isCustomMessageEnabled, toast, user, firestore, clearLogs
  ]);
}
