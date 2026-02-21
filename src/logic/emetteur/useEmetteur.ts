'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { VesselStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

/**
 * LOGIQUE ÉMETTEUR (A) : "Le Cerveau"
 * Gère l'identité, le partage Firestore, l'historique et la persistance SMS (v54.0).
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
  const [idsHistory, setIdsHistory] = useState<{ vId: string, fId: string }[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // SMS & Urgence Settings (v54.0 - Persistance Locale)
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);

  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [tacticalLogs, setTacticalLogs] = useState<any[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<string | null>(null);

  // CHARGEMENT PERSISTANCE LOCALE (Inclus SMS v54.0)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNickname = localStorage.getItem('lb_vessel_nickname');
      const savedVesselId = localStorage.getItem('lb_vessel_id');
      const savedFleetId = localStorage.getItem('lb_fleet_id');
      const savedHistory = localStorage.getItem('lb_ids_history');
      
      const savedEmergencyContact = localStorage.getItem('lb_emergency_contact');
      const savedSmsMessage = localStorage.getItem('lb_vessel_sms_message');
      const savedEmergencyEnabled = localStorage.getItem('lb_emergency_enabled');

      if (savedNickname) setVesselNickname(savedNickname);
      if (savedVesselId) setCustomSharingId(savedVesselId);
      if (savedFleetId) setCustomFleetId(savedFleetId);
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

  const saveSmsSettings = useCallback(() => {
    localStorage.setItem('lb_emergency_contact', emergencyContact);
    localStorage.setItem('lb_vessel_sms_message', vesselSmsMessage);
    localStorage.setItem('lb_emergency_enabled', String(isEmergencyEnabled));
    toast({ title: "Paramètres SMS sauvegardés" });
  }, [emergencyContact, vesselSmsMessage, isEmergencyEnabled, toast]);

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

  const startSharing = () => {
    if (!navigator.geolocation || !user || !firestore) return;
    
    const vId = customSharingId.trim().toUpperCase();
    const fId = customFleetId.trim().toUpperCase();

    localStorage.setItem('lb_vessel_nickname', vesselNickname);
    localStorage.setItem('lb_vessel_id', vId);
    localStorage.setItem('lb_fleet_id', fId);

    if (vId) {
        setIdsHistory(prev => {
            const filtered = prev.filter(h => h.vId !== vId);
            const newHistory = [{ vId, fId }, ...filtered].slice(0, 5);
            localStorage.setItem('lb_ids_history', JSON.stringify(newHistory));
            return newHistory;
        });
    }

    setIsSharing(true);
    addTechLog('DÉMARRAGE', `ID: ${sharingId} | FLOTTE: ${fId || 'AUCUNE'}`);

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
            updateVesselInFirestore({ 
                location: { latitude, longitude }, 
                status: nextStatus, 
                speed: Math.round(knotSpeed), 
                heading: heading || 0,
                fleetId: fId || null
            });
        } else {
            updateVesselInFirestore({ 
                location: { latitude, longitude }, 
                speed: Math.round(knotSpeed), 
                heading: heading || 0,
                fleetId: fId || null
            });
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
      const ref = doc(firestore, 'vessels', sharingId);
      setDoc(ref, { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
    }
    setCurrentPos(null);
    setAnchorPos(null);
    onStopCleanup?.();
    toast({ title: "Partage arrêté" });
  };

  const triggerEmergency = useCallback((type: 'MAYDAY' | 'PAN PAN' | 'ASSISTANCE') => {
    if (!isSharing) {
        toast({ variant: "destructive", title: "Partage requis", description: "Activez le partage GPS avant de signaler une détresse." });
        return;
    }

    const isCurrentlyActive = vesselStatus === 'emergency' && lastSentStatusRef.current === type;

    if (isCurrentlyActive) {
        const nextStatus = anchorPos ? 'stationary' : 'moving';
        setVesselStatus(nextStatus);
        updateVesselInFirestore({ status: nextStatus, eventLabel: null });
        addTechLog('ANNULATION', `Alerte ${type} levée`);
        toast({ title: "ALERTE ANNULÉE" });
    } else {
        setVesselStatus('emergency');
        updateVesselInFirestore({ status: 'emergency', eventLabel: type });
        addTechLog('URGENCE', `${type} DÉCLENCHÉ`);
        
        if (isEmergencyEnabled && emergencyContact) {
            const nick = vesselNickname || 'KOOLAPIK';
            const msg = isCustomMessageEnabled && vesselSmsMessage ? vesselSmsMessage : "Requiert assistance immédiate.";
            const time = format(new Date(), 'HH:mm');
            const acc = accuracy || 0;
            const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
            
            const body = `[${nick.toUpperCase()}] ${msg} [${type}] à ${time}. Position (+/- ${acc}m) : ${posUrl}`;
            window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
        }
        toast({ variant: "destructive", title: `ALERTE ${type}` });
    }
  }, [isSharing, vesselStatus, anchorPos, updateVesselInFirestore, addTechLog, isEmergencyEnabled, emergencyContact, currentPos, vesselNickname, isCustomMessageEnabled, vesselSmsMessage, accuracy, toast]);

  const loadFromHistory = (vId: string, fId: string) => {
    setCustomSharingId(vId);
    setCustomFleetId(fId);
    toast({ title: "ID Chargé", description: `Navire: ${vId}` });
  };

  const removeFromHistory = (vId: string) => {
    setIdsHistory(prev => {
        const newHistory = prev.filter(h => h.vId !== vId);
        localStorage.setItem('lb_ids_history', JSON.stringify(newHistory));
        return newHistory;
    });
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
  };
}
