
'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import type { UserAccount, SoundLibraryEntry, VesselStatus, VesselPrefs } from '@/lib/types';

/**
 * LOGIQUE RÉCEPTEUR (B) v83.1 - CONTRÔLEUR DE TRIGGERS AUDIO
 * Synchronisation avec le protocole Hard Clear et fiabilisation des alertes critiques.
 */
export function useRecepteur(vesselId?: string) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const audioEngine = useAudioEngine();

  const [isSaving, setIsSaving] = useState(false);
  
  const lastAlarmTriggerRef = useRef<Record<string, string>>({});
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, string>>({});

  const defaultPrefs: VesselPrefs = {
    volume: 0.8,
    isNotifyEnabled: true,
    batteryThreshold: 20,
    watchDuration: 60,
    watchSound: 'sonar',
    watchLoop: true,
    isWatchEnabled: false,
    alerts: {
      moving: { enabled: true, sound: 'sonar', loop: false },
      stationary: { enabled: true, sound: 'bell', loop: true },
      drifting: { enabled: true, sound: 'alerte', loop: true },
      offline: { enabled: true, sound: 'alerte', loop: true },
      assistance: { enabled: true, sound: 'military-sms', loop: true },
      tactical: { enabled: true, sound: 'sonar', loop: false },
      battery: { enabled: true, sound: 'alerte urgence', loop: false },
    }
  };

  const [vesselPrefs, setVesselPrefs] = useState<VesselPrefs>(defaultPrefs);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  const soundsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  useEffect(() => {
    if (profile?.vesselPrefs) {
      setVesselPrefs(prev => ({
        ...prev,
        ...profile.vesselPrefs,
        alerts: { ...prev.alerts, ...(profile.vesselPrefs.alerts || {}) }
      }));
    }
  }, [profile?.vesselPrefs]);

  const triggerAlert = useCallback((type: keyof VesselPrefs['alerts'], vesselName: string, forceMaxVolume: boolean = false, vId: string) => {
    if (acknowledgedAlerts[vId] === type) return;
    if (!vesselPrefs.isNotifyEnabled || !dbSounds || !audioEngine.isUnlocked) return;

    const config = vesselPrefs.alerts[type];
    if (!config || !config.enabled) return;

    const sound = dbSounds.find(s => s.label.toLowerCase() === config.sound.toLowerCase() || s.id === config.sound);
    if (!sound) return;

    audioEngine.play(type, sound.url, forceMaxVolume ? 1 : vesselPrefs.volume, config.loop);

    let message = `Notification de ${vesselName}`;
    let title = "ALERTE SYSTÈME";
    let variant: "default" | "destructive" = "default";

    switch(type) {
        case 'assistance':
            title = "🆘 DÉTRESSE";
            message = `Signal d'assistance [MAYDAY/PANPAN] sur ${vesselName} !`;
            variant = "destructive";
            break;
        case 'drifting':
            title = "🚨 DÉRIVE DÉTECTÉE";
            message = `Le navire ${vesselName} est hors de sa zone de sécurité !`;
            variant = "destructive";
            break;
        case 'stationary':
            title = "⚓ VEILLE IMMOBILITÉ";
            message = `${vesselName} est immobile depuis trop longtemps.`;
            break;
        case 'offline':
            title = "📡 SIGNAL PERDU";
            message = `Le navire ${vesselName} ne transmet plus depuis 2 min.`;
            variant = "destructive";
            break;
        case 'battery':
            title = "🪫 BATTERIE FAIBLE";
            message = `${vesselName} : Batterie critique (${vesselPrefs.batteryThreshold}%).`;
            variant = "destructive";
            break;
    }

    toast({ title, description: message, variant, duration: config.loop ? 100000 : 5000 });
  }, [vesselPrefs, dbSounds, audioEngine, toast, acknowledgedAlerts]);

  const processVesselAlerts = useCallback((followedVessels: VesselStatus[]) => {
    if (!vesselPrefs.isNotifyEnabled || !audioEngine.isUnlocked) return;

    followedVessels.forEach(vessel => {
        const vId = vessel.id;
        const lastKnownTrigger = lastAlarmTriggerRef.current[vId];
        
        const lastActiveTime = vessel.lastActive?.toMillis() || 0;
        const lastStatusTime = vessel.statusChangedAt?.toMillis() || lastActiveTime;
        const now = Date.now();

        const isOffline = vessel.isSharing && (now - lastActiveTime > 120000);
        const isImmobileTooLong = vesselPrefs.isWatchEnabled && 
                                 vessel.status === 'stationary' && 
                                 (now - lastStatusTime > vesselPrefs.watchDuration * 60000);
        const isBatteryCritical = (vessel.batteryLevel ?? 100) <= vesselPrefs.batteryThreshold;

        let activeType: keyof VesselPrefs['alerts'] | null = null;

        if (vessel.status === 'emergency') activeType = 'assistance';
        else if (isOffline) activeType = 'offline';
        else if (vessel.status === 'drifting') activeType = 'drifting';
        else if (isImmobileTooLong) activeType = 'stationary';
        else if (isBatteryCritical && !vessel.isCharging) activeType = 'battery';

        if (activeType && lastKnownTrigger !== activeType) {
            triggerAlert(activeType, vessel.displayName || vId, activeType === 'assistance', vId);
            lastAlarmTriggerRef.current[vId] = activeType;
        } 
        
        if (!activeType && lastKnownTrigger) {
            audioEngine.stop(lastKnownTrigger);
            delete lastAlarmTriggerRef.current[vId];
            setAcknowledgedAlerts(prev => {
                const n = {...prev};
                delete n[vId];
                return n;
            });
        }
    });
  }, [vesselPrefs, audioEngine, triggerAlert]);

  const stopAllAlarms = useCallback(() => {
    audioEngine.stopAll();
    const newAcks: Record<string, string> = { ...acknowledgedAlerts };
    Object.entries(lastAlarmTriggerRef.current).forEach(([vId, status]) => {
        newAcks[vId] = status;
    });
    setAcknowledgedAlerts(newAcks);
    toast({ title: "ALERTES COUPÉES", description: "Le système est passé en mode surveillance visuelle." });
  }, [audioEngine, acknowledgedAlerts, toast]);

  return useMemo(() => ({
    vesselPrefs,
    updateLocalPrefs: (u: Partial<VesselPrefs>) => setVesselPrefs(p => ({...p, ...u})),
    savePrefsToFirestore: async () => {
        if (!user || !firestore) return false;
        setIsSaving(true);
        try { 
            await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs }); 
            setIsSaving(false); 
            return true; 
        } catch (e) { 
            setIsSaving(false); 
            return false; 
        }
    },
    isSaving,
    availableSounds: dbSounds || [],
    stopAllAlarms,
    isAlarmActive: audioEngine.isAlarmActive,
    initAudio: () => audioEngine.unlockAudio(),
    processVesselAlerts,
    acknowledgedAlerts
  }), [vesselPrefs, isSaving, dbSounds, stopAllAlarms, audioEngine.isAlarmActive, processVesselAlerts, acknowledgedAlerts, firestore, user]);
}
