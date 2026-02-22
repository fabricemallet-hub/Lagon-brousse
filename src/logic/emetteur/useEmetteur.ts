'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDocs, writeBatch, Timestamp, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import type { VesselStatus, TechLogEntry, UserAccount, FleetEntry } from '@/lib/types';
import { format, differenceInMinutes, subMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDistance } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// CONSTANTES DE VITESSE
const THRESHOLD_DRIFT = 0.2; // ND
const THRESHOLD_MOVEMENT = 2.0; // ND

/**
 * LOGIQUE ÉMETTEUR (A) v106.0 : Identité, Partage et Gestion des Flottes.
 */
export function useEmetteur(
    handlePositionUpdate?: (lat: number, lng: number, status: string) => void, 
    handleStopCleanup?: () => void,
    simulator?: any,
    userProfile?: UserAccount | null
) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSharing, setIsSharing = useState(false);
  const [currentPos, setCurrentPos = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos = useState<{ lat: number, lng: number } | null>(null);
  const [mooringRadius, setMooringRadius = useState<number>(100);
  const [accuracy, setAccuracy = useState<number>(0);
  const [currentHeading, setCurrentHeading = useState<number>(0);
  const [currentSpeed, setCurrentSpeed = useState<number>(0);
  
  const [smoothedDistance, setSmoothedDistance = useState<number | null>(null);
  const distanceHistoryRef = useRef<number[]>([]);
  const speedConsecutiveHitsRef = useRef<number>(0);
  
  const lastStatusChangeTimeRef = useRef<number>(0);
  
  const [vesselNickname, setVesselNickname = useState('');
  const [customSharingId, setCustomSharingId = useState('');
  const [customFleetId, setCustomFleetId = useState('');
  const [fleetComment, setFleetComment = useState('');
  const [lastSyncTime, setLastSyncTime = useState<number>(0);

  const [isGhostMode, setIsGhostMode = useState(false);
  const [isTrajectoryHidden, setIsTrajectoryHidden = useState(false);

  const [battery, setBattery = useState<{ level: number, charging: boolean }>({ level: 1, charging: false });

  const [emergencyContact, setEmergencyContact = useState('');
  const [vesselSmsMessage, setVesselSmsMessage = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled = useState(true);

  const [techLogs, setTechLogs = useState<TechLogEntry[]>([]);
  
  const vesselStatusRef = useRef<VesselStatus['status']>('moving');
  const currentPosRef = useRef(currentPos);
  const anchorPosRef = useRef(anchorPos);
  const mooringRadiusRef = useRef(mooringRadius);
  const batteryRef = useRef(battery);
  const isSharingRef = useRef(isSharing);
  const isGhostModeRef = useRef(isGhostMode);
  const isTrajectoryHiddenRef = useRef(isTrajectoryHidden);
  const lastFirestoreSyncRef = useRef<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  
  const handlePositionUpdateRef = useRef(handlePositionUpdate);
  useEffect(() => { handlePositionUpdateRef.current = handlePositionUpdate; }, [handlePositionUpdate]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  // Synchronisation des refs
  useEffect(() => { mooringRadiusRef.current = mooringRadius; }, [mooringRadius]);
  useEffect(() => { isGhostModeRef.current = isGhostMode; }, [isGhostMode]);
  useEffect(() => { isTrajectoryHiddenRef.current = isTrajectoryHidden; }, [isTrajectoryHidden]);

  const addTechLog = useCallback(async (label: string, details?: string, statusOverride?: string) => {
    if (!firestore || !sharingId) return;
    const now = simulator?.timeOffset ? subMinutes(new Date(), simulator.timeOffset) : new Date();
    const currentStatus = statusOverride || vesselStatusRef.current;
    const batteryLevel = Math.round(batteryRef.current.level * 100);

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

    setTechLogs(prev => [logEntry, ...prev].slice(0, 50));
  }, [firestore, sharingId, accuracy, simulator?.timeOffset]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>, force = false) => {
    if (!user || !firestore || (!isSharingRef.current && !force) || (simulator?.isComCut && !force)) return;
    
    const nowTs = Date.now();
    if (simulator?.isActive && !force && nowTs - lastFirestoreSyncRef.current < 5000) return;
    lastFirestoreSyncRef.current = nowTs;

    const batteryLevel = Math.round(batteryRef.current.level * 100);
    const effectiveNow = simulator?.timeOffset ? subMinutes(new Date(), simulator.timeOffset) : new Date();
    const firestoreTimestamp = Timestamp.fromDate(effectiveNow);
    const currentActualStatus = data.status || vesselStatusRef.current;

    const payload: any = {
      ...data,
      id: sharingId,
      userId: user.uid,
      displayName: vesselNickname || user.displayName || 'Capitaine',
      isSharing: force ? true : isSharingRef.current,
      lastActive: firestoreTimestamp,
      fleetId: customFleetId.trim().toUpperCase() || null,
      eventLabel: fleetComment.trim() || null,
      mooringRadius: mooringRadiusRef.current,
      batteryLevel,
      isCharging: batteryRef.current.charging,
      isGhostMode: isGhostModeRef.current,
      isTrajectoryHidden: isTrajectoryHiddenRef.current,
      accuracy: accuracy
    };

    if (lastSentStatusRef.current !== currentActualStatus) {
        payload.statusChangedAt = firestoreTimestamp;
        lastSentStatusRef.current = currentActualStatus;
    }

    return setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true }).then(() => setLastSyncTime(Date.now()));
  }, [user, firestore, sharingId, vesselNickname, customFleetId, fleetComment, simulator?.isComCut, simulator?.isActive, simulator?.timeOffset, accuracy]);

  const handlePositionLogic = useCallback((lat: number, lng: number, speed: number, heading: number, acc: number) => {
    let nextStatus = vesselStatusRef.current;
    const isSimActive = !!simulator?.isActive;
    const now = Date.now();

    if (speed < THRESHOLD_DRIFT) {
        speedConsecutiveHitsRef.current = 0;
        if (nextStatus !== 'stationary') {
            nextStatus = 'stationary';
            setAnchorPos({ lat, lng });
            anchorPosRef.current = { lat, lng };
            addTechLog('CHGT STATUT', 'Immobilisation (MOUILLAGE)');
        }
    } else {
        speedConsecutiveHitsRef.current += 1;
        if (speedConsecutiveHitsRef.current >= 3) {
            if (speed >= THRESHOLD_MOVEMENT) {
                if (nextStatus !== 'moving') {
                    nextStatus = 'moving';
                    setAnchorPos(null);
                    anchorPosRef.current = null;
                    addTechLog('CHGT STATUT', 'Navigation (MOUVEMENT)');
                }
            } else if (speed >= THRESHOLD_DRIFT) {
                if (!anchorPosRef.current) {
                    setAnchorPos({ lat, lng });
                    anchorPosRef.current = { lat, lng };
                }
                const dist = getDistance(lat, lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
                if (dist > mooringRadiusRef.current) {
                    if (acc <= 25 || isSimActive) {
                        if (nextStatus !== 'drifting') {
                            nextStatus = 'drifting';
                            addTechLog(isSimActive ? 'LABO' : 'DÉRIVE', 'HORS ZONE');
                        }
                    }
                } else if (nextStatus === 'drifting') {
                    nextStatus = 'stationary';
                    addTechLog('CHGT STATUT', 'Retour en zone');
                }
            }
        }
    }

    if (nextStatus !== vesselStatusRef.current) {
        if (now - lastStatusChangeTimeRef.current < 500) {
            nextStatus = vesselStatusRef.current;
        } else {
            lastStatusChangeTimeRef.current = now;
        }
    }

    if (isSimActive && !anchorPosRef.current) {
        setAnchorPos({ lat, lng });
        anchorPosRef.current = { lat, lng };
    }

    if (anchorPosRef.current) {
        const rawDist = getDistance(lat, lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
        distanceHistoryRef.current = [...distanceHistoryRef.current, rawDist].slice(-3);
        setSmoothedDistance(Math.round(distanceHistoryRef.current.reduce((a, b) => a + b, 0) / distanceHistoryRef.current.length));
    } else {
        setSmoothedDistance(null);
    }

    vesselStatusRef.current = nextStatus;
    setVesselStatus(nextStatus);
    setCurrentPos({ lat, lng });
    setCurrentHeading(heading);
    setCurrentSpeed(speed);
    setAccuracy(Math.round(acc));

    handlePositionUpdateRef.current?.(lat, lng, nextStatus);

    updateVesselInFirestore({
        location: { latitude: lat, longitude: lng },
        status: nextStatus,
        speed: speed,
        heading: heading,
        accuracy: Math.round(acc),
        anchorLocation: (nextStatus === 'stationary' || nextStatus === 'drifting' || nextStatus === 'emergency') && anchorPosRef.current 
            ? { latitude: anchorPosRef.current.lat, longitude: anchorPosRef.current.lng } 
            : null
    });
  }, [addTechLog, updateVesselInFirestore, simulator?.isActive]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation || !user || !firestore) return;
    setIsSharing(true);
    isSharingRef.current = true;
    addTechLog('LANCEMENT', 'Initialisation...');

    // ENREGISTREMENT FLOTTE DANS FAVORIS v106.0
    if (customFleetId.trim()) {
        const fleetId = customFleetId.trim().toUpperCase();
        const entry: FleetEntry = { id: fleetId, comment: fleetComment };
        updateDoc(doc(firestore, 'users', user.uid), {
            savedFleets: arrayUnion(entry),
            lastFleetId: fleetId
        }).catch(() => {});
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (simulator?.isActive) return;
        handlePositionLogic(pos.coords.latitude, pos.coords.longitude, (pos.coords.speed || 0) * 1.94384, pos.coords.heading || 0, pos.coords.accuracy);
      },
      () => { if (!simulator?.isActive) toast({ variant: 'destructive', title: "Signal GPS perdu" }); },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, simulator?.isActive, addTechLog, handlePositionLogic, toast, customFleetId, fleetComment]);

  const stopSharing = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    isSharingRef.current = false;
    if (firestore && sharingId) {
      addTechLog('ARRÊT', 'Le navire a quitté le groupe', 'offline');
      updateVesselInFirestore({ isSharing: false, status: 'offline', anchorLocation: null }, true);
    }
    setCurrentPos(null);
    setAnchorPos(null);
    setSmoothedDistance(null);
    distanceHistoryRef.current = [];
    toast({ title: "PARTAGE ARRÊTÉ" });
  }, [firestore, sharingId, toast, addTechLog, updateVesselInFirestore]);

  const removeFleet = async (fleet: FleetEntry) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedFleets: arrayRemove(fleet)
        });
        toast({ title: "Flotte retirée" });
    } catch (e) { toast({ variant: 'destructive', title: "Erreur" }); }
  };

  return useMemo(() => ({
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    anchorPos, mooringRadius, setMooringRadius, accuracy, battery, smoothedDistance,
    vesselNickname, setVesselNickname, customSharingId, setCustomSharingId, customFleetId, setCustomFleetId, 
    fleetComment, setFleetComment, sharingId,
    lastSyncTime, techLogs, 
    emergencyContact, setEmergencyContact, vesselSmsMessage, setVesselSmsMessage, isEmergencyEnabled, setIsEmergencyEnabled,
    isCustomMessageEnabled, setIsCustomMessageEnabled, clearLogs: () => setTechLogs([]),
    isGhostMode, 
    toggleGhostMode: () => {
        const next = !isGhostMode;
        setIsGhostMode(next);
        isGhostModeRef.current = next;
        updateVesselInFirestore({ isGhostMode: next });
    },
    isTrajectoryHidden, 
    toggleTrajectoryHidden: () => {
        const next = !isTrajectoryHidden;
        setIsTrajectoryHidden(next);
        isTrajectoryHiddenRef.current = next;
        updateVesselInFirestore({ isTrajectoryHidden: next });
    },
    resetTrajectory: () => { 
        setAnchorPos(null); 
        anchorPosRef.current = null;
        updateVesselInFirestore({ anchorLocation: null }, true); 
    },
    addTechLog,
    removeFleet,
    savedFleets: userProfile?.savedFleets || [],
    changeManualStatus: (st: VesselStatus['status']) => {
        setVesselStatus(st); vesselStatusRef.current = st;
        updateVesselInFirestore({ status: st });
        addTechLog('CHGT MANUEL', st.toUpperCase());
    },
    triggerEmergency: (type: string) => {
        if (!emergencyContact) return;
        setVesselStatus('emergency'); updateVesselInFirestore({ status: 'emergency', eventLabel: type }, true);
        addTechLog('URGENCE', type);
    },
    saveMooringRadius: async () => {
        if (!user || !firestore) return;
        updateDoc(doc(firestore, 'users', user.uid), { 'vesselPrefs.mooringRadius': mooringRadiusRef.current });
        toast({ title: "Rayon par défaut enregistré" });
    }
  }), [
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    anchorPos, mooringRadius, setMooringRadius, accuracy, battery, smoothedDistance,
    vesselNickname, customSharingId, customFleetId, fleetComment, sharingId,
    lastSyncTime, techLogs, emergencyContact, vesselSmsMessage, isEmergencyEnabled,
    isCustomMessageEnabled, toast, user, firestore, isGhostMode, isTrajectoryHidden, updateVesselInFirestore,
    userProfile?.savedFleets, addTechLog
  ]);
}
