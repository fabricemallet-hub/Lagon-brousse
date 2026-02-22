
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import type { VesselStatus, TechLogEntry, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMinutes, subMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) v80.0 : "Sandbox & Injection Temporelle Firestore"
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
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  const [isGhostMode, setIsGhostMode] = useState(false);
  const [isTrajectoryHidden, setIsTrajectoryHidden] = useState(false);

  const [battery, setBattery] = useState<{ level: number, charging: boolean }>({ level: 1, charging: false });

  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [techLogs, setTechLogs] = useState<TechLogEntry[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const currentPosRef = useRef(currentPos);
  const anchorPosRef = useRef(anchorPos);
  const mooringRadiusRef = useRef(mooringRadius);
  const batteryRef = useRef(battery);
  const isSharingRef = useRef(isSharing);
  const isGhostModeRef = useRef(isGhostMode);
  const isTrajectoryHiddenRef = useRef(isTrajectoryHidden);

  useEffect(() => { vesselStatusRef.current = vesselStatus; }, [vesselStatus]);
  useEffect(() => { currentPosRef.current = currentPos; }, [currentPos]);
  useEffect(() => { anchorPosRef.current = anchorPos; }, [anchorPos]);
  useEffect(() => { mooringRadiusRef.current = mooringRadius; }, [mooringRadius]);
  useEffect(() => { batteryRef.current = battery; }, [battery]);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);
  useEffect(() => { isGhostModeRef.current = isGhostMode; }, [isGhostMode]);
  useEffect(() => { isTrajectoryHiddenRef.current = isTrajectoryHidden; }, [isTrajectoryHidden]);

  const watchIdRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const isBatteryAlertSentRef = useRef<boolean>(false);
  const lastHeartbeatPosRef = useRef<{ lat: number, lng: number } | null>(null);
  
  const handlePositionUpdateRef = useRef(handlePositionUpdate);
  const handleStopCleanupRef = useRef(handleStopCleanup);
  useEffect(() => { handlePositionUpdateRef.current = handlePositionUpdate; }, [handlePositionUpdate]);
  useEffect(() => { handleStopCleanupRef.current = handleStopCleanup; }, [handleStopCleanup]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  // ÉCOUTEUR BATTERIE (Réel vs Simulé)
  useEffect(() => {
    if (simulator?.isActive) {
        setBattery({ level: simulator.simBattery / 100, charging: false });
        return;
    }

    if (typeof window === 'undefined' || !('getBattery' in navigator)) return;
    let batteryObj: any = null;
    const updateBatteryState = () => { if (batteryObj) setBattery({ level: batteryObj.level, charging: batteryObj.charging }); };
    (navigator as any).getBattery().then((b: any) => {
      batteryObj = b; updateBatteryState();
      b.addEventListener('levelchange', updateBatteryState);
      b.addEventListener('chargingchange', updateBatteryState);
    });
    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', updateBatteryState);
        batteryObj.removeEventListener('chargingchange', updateBatteryState);
      }
    };
  }, [simulator?.isActive, simulator?.simBattery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNickname = localStorage.getItem('lb_vessel_nickname');
      const savedVesselId = localStorage.getItem('lb_vessel_id');
      const savedFleetId = localStorage.getItem('lb_fleet_id');
      const savedStatus = localStorage.getItem('lb_vessel_status') as VesselStatus['status'];
      const savedRadius = localStorage.getItem('lb_mooring_radius');
      const savedEmergencyContact = localStorage.getItem('lb_emergency_contact');
      const savedSmsMessage = localStorage.getItem('lb_vessel_sms_message');
      const savedEmergencyEnabled = localStorage.getItem('lb_emergency_enabled');
      const savedGhost = localStorage.getItem('lb_vessel_ghost');
      const savedTrajHidden = localStorage.getItem('lb_vessel_traj_hidden');

      if (savedNickname) setVesselNickname(savedNickname);
      if (savedVesselId) setCustomSharingId(savedVesselId);
      if (savedFleetId) setCustomFleetId(savedFleetId);
      if (savedStatus) { setVesselStatus(savedStatus); vesselStatusRef.current = savedStatus; }
      if (savedRadius) setMooringRadius(parseInt(savedRadius));
      if (savedEmergencyContact) setEmergencyContact(savedEmergencyContact);
      if (savedSmsMessage) setVesselSmsMessage(savedSmsMessage);
      if (savedEmergencyEnabled !== null) setIsEmergencyEnabled(savedEmergencyEnabled === 'true');
      if (savedGhost === 'true') setIsGhostMode(true);
      if (savedTrajHidden === 'true') setIsTrajectoryHidden(true);
    }
  }, []);

  const addTechLog = useCallback(async (label: string, details?: string, statusOverride?: string) => {
    if (!firestore || !sharingId) return;
    
    // Application du décalage simulateur
    const now = simulator?.timeOffset ? subMinutes(new Date(), simulator.timeOffset) : new Date();
    const currentStatus = statusOverride || vesselStatusRef.current;
    const batteryLevel = Math.round(batteryRef.current.level * 100);

    setTechLogs(prev => {
        const lastLog = prev[0];
        const statusChanged = !lastLog || lastLog.status !== currentStatus || label === 'URGENCE' || label === 'ALERTE ÉNERGIE' || label === 'MOUILLAGE AUTO' || label === 'RESET' || label === 'LABO' || label === 'SANDBOX';

        if (!statusChanged && label === 'AUTO') {
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
        
        addDoc(collection(firestore, 'vessels', sharingId, 'tech_logs'), { ...logEntry, time: Timestamp.fromDate(now) }).catch(() => {});
        return [logEntry, ...prev].slice(0, 50);
    });
  }, [firestore, sharingId, accuracy, simulator?.timeOffset]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>, force = false) => {
    if (!user || !firestore) return;
    if (!isSharingRef.current && !force) return;
    if (simulator?.isComCut && !force) return; // RÈGLE v80.0 : On bloque les écritures vers Firestore
    
    const batteryLevel = Math.round(batteryRef.current.level * 100);
    const isCharging = batteryRef.current.charging;

    // Simulation Temporelle v80.0
    const effectiveNow = simulator?.timeOffset ? subMinutes(new Date(), simulator.timeOffset) : new Date();
    const firestoreTimestamp = Timestamp.fromDate(effectiveNow);

    if (batteryLevel < 10 && !isBatteryAlertSentRef.current) {
        isBatteryAlertSentRef.current = true;
        addTechLog('ALERTE ÉNERGIE', `Batterie critique: ${batteryLevel}%`, 'emergency');
        if (currentPosRef.current) {
            updateDoc(doc(firestore, 'vessels', sharingId), {
                lastSafePos: {
                    latitude: currentPosRef.current.lat,
                    longitude: currentPosRef.current.lng,
                    timestamp: firestoreTimestamp
                }
            }).catch(() => {});
        }
    } else if (batteryLevel >= 10) {
        isBatteryAlertSentRef.current = false;
    }

    const currentActualStatus = data.status || vesselStatusRef.current;
    const statusChanged = lastSentStatusRef.current !== currentActualStatus;

    const payload: any = {
      ...data,
      id: sharingId,
      userId: user.uid,
      displayName: vesselNickname || user.displayName || 'Capitaine',
      isSharing: force ? true : isSharingRef.current,
      lastActive: firestoreTimestamp,
      fleetId: customFleetId.trim().toUpperCase() || null,
      mooringRadius: mooringRadiusRef.current,
      batteryLevel,
      isCharging,
      isGhostMode: isGhostModeRef.current,
      isTrajectoryHidden: isTrajectoryHiddenRef.current
    };

    if (statusChanged) {
        payload.statusChangedAt = firestoreTimestamp;
        lastSentStatusRef.current = currentActualStatus;
    }

    return setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => setLastSyncTime(Date.now()))
      .catch(() => {});
  }, [user, firestore, sharingId, vesselNickname, customFleetId, simulator?.isComCut, simulator?.timeOffset, addTechLog]);

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE' | 'DÉRIVE') => {
    if (!isSharingRef.current) return;
    vesselStatusRef.current = 'emergency';
    setVesselStatus('emergency');
    updateVesselInFirestore({ status: 'emergency', eventLabel: type });
    addTechLog('URGENCE', `${type} DÉCLENCHÉ`, 'emergency');
    
    if (isEmergencyEnabled && emergencyContact) {
        const body = `[${(vesselNickname || 'KOOLAPIK').toUpperCase()}] ${isCustomMessageEnabled && vesselSmsMessage ? vesselSmsMessage : "Requiert assistance immédiate."} [${type}] à ${format(new Date(), 'HH:mm')}. Position : https://www.google.com/maps?q=${currentPosRef.current?.lat.toFixed(6)},${currentPosRef.current?.lng.toFixed(6)}`;
        window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    }
    toast({ variant: "destructive", title: `ALERTE ${type}` });
  }, [updateVesselInFirestore, addTechLog, isEmergencyEnabled, emergencyContact, vesselNickname, isCustomMessageEnabled, vesselSmsMessage, toast]);

  const handlePositionLogic = useCallback((lat: number, lng: number, speed: number, heading: number, acc: number) => {
    const knotSpeed = speed;
    let nextStatus = vesselStatusRef.current;

    if (knotSpeed > 5) {
        if (nextStatus !== 'moving') {
            nextStatus = 'moving';
            setAnchorPos(null);
            addTechLog('CHGT STATUT', 'Navigation détectée (>5 nds)');
        }
    } 
    else if (knotSpeed < 2 && (nextStatus === 'moving' || nextStatus === 'drifting')) {
        nextStatus = 'stationary';
        setAnchorPos({ lat, lng });
        addTechLog('CHGT STATUT', 'Mouillage stabilisé (<2 nds)');
    }

    if ((nextStatus === 'stationary' || nextStatus === 'drifting') && anchorPosRef.current) {
        const dist = getDistance(lat, lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
        if (dist > mooringRadiusRef.current) {
            if (acc <= 25) {
                if (nextStatus !== 'drifting' && nextStatus !== 'emergency') {
                    nextStatus = 'drifting';
                    addTechLog('DÉRIVE', 'HORS ZONE DE SÉCURITÉ');
                }
            }
        } else if (nextStatus === 'drifting') {
            nextStatus = 'stationary';
            addTechLog('CHGT STATUT', 'Retour en zone de sécurité');
        }
    }

    vesselStatusRef.current = nextStatus;
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
        anchorLocation: (nextStatus === 'stationary' || nextStatus === 'drifting' || nextStatus === 'emergency') && anchorPosRef.current 
            ? { latitude: anchorPosRef.current.lat, longitude: anchorPosRef.current.lng } 
            : null
    });
  }, [addTechLog, updateVesselInFirestore]);

  // ÉCOUTEUR POSITION SIMULÉE
  useEffect(() => {
    if (simulator?.isActive && simulator?.simPos) {
        handlePositionLogic(
            simulator.simPos.lat, 
            simulator.simPos.lng, 
            simulator.simSpeed, 
            simulator.simBearing || 0, 
            simulator.simAccuracy
        );
    }
  }, [simulator?.isActive, simulator?.simPos, simulator?.simSpeed, simulator?.simAccuracy, simulator?.simBearing, handlePositionLogic]);

  useEffect(() => {
    if (isSharing) {
        heartbeatIntervalRef.current = setInterval(() => {
            const nowPos = currentPosRef.current;
            const lastPos = lastHeartbeatPosRef.current;
            const currentStatus = vesselStatusRef.current;
            
            if (nowPos && lastPos && currentStatus === 'moving' && !simulator?.isActive) {
                const dist = getDistance(nowPos.lat, nowPos.lng, lastPos.lat, lastPos.lng);
                if (dist < mooringRadiusRef.current) {
                    vesselStatusRef.current = 'stationary';
                    setVesselStatus('stationary');
                    setAnchorPos(nowPos);
                    addTechLog('MOUILLAGE AUTO', 'Détecté par stabilité GPS (30s)');
                    updateVesselInFirestore({ status: 'stationary', anchorLocation: { latitude: nowPos.lat, longitude: nowPos.lng } });
                }
            }

            lastHeartbeatPosRef.current = nowPos;
            addTechLog('AUTO', 'Heartbeat 30s');
            updateVesselInFirestore({});
        }, 30000);
    } else {
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    }
    return () => { if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current); };
  }, [isSharing, addTechLog, updateVesselInFirestore, simulator?.isActive]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    setIsSharing(true);
    isSharingRef.current = true;
    addTechLog('LANCEMENT', 'Initialisation en cours...');

    navigator.geolocation.getCurrentPosition((pos) => {
        if (simulator?.isActive) return;
        const { latitude, longitude } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude });
        lastHeartbeatPosRef.current = { lat: latitude, lng: longitude };
        
        updateVesselInFirestore({
            location: { latitude: longitude },
            status: 'moving',
            accuracy: Math.round(pos.coords.accuracy),
            speed: Math.round((pos.coords.speed || 0) * 1.94384),
            heading: pos.coords.heading || 0
        }, true);

        handlePositionLogic(latitude, longitude, (pos.coords.speed || 0) * 1.94384, pos.coords.heading || 0, pos.coords.accuracy);
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (simulator?.isActive) return;
        handlePositionLogic(pos.coords.latitude, pos.coords.longitude, (pos.coords.speed || 0) * 1.94384, pos.coords.heading || 0, pos.coords.accuracy);
      },
      () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, simulator?.isActive, addTechLog, handlePositionLogic, updateVesselInFirestore, toast]);

  const stopSharing = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    isSharingRef.current = false;
    
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
    lastHeartbeatPosRef.current = null;
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
    vesselStatusRef.current = st;
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

  const toggleGhostMode = useCallback(() => {
    const newVal = !isGhostMode;
    setIsGhostMode(newVal);
    isGhostModeRef.current = newVal;
    localStorage.setItem('lb_vessel_ghost', newVal.toString());
    updateVesselInFirestore({ isGhostMode: newVal });
    toast({ title: newVal ? "Mode Fantôme activé" : "Mode Fantôme désactivé" });
  }, [isGhostMode, updateVesselInFirestore, toast]);

  const toggleTrajectoryHidden = useCallback(() => {
    const newVal = !isTrajectoryHidden;
    setIsTrajectoryHidden(newVal);
    isTrajectoryHiddenRef.current = newVal;
    localStorage.setItem('lb_vessel_traj_hidden', newVal.toString());
    updateVesselInFirestore({ isTrajectoryHidden: newVal });
    toast({ title: newVal ? "Trajectoire masquée" : "Trajectoire affichée" });
  }, [isTrajectoryHidden, updateVesselInFirestore, toast]);

  const resetTrajectory = useCallback(() => {
    handleStopCleanupRef.current?.();
    addTechLog('RESET', 'Purge tracé bleu');
    if (currentPosRef.current) {
        handlePositionUpdateRef.current?.(currentPosRef.current.lat, currentPosRef.current.lng, vesselStatusRef.current);
    }
    toast({ title: "Trajectoire réinitialisée" });
  }, [addTechLog, toast]);

  const forceTimeOffset = useCallback((minutes: number) => {
    if (!simulator) return;
    simulator.setTimeOffset(minutes);
    addTechLog('LABO', `Injection temporelle: +${minutes} min`);
    
    // v80.0 : On force une mise à jour Firestore immédiate avec le nouveau décalage
    updateVesselInFirestore({}, true);
    
    toast({ title: "Temps forcé", description: `+${minutes} min appliquées sur Firestore` });
  }, [simulator, addTechLog, updateVesselInFirestore, toast]);

  return useMemo(() => ({
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, setAnchorPos, mooringRadius, setMooringRadius, accuracy, battery,
    vesselNickname, setVesselNickname, customSharingId, setCustomSharingId, customFleetId, setCustomFleetId, sharingId,
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
    }, clearLogs,
    isGhostMode, toggleGhostMode, isTrajectoryHidden, toggleTrajectoryHidden, resetTrajectory,
    forceTimeOffset
  }), [
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, mooringRadius, accuracy, battery,
    vesselNickname, customSharingId, customFleetId, sharingId,
    lastSyncTime, techLogs, tacticalLogs, emergencyContact, vesselSmsMessage, isEmergencyEnabled,
    isCustomMessageEnabled, toast, user, firestore, clearLogs,
    isGhostMode, toggleGhostMode, isTrajectoryHidden, toggleTrajectoryHidden, resetTrajectory,
    forceTimeOffset
  ]);
}
