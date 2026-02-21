'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserAccount, SoundLibraryEntry, VesselStatus, VesselPrefs } from '@/lib/types';

/**
 * LOGIQUE RÉCEPTEUR (B) : Journal Technique, Sons Expert, Veille Stratégique.
 */
export function useRecepteur(vesselId?: string) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeAlarms, setActiveAlarms] = useState<Record<string, HTMLAudioElement>>({});
  const [audioAuthorized, setAudioAuthorized] = useState(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [vesselPrefs, setVesselPrefs] = useState<VesselPrefs>({
    volume: 0.8,
    isNotifyEnabled: true,
    batteryThreshold: 50,
    watchDuration: 60,
    watchSound: 'grenouille',
    alerts: {
      moving: { enabled: true, sound: 'bip digital', loop: false },
      stationary: { enabled: true, sound: 'champignon-mario', loop: true },
      offline: { enabled: true, sound: 'la-cucaracha', loop: false },
      assistance: { enabled: true, sound: 'military-sms', loop: true },
      tactical: { enabled: true, sound: 'gong-sms', loop: true },
      battery: { enabled: true, sound: 'alerte urgence', loop: false },
    }
  });

  const soundsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (profile?.vesselPrefs) {
      setVesselPrefs(profile.vesselPrefs);
    }
  }, [profile]);

  // Initialisation du thread audio (Trick silence)
  const initAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!silentAudioRef.current) {
      // Audio silencieux pour maintenir le thread actif sur mobile (iOS/Android)
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
      audio.loop = true;
      audio.volume = 0.01;
      audio.play().then(() => {
        silentAudioRef.current = audio;
        setAudioAuthorized(true);
      }).catch((e) => {
        console.warn("Audio interaction needed", e);
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
        ? { enabled: true, sound: vesselPrefs.watchSound, loop: true }
        : vesselPrefs.alerts[alertKey];

    if (!config?.enabled && !soundOverride) return;

    const soundLabel = soundOverride || config.sound;
    const sound = dbSounds?.find(s => s.label.toLowerCase() === soundLabel.toLowerCase());
    
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.volume;
      audio.loop = config.loop || false;
      audio.play().catch(() => {});
      
      if (audio.loop) {
        setActiveAlarms(prev => ({ ...prev, [alertKey]: audio }));
      }
    }
  }, [dbSounds, vesselPrefs]);

  const savePrefs = async (updates: Partial<VesselPrefs>) => {
    if (!user || !firestore) return;
    const newPrefs = { ...vesselPrefs, ...updates };
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs });
  };

  // Listener des logs techniques Firestore
  const techLogsRef = useMemoFirebase(() => (firestore && vesselId) ? query(collection(firestore, 'vessels', vesselId, 'tech_logs'), orderBy('time', 'desc')) : null, [firestore, vesselId]);
  const { data: dbTechLogs } = useCollection(techLogsRef);

  // LOGIQUE VEILLE STRATÉGIQUE
  useEffect(() => {
    if (!vesselId || !dbTechLogs || dbTechLogs.length === 0 || !vesselPrefs.isWatchEnabled) return;

    const checkInactivity = () => {
        const lastLog = dbTechLogs[0];
        const lastTime = lastLog.time?.toMillis?.() || 0;
        if (lastTime === 0) return;

        const diffMinutes = (Date.now() - lastTime) / (1000 * 60);
        if (diffMinutes >= (vesselPrefs.watchDuration || 60)) {
            if (!activeAlarms['watch']) {
                playSound('watch');
                toast({ variant: 'destructive', title: "VEILLE STRATÉGIQUE", description: `Aucun signal depuis ${vesselPrefs.watchDuration}m` });
            }
        }
    };

    const interval = setInterval(checkInactivity, 30000);
    return () => clearInterval(interval);
  }, [dbTechLogs, vesselPrefs.watchDuration, vesselPrefs.isWatchEnabled, vesselId, playSound, activeAlarms, toast]);

  return {
    techLogs: dbTechLogs || [],
    vesselPrefs,
    savePrefs,
    availableSounds: dbSounds || [],
    playSound,
    stopAllAlarms,
    isAlarmActive: Object.keys(activeAlarms).length > 0,
    initAudio,
    audioAuthorized
  };
}
