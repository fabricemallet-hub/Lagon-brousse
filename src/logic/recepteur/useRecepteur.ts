'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import type { UserAccount, SoundLibraryEntry, VesselStatus, VesselPrefs } from '@/lib/types';

/**
 * LOGIQUE RÉCEPTEUR (B) v62.0
 * Gère la surveillance de flotte, la détection de dérive et le moteur d'alarmes.
 */
export function useRecepteur(vesselId?: string) {
  const { user } = user ? useUser() : { user: null };
  const firestore = useFirestore();
  const { toast } = useToast();
  const audioEngine = useAudioEngine();

  const [isSaving, setIsSaving] = useState(false);
  const lastAlarmTriggerRef = useRef<Record<string, { status: string, time: number }>>({});
  
  const defaultPrefs: VesselPrefs = {
    volume: 0.8,
    isNotifyEnabled: true,
    batteryThreshold: 50,
    watchDuration: 60,
    watchSound: 'grenouille',
    watchLoop: true,
    isWatchEnabled: false,
    alerts: {
      moving: { enabled: true, sound: 'sonar', loop: false },
      stationary: { enabled: true, sound: 'champignon-mario', loop: true },
      offline: { enabled: true, sound: 'la-cucaracha', loop: false },
      assistance: { enabled: true, sound: 'military-sms', loop: true },
      tactical: { enabled: true, sound: 'gong-sms', loop: false },
      battery: { enabled: true, sound: 'alerte urgence', loop: false },
    }
  };

  const [vesselPrefs, setVesselPrefs] = useState<VesselPrefs>(defaultPrefs);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  const soundsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  // Sync des préférences avec Deep Guard
  useEffect(() => {
    if (profile?.vesselPrefs) {
      setVesselPrefs(prev => {
        const currentStr = JSON.stringify(prev);
        const newStr = JSON.stringify({ ...prev, ...profile.vesselPrefs });
        if (currentStr === newStr) return prev;
        return {
          ...prev,
          ...profile.vesselPrefs,
          alerts: { ...prev.alerts, ...(profile.vesselPrefs.alerts || {}) }
        };
      });
    }
  }, [profile?.vesselPrefs]);

  /**
   * Moteur de surveillance de flotte (Triggers Sonores)
   */
  const processVesselAlerts = useCallback((followedVessels: VesselStatus[]) => {
    if (!vesselPrefs.isNotifyEnabled || !dbSounds) return;

    followedVessels.forEach(vessel => {
        const vesselId = vessel.id;
        const currentStatus = vessel.isSharing ? (vessel.status || 'moving') : 'offline';
        const lastTrigger = lastAlarmTriggerRef.current[vesselId];
        
        // 1. Détection Perte de Signal (Watchdog 30s)
        const lastActiveTime = vessel.lastActive?.toMillis() || 0;
        const isActuallyOffline = vessel.isSharing && (Date.now() - lastActiveTime > 30000);
        
        let triggerKey: keyof VesselPrefs['alerts'] | null = null;
        let forceMaxVolume = false;

        if (vessel.status === 'emergency' || vessel.eventLabel === 'MAYDAY') {
            triggerKey = 'assistance';
            forceMaxVolume = true;
        } else if (vessel.status === 'drifting') {
            triggerKey = 'stationary'; // Son mouillage pour la dérive
        } else if (isActuallyOffline || currentStatus === 'offline') {
            triggerKey = 'offline';
        } else if (vessel.status === 'moving' && lastTrigger?.status !== 'moving') {
            triggerKey = 'moving';
        }

        // Exécution de l'alarme si changement ou première fois
        if (triggerKey && (lastTrigger?.status !== triggerKey || forceMaxVolume)) {
            const config = vesselPrefs.alerts[triggerKey];
            if (config.enabled) {
                const sound = dbSounds.find(s => s.label.toLowerCase() === config.sound.toLowerCase() || s.id === config.sound);
                if (sound) {
                    audioEngine.play(
                        triggerKey, 
                        sound.url, 
                        forceMaxVolume ? 1 : vesselPrefs.volume, 
                        config.loop
                    );
                    lastAlarmTriggerRef.current[vesselId] = { status: triggerKey, time: Date.now() };
                }
            }
        }

        // Reset du trigger si retour à la normale
        if (vessel.status === 'moving' && lastTrigger?.status === 'stationary') {
            audioEngine.stop('stationary');
            delete lastAlarmTriggerRef.current[vesselId];
        }
    });
  }, [vesselPrefs, dbSounds, audioEngine]);

  const initAudio = useCallback(() => {
    audioEngine.unlockAudio();
  }, [audioEngine]);

  const stopAllAlarms = useCallback(() => {
    audioEngine.stopAll();
    lastAlarmTriggerRef.current = {};
  }, [audioEngine]);

  const updateLocalPrefs = useCallback((updates: Partial<VesselPrefs>) => {
    setVesselPrefs(prev => {
        const next = { ...prev, ...updates };
        if (updates.alerts) next.alerts = { ...prev.alerts, ...updates.alerts };
        return next;
    });
  }, []);

  const savePrefsToFirestore = useCallback(async () => {
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
  }, [user, firestore, vesselPrefs]);

  return useMemo(() => ({
    vesselPrefs,
    updateLocalPrefs,
    savePrefsToFirestore,
    isSaving,
    availableSounds: dbSounds || [],
    playSound: (key: keyof VesselPrefs['alerts'], overrideUrl?: string) => {
        if (overrideUrl) audioEngine.play(key, overrideUrl, vesselPrefs.volume, false);
        else {
            const config = vesselPrefs.alerts[key];
            const sound = dbSounds?.find(s => s.label.toLowerCase() === config.sound.toLowerCase() || s.id === config.sound);
            if (sound) audioEngine.play(key, sound.url, vesselPrefs.volume, config.loop);
        }
    },
    stopAllAlarms,
    isAlarmActive: false, // Géré en interne par audioEngine
    initAudio,
    processVesselAlerts
  }), [vesselPrefs, updateLocalPrefs, savePrefsToFirestore, isSaving, dbSounds, initAudio, stopAllAlarms, audioEngine]);
}
