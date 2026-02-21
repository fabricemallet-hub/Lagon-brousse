'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import type { UserAccount, SoundLibraryEntry, VesselStatus, VesselPrefs } from '@/lib/types';

/**
 * LOGIQUE RÉCEPTEUR (B) v63.0
 * Gère la surveillance de flotte et le système de notifications synchronisées (Sons + Toasts).
 */
export function useRecepteur(vesselId?: string) {
  const { user } = useUser();
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
   * Système de déclenchement synchronisé Alerte + Son
   */
  const triggerAlert = useCallback((type: keyof VesselPrefs['alerts'], vesselName: string, forceMaxVolume: boolean = false) => {
    if (!vesselPrefs.isNotifyEnabled || !dbSounds || !audioEngine.isUnlocked) return;

    const config = vesselPrefs.alerts[type];
    if (!config.enabled) return;

    const sound = dbSounds.find(s => s.label.toLowerCase() === config.sound.toLowerCase() || s.id === config.sound);
    if (!sound) return;

    // 1. Déclenchement Sonore
    audioEngine.play(type, sound.url, forceMaxVolume ? 1 : vesselPrefs.volume, config.loop);

    // 2. Déclenchement Toast explicite
    let message = `Notification de ${vesselName}`;
    let title = "ALERTE SYSTÈME";
    let variant: "default" | "destructive" = "default";

    switch(type) {
        case 'assistance':
            title = "🆘 DÉTRESSE";
            message = `Alerte [MAYDAY/PANPAN] activée sur ${vesselName} !`;
            variant = "destructive";
            break;
        case 'stationary': // Mappe sur la dérive
            title = "🚨 ALERTE MOUILLAGE";
            message = `Le bateau ${vesselName} a quitté le cercle de sécurité !`;
            variant = "destructive";
            break;
        case 'offline':
            title = "📡 SIGNAL PERDU";
            message = `Perte de connexion GPS ou Réseau pour ${vesselName} !`;
            variant = "destructive";
            break;
        case 'moving':
            title = "⚓ MOUVEMENT";
            message = `${vesselName} est en route.`;
            break;
    }

    toast({ title, description: message, variant, duration: config.loop ? 10000 : 4000 });
  }, [vesselPrefs, dbSounds, audioEngine, toast]);

  /**
   * Moteur de surveillance de flotte
   */
  const processVesselAlerts = useCallback((followedVessels: VesselStatus[]) => {
    if (!vesselPrefs.isNotifyEnabled || !audioEngine.isUnlocked) return;

    followedVessels.forEach(vessel => {
        const vesselId = vessel.id;
        const lastTrigger = lastAlarmTriggerRef.current[vesselId];
        
        // Watchdog 30s
        const lastActiveTime = vessel.lastActive?.toMillis() || 0;
        const isActuallyOffline = vessel.isSharing && (Date.now() - lastActiveTime > 30000);
        
        let typeToTrigger: keyof VesselPrefs['alerts'] | null = null;
        let forceMaxVolume = false;

        if (vessel.status === 'emergency' || vessel.eventLabel === 'MAYDAY' || vessel.eventLabel === 'PAN PAN') {
            typeToTrigger = 'assistance';
            forceMaxVolume = true;
        } else if (vessel.status === 'drifting') {
            typeToTrigger = 'stationary';
        } else if (isActuallyOffline || (!vessel.isSharing && lastTrigger?.status !== 'offline')) {
            typeToTrigger = 'offline';
        } else if (vessel.status === 'moving' && lastTrigger?.status !== 'moving' && lastTrigger?.status !== undefined) {
            typeToTrigger = 'moving';
        }

        if (typeToTrigger && lastTrigger?.status !== typeToTrigger) {
            triggerAlert(typeToTrigger, vessel.displayName || vesselId, forceMaxVolume);
            lastAlarmTriggerRef.current[vesselId] = { status: typeToTrigger, time: Date.now() };
        }

        // Reset
        if (vessel.status === 'moving' && lastTrigger?.status === 'stationary') {
            audioEngine.stop('stationary');
            delete lastAlarmTriggerRef.current[vesselId];
        }
    });
  }, [vesselPrefs, audioEngine, triggerAlert]);

  const initAudio = useCallback(() => {
    audioEngine.unlockAudio();
  }, [audioEngine]);

  const stopAllAlarms = useCallback(() => {
    audioEngine.stopAll();
    lastAlarmTriggerRef.current = {};
  }, [audioEngine]);

  const updateLocalPrefs = useCallback((updates: Partial<VesselPrefs>) => {
    setVesselPrefs(prev => ({ ...prev, ...updates }));
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
    playSound: (key: keyof VesselPrefs['alerts']) => {
        const config = vesselPrefs.alerts[key];
        const sound = dbSounds?.find(s => s.label.toLowerCase() === config.sound.toLowerCase() || s.id === config.sound);
        if (sound) audioEngine.play(key, sound.url, vesselPrefs.volume, config.loop);
    },
    stopAllAlarms,
    isAlarmActive: audioEngine.isAlarmActive,
    initAudio,
    processVesselAlerts
  }), [vesselPrefs, updateLocalPrefs, savePrefsToFirestore, isSaving, dbSounds, initAudio, stopAllAlarms, audioEngine.isAlarmActive, audioEngine.play, audioEngine.stop, processVesselAlerts]);
}
