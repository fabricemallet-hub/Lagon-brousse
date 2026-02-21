
'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserAccount, SoundLibraryEntry, VesselStatus, VesselPrefs } from '@/lib/types';

/**
 * LOGIQUE RÉCEPTEUR (B) : Journal Technique, Sons Expert, Veille Stratégique.
 * v58.1 : Fix boucle de rendu infinie via Deep Guard sur les prefs.
 */
export function useRecepteur(vesselId?: string) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeAlarms, setActiveAlarms] = useState<Record<string, HTMLAudioElement>>({});
  const [audioAuthorized, setAudioAuthorized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  
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

  const soundsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  // Deep Guard pour éviter les boucles infinies de state
  useEffect(() => {
    if (profile?.vesselPrefs) {
      setVesselPrefs(prev => {
        const currentStr = JSON.stringify(prev);
        const newStr = JSON.stringify({ ...prev, ...profile.vesselPrefs });
        if (currentStr === newStr) return prev;
        return {
          ...prev,
          ...profile.vesselPrefs,
          alerts: {
            ...prev.alerts,
            ...(profile.vesselPrefs.alerts || {})
          }
        };
      });
    }
  }, [profile?.vesselPrefs]);

  const initAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!silentAudioRef.current) {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
      audio.loop = true;
      audio.volume = 0.01;
      audio.play().then(() => {
        silentAudioRef.current = audio;
        setAudioAuthorized(true);
      }).catch(() => {
        setAudioAuthorized(false);
      });
    }
  }, []);

  const stopAllAlarms = useCallback(() => {
    Object.values(activeAlarms).forEach(a => {
        a.pause();
        a.currentTime = 0;
    });
    setActiveAlarms({});
  }, [activeAlarms]);

  const playSound = useCallback((alertKey: keyof VesselPrefs['alerts'] | 'watch', soundOverride?: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    
    const config = alertKey === 'watch' 
        ? { enabled: true, sound: vesselPrefs.watchSound, loop: vesselPrefs.watchLoop }
        : vesselPrefs.alerts[alertKey];

    if (!config?.enabled && !soundOverride) return;

    const soundLabel = soundOverride || config.sound;
    const sound = dbSounds?.find(s => s.label.toLowerCase() === soundLabel.toLowerCase() || s.id === soundLabel);
    
    if (sound) {
      if (activeAlarms[alertKey]) {
          activeAlarms[alertKey].pause();
      }

      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.volume;
      audio.loop = config.loop || false;
      audio.play().catch(() => {});
      
      if (audio.loop) {
        setActiveAlarms(prev => ({ ...prev, [alertKey]: audio }));
      }
    }
  }, [dbSounds, vesselPrefs, activeAlarms]);

  const updateLocalPrefs = useCallback((updates: Partial<VesselPrefs>) => {
    setVesselPrefs(prev => {
        const next = { ...prev, ...updates };
        if (updates.alerts) {
            next.alerts = { ...prev.alerts, ...updates.alerts };
        }
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
      console.error("Erreur sauvegarde sons:", e);
      setIsSaving(false);
      return false;
    }
  }, [user, firestore, vesselPrefs]);

  const savePrefs = useCallback(async (updates: Partial<VesselPrefs>) => {
    if (!user || !firestore) return;
    const newPrefs = { ...vesselPrefs, ...updates };
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs });
  }, [user, firestore, vesselPrefs]);

  return useMemo(() => ({
    vesselPrefs,
    updateLocalPrefs,
    savePrefsToFirestore,
    isSaving,
    savePrefs,
    availableSounds: dbSounds || [],
    playSound,
    stopAllAlarms,
    isAlarmActive: Object.keys(activeAlarms).length > 0,
    initAudio,
    audioAuthorized
  }), [
    vesselPrefs, updateLocalPrefs, savePrefsToFirestore, isSaving, savePrefs, 
    dbSounds, playSound, stopAllAlarms, activeAlarms, initAudio, audioAuthorized
  ]);
}
