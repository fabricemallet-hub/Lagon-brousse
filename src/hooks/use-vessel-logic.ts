'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import type { VesselStatus, UserAccount } from '@/lib/types';
import { getDistance } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook gérant la logique métier du navire : GPS, Identifiants, Dérive, Batterie.
 */
export function useVesselLogic() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSharing, setIsSharing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [battery, setBattery] = useState<{ level: number, charging: boolean }>({ level: 1, charging: false });
  
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [mooringRadius, setMooringRadius] = useState(100);
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
  
  const [customSharingId, setCustomSharingId] = useState('');
  const [customFleetId, setCustomFleetId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');

  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number, lng: number } | null>(null);
  
  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  // Sync Identité depuis le profil
  useEffect(() => {
    if (profile && !vesselNickname) {
      setVesselNickname(profile.vesselNickname || profile.displayName || '');
      if (profile.lastVesselId) setCustomSharingId(profile.lastVesselId);
    }
  }, [profile, vesselNickname]);

  // Moteur GPS & Dérive
  const startTracking = useCallback(() => {
    if (!navigator.geolocation || !firestore || !user) return;
    
    // Historique des IDs pour reconnexion
    updateDoc(doc(firestore, 'users', user.uid), {
        vesselIdHistory: arrayUnion(sharingId),
        fleetIdHistory: customFleetId ? arrayUnion(customFleetId) : [],
        lastVesselId: sharingId
    }).catch(() => {});

    setIsSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy: acc } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        const knotSpeed = Math.max(0, parseFloat(((speed || 0) * 1.94384).toFixed(2)));
        
        setCurrentPos(newPos);
        setCurrentSpeed(Math.round(knotSpeed));
        setCurrentHeading(heading || 0);
        setAccuracy(Math.round(acc));

        // Battery Check
        if ('getBattery' in navigator) {
            (navigator as any).getBattery().then((b: any) => {
                setBattery({ level: b.level, charging: b.charging });
            });
        }

        // Breadcrumbs (Mémoire 30 min / Filtre 2m)
        const now = Date.now();
        const distMoved = lastPosRef.current ? getDistance(latitude, longitude, lastPosRef.current.lat, lastPosRef.current.lng) : 10;
        if (distMoved > 2) {
            setBreadcrumbs(prev => {
                const limit = now - 30 * 60 * 1000;
                return [...prev.filter(p => p.timestamp > limit), { lat: latitude, lng: longitude, timestamp: now }];
            });
            lastPosRef.current = newPos;
        }

        // Logique de statut automatique
        let nextStatus: VesselStatus['status'] = 'moving';
        if (knotSpeed < 0.2) {
            nextStatus = 'stationary';
        } else if (anchorPos) {
            const distFromAnchor = getDistance(latitude, longitude, anchorPos.lat, anchorPos.lng);
            if (distFromAnchor > mooringRadius) nextStatus = 'drifting';
        }
        setVesselStatus(nextStatus);

        // Sync Firestore
        setDoc(doc(firestore, 'vessels', sharingId), {
            id: sharingId,
            userId: user.uid,
            displayName: vesselNickname || 'Capitaine',
            location: { latitude, longitude },
            status: nextStatus,
            isSharing: true,
            lastActive: serverTimestamp(),
            batteryLevel: Math.round(battery.level * 100),
            isCharging: battery.charging,
            fleetId: customFleetId || null
        }, { merge: true }).catch(() => {});
      },
      () => toast({ variant: 'destructive', title: "Signal GPS perdu" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [user, firestore, sharingId, customFleetId, vesselNickname, anchorPos, mooringRadius, battery, toast]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    setIsSharing(false);
    if (firestore && sharingId) {
        await updateDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() });
    }
    setCurrentPos(null);
    setAnchorPos(null);
  }, [firestore, sharingId]);

  return {
    isSharing,
    currentPos,
    currentSpeed,
    currentHeading,
    accuracy,
    battery,
    vesselStatus,
    anchorPos,
    setAnchorPos,
    mooringRadius,
    setMooringRadius,
    breadcrumbs,
    setBreadcrumbs,
    sharingId,
    customSharingId,
    setCustomSharingId,
    customFleetId,
    setCustomFleetId,
    vesselNickname,
    setVesselNickname,
    profile,
    startTracking,
    stopTracking,
    setVesselStatus
  };
}
