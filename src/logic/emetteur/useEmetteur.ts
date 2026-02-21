
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, deleteDoc, collection, addDoc, query, orderBy, getDoc, updateDoc } from 'firebase/firestore';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getDistance } from '@/lib/utils';
import { fetchWindyWeather } from '@/lib/windy-api';

/**
 * LOGIQUE ÉMETTEUR (A) : Envoi GPS, Gestion IDs, Historique, Journaux Technique & Tactique.
 * v51.0 : Ajout Logic de Détresse avec Toggle d'Annulation et SMS.
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
  
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [vesselHistory, setVesselHistory] = useState<string[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // SMS & Urgence Settings
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);
  const lastLoggedBattery = useRef<number>(100);

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
      } catch (e) {}
    }
  }, []);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const addTechLog = useCallback(async (label: string, details?: string) => {
    if (!firestore || !sharingId) return;
    const logEntry = {
        label: label.toUpperCase(),
        details: details || '',
        time: new Date(),
        pos: currentPos
    };
    setTechLogs(prev => [logEntry, ...prev].slice(0, 50));
    addDoc(collection(firestore, 'vessels', sharingId, 'tech_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
  }, [firestore, sharingId, currentPos]);

  const updateVesselInFirestore = useCallback(async (data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    
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
      ...batteryInfo
    };

    setDoc(doc(firestore, 'vessels', sharingId), payload, { merge: true })
      .then(() => {
          setLastSyncTime(Date.now());
          lastSentStatusRef.current = data.status || lastSentStatusRef.current;
      })
      .catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname, customFleetId]);

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE') => {
    if (!isSharing) {
        toast({ variant: "destructive", title: "Partage requis", description: "Activez le partage GPS avant de signaler une détresse." });
        return;
    }

    const isCurrentlyActive = vesselStatus === 'emergency' && lastSentStatusRef.current === type;

    if (isCurrentlyActive) {
        // ANNULATION (Toggle)
        const nextStatus = anchorPos ? 'stationary' : 'moving';
        setVesselStatus(nextStatus);
        updateVesselInFirestore({ status: nextStatus, eventLabel: null });
        addTechLog('ANNULATION', `Alerte ${type} levée par l'utilisateur`);
        
        // Nettoyage historique local pour l'annulation
        setTacticalLogs(prev => prev.filter(log => log.type !== type));
        
        toast({ title: "ALERTE ANNULÉE", description: "Statut normal rétabli." });
    } else {
        // DÉCLENCHEMENT
        setVesselStatus('emergency');
        updateVesselInFirestore({ status: 'emergency', eventLabel: type });
        addTechLog('URGENCE', `${type} DÉCLENCHÉ`);
        
        // Envoi SMS si configuré
        if (isEmergencyEnabled && emergencyContact) {
            const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
            const nickname = (vesselNickname || 'Navire').toUpperCase();
            const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Demande assistance immédiate.";
            const body = `[${nickname}] ${customText} [${type}] Position : ${posUrl}`;
            
            window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
        }

        toast({ variant: "destructive", title: `ALERTE ${type}`, description: "Position d'urgence transmise à la flotte." });
    }
  }, [isSharing, vesselStatus, lastSentStatusRef, anchorPos, updateVesselInFirestore, addTechLog, isEmergencyEnabled, emergencyContact, currentPos, vesselNickname, isCustomMessageEnabled, vesselSmsMessage, toast]);

  const startSharing = () => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    localStorage.setItem('lb_vessel_nickname', vesselNickname);
    localStorage.setItem('lb_vessel_id', customSharingId);
    localStorage.setItem('lb_fleet_id', customFleetId);

    setIsSharing(true);
    addTechLog('DÉMARRAGE', `ID: ${sharingId}`);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy: acc } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        const knotSpeed = (speed || 0) * 1.94384;
        
        setAccuracy(Math.round(acc));
        setCurrentPos(newPos);
        onPositionUpdate?.(latitude, longitude);

        if (vesselStatus !== 'emergency' && vesselStatus !== 'returning' && vesselStatus !== 'landed') {
            const nextStatus = knotSpeed < 0.2 ? 'stationary' : 'moving';
            setVesselStatus(nextStatus);
            updateVesselInFirestore({ location: { latitude, longitude }, status: nextStatus, speed: Math.round(knotSpeed), heading: heading || 0 });
        } else {
            updateVesselInFirestore({ location: { latitude, longitude }, speed: Math.round(knotSpeed), heading: heading || 0 });
        }
      },
      () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopSharing = async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    if (firestore && sharingId) {
      await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    }
    setCurrentPos(null);
    setAnchorPos(null);
    onStopCleanup?.();
    toast({ title: "Partage arrêté" });
  };

  const addTacticalLog = useCallback(async (type: string, photoUrl?: string) => {
    if (!firestore || !sharingId || !currentPos) return;
    const logEntry = { type: type.toUpperCase(), time: new Date(), pos: currentPos, photoUrl: photoUrl || null, vesselName: vesselNickname || sharingId };
    setTacticalLogs(prev => [logEntry, ...prev].slice(0, 50));
    addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), { ...logEntry, time: serverTimestamp() }).catch(() => {});
  }, [firestore, sharingId, currentPos, vesselNickname]);

  return {
    isSharing,
    startSharing,
    stopSharing,
    currentPos,
    vesselStatus,
    triggerEmergency,
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
    vesselHistory,
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
    clearLogs: () => { setTechLogs([]); setTacticalLogs([]); }
  };
}
