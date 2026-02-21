'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { VesselStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) v69.0 : "Moteur Autonome"
 * Gère les transitions automatiques Mouvement/Mouillage basées sur la vitesse.
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

  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const lastGpsCutRef = useRef<boolean>(false);
  const isEmergencySmsSentRef = useRef<boolean>(false);
  const consecutiveDriftCountRef = useRef<number>(0);
  
  const currentPosRef = useRef(currentPos);
  useEffect(() => { currentPosRef.current = currentPos; }, [currentPos]);

  const handlePositionUpdateRef = useRef(handlePositionUpdate);
  const handleStopCleanupRef = useRef(handleStopCleanup);
  useEffect(() => { handlePositionUpdateRef.current = handlePositionUpdate; }, [handlePositionUpdate]);
  useEffect(() => { handleStopCleanupRef.current = handleStopCleanup; }, [handleStopCleanup]);

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
        try {
          setIdsHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error("Erreur historique IDs", e);
        }
      }
    }
  }, []);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

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

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    if (simulator?.isComCut) return; 
    
    let batteryInfo = { batteryLevel: 100, isCharging: false };
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
      mooringRadius: mooringRadius,
      ...batteryInfo
    };

    setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => {
          setLastSyncTime(Date.now());
          lastSentStatusRef.current = data.status || lastSentStatusRef.current;
      })
      .catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, customFleetId, mooringRadius, simulator?.isComCut]);

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE' | 'DÉRIVE') => {
    if (!isSharing) return;

    setVesselStatus('emergency');
    updateVesselInFirestore({ status: 'emergency', eventLabel: type });
    addTechLog('URGENCE', `${type} DÉCLENCHÉ`);
    
    if (isEmergencyEnabled && emergencyContact && !isEmergencySmsSentRef.current) {
        const nick = vesselNickname || 'KOOLAPIK';
        const msg = isCustomMessageEnabled && vesselSmsMessage ? vesselSmsMessage : "Requiert assistance immédiate.";
        const time = format(new Date(), 'HH:mm');
        const acc = accuracy || 0;
        const pos = currentPosRef.current;
        const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
        
        const body = `[${nick.toUpperCase()}] ${msg} [${type}] à ${time}. Position (+/- ${acc}m) : ${posUrl}`;
        window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
        isEmergencySmsSentRef.current = true;
    }
    toast({ variant: "destructive", title: `ALERTE ${type}` });
  }, [isSharing, updateVesselInFirestore, addTechLog, isEmergencyEnabled, emergencyContact, vesselNickname, isCustomMessageEnabled, vesselSmsMessage, accuracy, toast]);

  const handlePositionLogic = useCallback((lat: number, lng: number, speed: number, heading: number, acc: number) => {
    const knotSpeed = speed * 1.94384;
    let nextStatus = vesselStatus;

    // 1. DÉTECTION AUTOMATIQUE DU MOUVEMENT (> 5nd)
    if (knotSpeed > 5) {
        if (vesselStatus !== 'moving') {
            nextStatus = 'moving';
            setAnchorPos(null);
            addTechLog('AUTO', 'Navigation détectée (>5 nds)');
            isEmergencySmsSentRef.current = false;
        }
    } 
    // 2. DÉTECTION AUTOMATIQUE DU MOUILLAGE (< 2nd après mouvement)
    else if (knotSpeed < 2 && vesselStatus === 'moving') {
        nextStatus = 'stationary';
        const newAnchor = { lat, lng };
        setAnchorPos(newAnchor);
        addTechLog('AUTO', 'Mouillage stabilisé (<2 nds)');
    }

    // 3. SURVEILLANCE DE DÉRIVE (Si ancre active)
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
            isEmergencySmsSentRef.current = false;
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

  // MODULE SIMULATION
  useEffect(() => {
    if (!simulator?.isActive || !simulator.simPos || !isSharing) return;
    handlePositionLogic(
        simulator.simPos.lat, 
        simulator.simPos.lng, 
        simulator.simSpeed / 1.94384, 
        0, 
        simulator.isGpsCut ? 600 : simulator.simAccuracy
    );
  }, [simulator?.isActive, simulator?.simPos, simulator?.simSpeed, simulator?.simAccuracy, simulator?.isGpsCut, isSharing, handlePositionLogic]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    const vId = customSharingId.trim().toUpperCase();
    const fId = customFleetId.trim().toUpperCase();

    localStorage.setItem('lb_vessel_nickname', vesselNickname);
    localStorage.setItem('lb_vessel_id', vId);
    localStorage.setItem('lb_fleet_id', fId);

    setIsSharing(true);
    addTechLog('DÉMARRAGE', `ID: ${sharingId}`);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (simulator?.isActive) return;
        handlePositionLogic(
            pos.coords.latitude, 
            pos.coords.longitude, 
            pos.coords.speed || 0, 
            pos.coords.heading || 0, 
            pos.coords.accuracy
        );
      },
      () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, sharingId, customSharingId, customFleetId, vesselNickname, simulator?.isActive, addTechLog, handlePositionLogic, toast]);

  const stopSharing = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    if (firestore && sharingId) {
      const ref = doc(firestore, 'vessels', sharingId);
      setDoc(ref, { 
        isSharing: false, 
        lastActive: serverTimestamp(),
        anchorLocation: null,
        status: 'offline'
      }, { merge: true });
    }
    setCurrentPos(null);
    setAnchorPos(null);
    isEmergencySmsSentRef.current = false;
    handleStopCleanupRef.current?.(); 
    toast({ title: "Partage arrêté" });
  }, [firestore, sharingId, toast]);

  const changeManualStatus = useCallback((st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving') {
        setAnchorPos(null);
        isEmergencySmsSentRef.current = false;
    } else if (currentPosRef.current) {
        setAnchorPos(currentPosRef.current);
    }

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
        await updateDoc(doc(firestore, 'users', user.uid), {
            emergencyContact,
            vesselSmsMessage,
            isEmergencyEnabled,
            isCustomMessageEnabled
        });
    }
    toast({ title: "Réglages SMS sauvegardés" });
  }, [user, firestore, emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled, toast]);

  const loadFromHistory = useCallback((vId: string, fId: string) => {
    setCustomSharingId(vId);
    setCustomFleetId(fId);
    toast({ title: "ID Chargé", description: `Navire: ${vId}` });
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
    isSharing,
    startSharing,
    stopSharing,
    currentPos,
    currentHeading,
    currentSpeed,
    vesselStatus,
    triggerEmergency,
    changeManualStatus,
    anchorPos,
    setAnchorPos,
    mooringRadius,
    setMooringRadius,
    accuracy,
    vesselNickname,
    setVesselNickname,
    customSharingId,
    setCustomSharingId,
    customFleetId,
    setCustomFleetId,
    sharingId,
    idsHistory,
    loadFromHistory,
    removeFromHistory,
    lastSyncTime,
    techLogs,
    tacticalLogs,
    addTacticalLog,
    emergencyContact,
    setEmergencyContact,
    vesselSmsMessage,
    setVesselSmsMessage,
    isEmergencyEnabled,
    setIsEmergencyEnabled,
    isCustomMessageEnabled,
    setIsCustomMessageEnabled,
    saveSmsSettings,
    clearLogs: () => { setTechLogs([]); setTacticalLogs([]); }
  }), [
    isSharing, startSharing, stopSharing, currentPos, currentHeading, currentSpeed, vesselStatus,
    triggerEmergency, changeManualStatus, anchorPos, mooringRadius, accuracy,
    vesselNickname, customSharingId, customFleetId, sharingId, idsHistory,
    loadFromHistory, removeFromHistory, lastSyncTime, techLogs, tacticalLogs,
    addTacticalLog, emergencyContact, vesselSmsMessage, isEmergencyEnabled,
    isCustomMessageEnabled, saveSmsSettings
  ]);
}
