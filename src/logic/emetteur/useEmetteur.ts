
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDocs, writeBatch, Timestamp, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import type { VesselStatus, TechLogEntry, UserAccount, FleetEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMinutes, subMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) v93.0 : Localisation FR et gestion des Purges.
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

  const [isSharing, setIsSharing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [mooringRadius, _setMooringRadius] = useState(100);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  
  const [smoothedDistance, setSmoothedDistance] = useState<number | null>(null);
  const distanceHistoryRef = useRef<number[]>([]);
  
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [fleetComment, setFleetComment] = useState('');
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
  const lastFirestoreSyncRef = useRef<number>(0);

  const driftCheckLockedUntilRef = useRef<number>(0);
  const prevSimPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const immobilityStartTime = useRef<number | null>(null);

  useEffect(() => { vesselStatusRef.current = vesselStatus; }, [vesselStatus]);
  useEffect(() => { currentPosRef.current = currentPos; }, [currentPos]);
  useEffect(() => { anchorPosRef.current = anchorPos; }, [anchorPos]);
  useEffect(() => { mooringRadiusRef.current = mooringRadius; }, [mooringRadius]);
  useEffect(() => { batteryRef.current = battery; }, [battery]);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);
  useEffect(() => { isGhostModeRef.current = isGhostMode; }, [isGhostMode]);
  useEffect(() => { isTrajectoryHiddenRef.current = isTrajectoryHidden; }, [isTrajectoryHidden]);

  const setMooringRadius = useCallback((val: number) => {
    const capped = Math.min(val, 100);
    _setMooringRadius(capped);
    mooringRadiusRef.current = capped;
  }, []);

  useEffect(() => {
    if (userProfile && !vesselNickname) {
      setVesselNickname(userProfile.vesselNickname || userProfile.displayName || '');
      if (userProfile.lastVesselId) setCustomSharingId(userProfile.lastVesselId);
      if (userProfile.lastFleetId) setCustomFleetId(userProfile.lastFleetId);
      
      const lastFleet = userProfile.savedFleets?.find(f => f.id === userProfile.lastFleetId);
      if (lastFleet) setFleetComment(lastFleet.comment);
    }
  }, [userProfile, vesselNickname]);

  useEffect(() => {
    if (userProfile?.vesselPrefs?.mooringRadius) {
      const radius = Math.min(userProfile.vesselPrefs.mooringRadius, 100);
      setMooringRadius(radius);
    }
  }, [userProfile, setMooringRadius]);

  const watchIdRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  
  const handlePositionUpdateRef = useRef(handlePositionUpdate);
  const handleStopCleanupRef = useRef(handleStopCleanup);
  useEffect(() => { handlePositionUpdateRef.current = handlePositionUpdate; }, [handlePositionUpdate]);
  useEffect(() => { handleStopCleanupRef.current = handleStopCleanup; }, [handleStopCleanup]);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const addTechLog = useCallback(async (label: string, details?: string, statusOverride?: string) => {
    if (!firestore || !sharingId) return;
    
    const now = simulator?.timeOffset ? subMinutes(new Date(), simulator.timeOffset) : new Date();
    const currentStatus = statusOverride || vesselStatusRef.current;
    const batteryLevel = Math.round(batteryRef.current.level * 100);

    setTechLogs(prev => {
        const lastLog = prev[0];
        const statusChanged = !lastLog || lastLog.status !== currentStatus || label === 'URGENCE' || label === 'ALERTE ÉNERGIE' || label === 'MOUILLAGE AUTO' || label === 'RESET' || label === 'LABO' || label === 'PURGE' || label === 'SANDBOX' || label === 'CHGT STATUT' || label === 'CHGT MANUEL' || label === 'SIGNAL';

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
    if (simulator?.isComCut && !force) return; 
    
    const nowTs = Date.now();
    if (simulator?.isActive && !force && nowTs - lastFirestoreSyncRef.current < 5000) {
        return;
    }
    lastFirestoreSyncRef.current = nowTs;

    const batteryLevel = Math.round(batteryRef.current.level * 100);
    const isCharging = batteryRef.current.charging;

    const effectiveNow = simulator?.timeOffset ? subMinutes(new Date(), simulator.timeOffset) : new Date();
    const firestoreTimestamp = Timestamp.fromDate(effectiveNow);

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
      isTrajectoryHidden: isTrajectoryHiddenRef.current,
      accuracy: accuracy
    };

    if (statusChanged) {
        payload.statusChangedAt = firestoreTimestamp;
        lastSentStatusRef.current = currentActualStatus;
    }

    return setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => setLastSyncTime(Date.now()))
      .catch(() => {});
  }, [user, firestore, sharingId, vesselNickname, customFleetId, simulator?.isComCut, simulator?.isActive, simulator?.timeOffset, accuracy]);

  const handlePositionLogic = useCallback((lat: number, lng: number, speed: number, heading: number, acc: number) => {
    const knotSpeed = speed;
    let nextStatus = vesselStatusRef.current;
    
    const isSimActive = !!simulator?.isActive;
    const nowTs = Date.now();
    const isLocked = nowTs < driftCheckLockedUntilRef.current;

    if (isSimActive && knotSpeed < 2) {
        const isNewPoint = !prevSimPosRef.current;
        const isJump = prevSimPosRef.current && getDistance(lat, lng, prevSimPosRef.current.lat, prevSimPosRef.current.lng) > 10;
        
        if (isNewPoint || isJump || !anchorPosRef.current) {
            nextStatus = 'stationary';
            const newAnchor = { lat, lng };
            setAnchorPos(newAnchor);
            anchorPosRef.current = newAnchor;
            driftCheckLockedUntilRef.current = nowTs + 1500;
            distanceHistoryRef.current = [];
            addTechLog('LABO', 'ANCRAGE SIMU FIXÉ');
        }
    }

    if (knotSpeed >= 4) {
        if (nextStatus !== 'moving') {
            nextStatus = 'moving';
            setAnchorPos(null);
            anchorPosRef.current = null;
            distanceHistoryRef.current = [];
            addTechLog('CHGT STATUT', 'Navigation (MOUVEMENT)');
        }
    } 
    else if (knotSpeed < 2 && (nextStatus === 'moving' || nextStatus === 'drifting')) {
        if (!isLocked) {
            nextStatus = 'stationary';
            setAnchorPos({ lat, lng });
            anchorPosRef.current = { lat, lng };
            distanceHistoryRef.current = [];
            addTechLog('CHGT STATUT', 'Mouillage (ARRÊT)');
        }
    }

    if ((nextStatus === 'stationary' || nextStatus === 'drifting') && anchorPosRef.current) {
        const rawDist = getDistance(lat, lng, anchorPosRef.current.lat, anchorPosRef.current.lng);
        distanceHistoryRef.current = [...distanceHistoryRef.current, rawDist].slice(-3);
        const avgDist = distanceHistoryRef.current.reduce((a, b) => a + b, 0) / distanceHistoryRef.current.length;
        setSmoothedDistance(Math.round(avgDist));

        if (!isLocked) {
            if (avgDist > mooringRadiusRef.current) {
                if (acc <= 25 || isSimActive) {
                    if (nextStatus !== 'drifting' && nextStatus !== 'emergency') {
                        nextStatus = 'drifting';
                        addTechLog('DÉRIVE', 'HORS ZONE DE SÉCURITÉ');
                    }
                }
            } else if (nextStatus === 'drifting') {
                nextStatus = 'stationary';
                addTechLog('CHGT STATUT', 'Retour en zone');
            }
        }
    } else {
        setSmoothedDistance(null);
    }

    vesselStatusRef.current = nextStatus;
    setVesselStatus(nextStatus);
    setCurrentPos({ lat, lng });
    prevSimPosRef.current = { lat, lng };
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
  }, [addTechLog, updateVesselInFirestore, simulator?.isActive]);

  useEffect(() => {
    if (simulator?.isActive && simulator?.simPos) {
      handlePositionLogic(
        simulator.simPos.lat,
        simulator.simPos.lng,
        simulator.simSpeed,
        simulator.simBearing,
        simulator.simAccuracy || 5
      );
    }
  }, [simulator?.isActive, simulator?.simPos, simulator?.simSpeed, simulator?.simBearing, simulator?.simAccuracy, handlePositionLogic]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation || !user || !firestore) return;
    setIsSharing(true);
    isSharingRef.current = true;
    addTechLog('LANCEMENT', 'Initialisation...');

    if (!simulator?.isActive) {
        const userRef = doc(firestore, 'users', user.uid);
        const fleetIdClean = customFleetId.trim().toUpperCase();
        
        const updates: any = {
            vesselNickname: vesselNickname,
            lastVesselId: sharingId,
            lastFleetId: fleetIdClean || null
        };

        if (fleetIdClean) {
            const currentFleets = userProfile?.savedFleets || [];
            const existing = currentFleets.find(f => f.id === fleetIdClean);
            if (!existing) {
                updates.savedFleets = arrayUnion({ id: fleetIdClean, comment: fleetComment.trim() || 'Nouveau Groupe' });
            } else if (fleetComment.trim() && existing.comment !== fleetComment.trim()) {
                const updatedFleets = currentFleets.map(f => f.id === fleetIdClean ? { ...f, comment: fleetComment.trim() } : f);
                updates.savedFleets = updatedFleets;
            }
        }

        updateDoc(userRef, updates).catch(() => {});
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (simulator?.isActive) return;
        handlePositionLogic(pos.coords.latitude, pos.coords.longitude, (pos.coords.speed || 0) * 1.94384, pos.coords.heading || 0, pos.coords.accuracy);
      },
      () => { if (!simulator?.isActive) toast({ variant: 'destructive', title: "Signal GPS perdu" }); },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, simulator?.isActive, addTechLog, handlePositionLogic, toast, vesselNickname, sharingId, customFleetId, fleetComment, userProfile?.savedFleets]);

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
    setTechLogs([]); // Purge automatique à l'arrêt (RAM uniquement)
    toast({ title: "PARTAGE ARRÊTÉ" });
  }, [firestore, sharingId, toast, addTechLog, updateVesselInFirestore]);

  const changeManualStatus = useCallback((st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    vesselStatusRef.current = st;
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    
    if (st === 'moving' || st === 'returning' || st === 'landed') {
        immobilityStartTime.current = null;
        setAnchorPos(null);
        anchorPosRef.current = null;
    }
    
    addTechLog('CHGT MANUEL', label || st.toUpperCase());
  }, [updateVesselInFirestore, addTechLog]);

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE') => {
    if (!isEmergencyEnabled) {
        toast({ variant: "destructive", title: "Service désactivé", description: "Veuillez activer les réglages d'urgence." });
        return;
    }
    if (!emergencyContact) {
        toast({ variant: "destructive", title: "Numéro requis", description: "Veuillez configurer un contact d'urgence." });
        return;
    }

    const pos = currentPosRef.current;
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    const body = `${nicknamePrefix}${customText} [${type}] Position : ${posUrl}`;
    
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    
    setVesselStatus('emergency');
    updateVesselInFirestore({ status: 'emergency', eventLabel: type }, true);
    addTechLog('URGENCE', type);
  }, [isEmergencyEnabled, emergencyContact, vesselNickname, isCustomMessageEnabled, vesselSmsMessage, updateVesselInFirestore, addTechLog]);

  const removeFleet = useCallback(async (fleetId: string) => {
    if (!user || !firestore || !userProfile?.savedFleets) return;
    const fleetToRemove = userProfile.savedFleets.find(f => f.id === fleetId);
    if (fleetToRemove) {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedFleets: arrayRemove(fleetToRemove)
        });
        toast({ title: "Flotte supprimée" });
    }
  }, [user, firestore, userProfile?.savedFleets, toast]);

  const saveMooringRadius = useCallback(async () => {
    if (!user || !firestore) return;
    try {
        const userRef = doc(firestore, 'users', user.uid);
        const currentVesselPrefs = userProfile?.vesselPrefs || {};
        await updateDoc(userRef, {
            vesselPrefs: {
                ...currentVesselPrefs,
                mooringRadius: mooringRadiusRef.current
            }
        });
        toast({ title: "Rayon par défaut enregistré" });
    } catch (e) {
        toast({ variant: "destructive", title: "Erreur sauvegarde" });
    }
  }, [user, firestore, userProfile]);

  const forceTimeOffset = useCallback((minutes: number) => {
    simulator?.setTimeOffset(minutes);
    addTechLog('LABO', `Décalage temporel : ${minutes} min`);
  }, [simulator, addTechLog]);

  return useMemo(() => ({
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    anchorPos, mooringRadius, setMooringRadius, accuracy, battery, smoothedDistance,
    vesselNickname, setVesselNickname, customSharingId, setCustomSharingId, customFleetId, setCustomFleetId, 
    fleetComment, setFleetComment, sharingId,
    lastSyncTime, techLogs, tacticalLogs, 
    addTacticalLog: async (type: string, photoUrl?: string) => {
        if (!firestore || !sharingId || !currentPosRef.current) return;
        const logEntry = { type: type.toUpperCase(), time: new Date(), pos: currentPosRef.current, vesselName: vesselNickname || sharingId, photoUrl: photoUrl || null };
        addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
    },
    emergencyContact, setEmergencyContact, vesselSmsMessage, setVesselSmsMessage, isEmergencyEnabled, setIsEmergencyEnabled,
    isCustomMessageEnabled, setIsCustomMessageEnabled, clearLogs: () => setTechLogs([]),
    isGhostMode, toggleGhostMode: () => setIsGhostMode(!isGhostMode), 
    isTrajectoryHidden, toggleTrajectoryHidden: () => setIsTrajectoryHidden(!isTrajectoryHidden),
    resetTrajectory: () => { setAnchorPos(null); updateVesselInFirestore({ anchorLocation: null }, true); },
    addTechLog,
    removeFleet,
    savedFleets: userProfile?.savedFleets || [],
    changeManualStatus,
    triggerEmergency,
    saveMooringRadius,
    forceTimeOffset
  }), [
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    anchorPos, mooringRadius, setMooringRadius, accuracy, battery, smoothedDistance,
    vesselNickname, customSharingId, customFleetId, fleetComment, sharingId,
    lastSyncTime, techLogs, tacticalLogs, emergencyContact, vesselSmsMessage, isEmergencyEnabled,
    isCustomMessageEnabled, toast, user, firestore, isGhostMode, isTrajectoryHidden, updateVesselInFirestore,
    removeFleet, userProfile?.savedFleets, changeManualStatus, triggerEmergency, saveMooringRadius, forceTimeOffset
  ]);
}
