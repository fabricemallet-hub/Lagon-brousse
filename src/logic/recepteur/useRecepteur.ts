'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserAccount, SoundLibraryEntry, VesselStatus } from '@/lib/types';

/**
 * LOGIQUE RÉCEPTEUR (B) : Journal Technique, Sons, Veille.
 */
export function useRecepteur(vesselId?: string) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [vesselPrefs, setVesselPrefs] = useState({
    volume: 0.8,
    notifyEnabled: true,
    sounds: { moving: 'sonar', stationary: 'bell', offline: 'alerte' },
    batteryThreshold: 20
  });

  const soundsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const userDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (profile?.vesselPrefs) {
      setVesselPrefs(prev => ({ ...prev, ...profile.vesselPrefs }));
    }
  }, [profile]);

  // Listener des logs techniques Firestore
  const techLogsRef = useMemoFirebase(() => (firestore && vesselId) ? query(collection(firestore, 'vessels', vesselId, 'tech_logs'), orderBy('time', 'desc')) : null, [firestore, vesselId]);
  const { data: dbTechLogs } = useCollection(techLogsRef);

  const playSound = useCallback((soundLabel: string) => {
    if (!vesselPrefs.notifyEnabled) return;
    const sound = dbSounds?.find(s => s.label === soundLabel);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.volume;
      audio.play().catch(() => {});
    }
  }, [dbSounds, vesselPrefs]);

  const savePrefs = async (updates: Partial<typeof vesselPrefs>) => {
    if (!user || !firestore) return;
    const newPrefs = { ...vesselPrefs, ...updates };
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs });
    toast({ title: "Préférences sons enregistrées" });
  };

  return {
    techLogs: dbTechLogs || [],
    vesselPrefs,
    savePrefs,
    availableSounds: dbSounds || [],
    playSound
  };
}
