'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getDistance } from '@/lib/utils';

/**
 * LOGIQUE ÉMETTEUR (A) : Envoi GPS, Mouillage, Batterie, SMS.
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
  
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (profile) {
      setVesselNickname(profile.vesselNickname || profile.displayName || '');
      setEmergencyContact(profile.emergencyContact || '');
      setVesselSmsMessage(profile.vesselSmsMessage || '');
      if (profile.lastVesselId && !customSharingId) setCustomSharingId(profile.lastVesselId);
    }
  }, [profile]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || !isSharing) return;
    const sharingId = (customSharingId || user.uid).toUpperCase();
    
    setDoc(doc(firestore, 'vessels', sharingId), {
      ...data,
      id: sharingId,
      userId: user.uid,
      displayName: vesselNickname || 'Capitaine',
      isSharing: true,
      lastActive: serverTimestamp(),
      batteryLevel: Math.round(battery.level * 100),
      isCharging: battery.charging,
    }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, customSharingId, vesselNickname, battery]);

  const startSharing = () => {
    if (!navigator.geolocation || !user || !firestore) return;
    setIsSharing(true);
    const sharingId = (customSharingId || user.uid).toUpperCase();

    // Mémoriser l'ID
    updateDoc(doc(firestore, 'users', user.uid), { lastVesselId: sharingId, vesselIdHistory: arrayUnion(sharingId) }).catch(() => {});

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        const knotSpeed = (speed || 0) * 1.94384;
        
        setCurrentPos(newPos);
        onPositionUpdate?.(latitude, longitude);

        // Détection de batterie
        if ('getBattery' in navigator) {
          (navigator as any).getBattery().then((b: any) => setBattery({ level: b.level, charging: b.charging }));
        }

        // Détection de dérive/mouillage auto
        if (vesselStatus === 'moving' || vesselStatus === 'stationary' || vesselStatus === 'drifting') {
          if (!anchorPos) setAnchorPos(newPos);
          const dist = getDistance(latitude, longitude, anchorPos?.lat || latitude, anchorPos?.lng || longitude);
          
          if (dist > mooringRadius) {
            setVesselStatus('drifting');
            updateVesselInFirestore({ location: { latitude, longitude }, status: 'drifting' });
          } else if (knotSpeed < 0.2) {
            setVesselStatus('stationary');
            updateVesselInFirestore({ location: { latitude, longitude }, status: 'stationary' });
          } else {
            setVesselStatus('moving');
            updateVesselInFirestore({ location: { latitude, longitude }, status: 'moving' });
          }
        } else {
          // Statuts manuels (Returning, Landed)
          updateVesselInFirestore({ location: { latitude, longitude } });
        }
      },
      () => toast({ variant: 'destructive', title: "GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopSharing = async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setIsSharing(false);
    const sharingId = (customSharingId || user?.uid || '').toUpperCase();
    if (firestore && sharingId) {
      await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    }
    setCurrentPos(null);
    setAnchorPos(null);
  };

  const setManualStatus = (st: VesselStatus['status'], label?: string) => {
    setVesselStatus(st);
    if (st === 'moving') setAnchorPos(currentPos);
    updateVesselInFirestore({ status: st, eventLabel: label || null });
    toast({ title: label || "Statut mis à jour" });
  };

  const saveSmsSettings = async (contact: string, message: string) => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid), { emergencyContact: contact, vesselSmsMessage: message });
    setEmergencyContact(contact);
    setVesselSmsMessage(message);
    toast({ title: "Paramètres SMS enregistrés" });
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
    emergencyContact,
    vesselSmsMessage,
    saveSmsSettings,
    history: profile?.vesselIdHistory || []
  };
}
