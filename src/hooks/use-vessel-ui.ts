'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { fetchWindyWeather } from '@/lib/windy-api';
import type { SoundLibraryEntry } from '@/lib/types';

/**
 * Hook gérant l'interface, les sons, les journaux et les urgences.
 */
export function useVesselUI(sharingId: string, vesselNickname: string) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'alpha' | 'beta' | 'gamma'>('alpha');
  const [activeAlarm, setActiveAlarm] = useState<HTMLAudioElement | null>(null);
  const [audioAuthorized, setAudioAuthorized] = useState(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Prefs
  const [vesselVolume, setVesselVolume] = useState(0.8);
  const [notifySettings, setNotifySettings] = useState({ moving: true, stationary: true, offline: true, assistance: true, birds: true });
  const [notifySounds, setNotifySounds] = useState({ moving: 'sonar', stationary: 'bell', offline: 'alerte', assistance: 'alerte', birds: 'bip' });

  // Logs
  const techRef = useMemoFirebase(() => (firestore && sharingId) ? query(collection(firestore, 'vessels', sharingId, 'tech_logs'), orderBy('time', 'desc')) : null, [firestore, sharingId]);
  const tacticalRef = useMemoFirebase(() => (firestore && sharingId) ? query(collection(firestore, 'vessels', sharingId, 'tactical_logs'), orderBy('time', 'desc')) : null, [firestore, sharingId]);
  
  const { data: techLogs } = useCollection(techRef);
  const { data: tacticalLogs } = useCollection(tacticalRef);

  const soundsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = dbSounds || [];

  // Initialisation du thread audio (Trick silence)
  const initAudio = useCallback(() => {
    if (!silentAudioRef.current && typeof window !== 'undefined') {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
      audio.loop = true;
      audio.play().then(() => {
        silentAudioRef.current = audio;
        setAudioAuthorized(true);
      }).catch(() => setAudioAuthorized(false));
    }
  }, []);

  const playSound = useCallback((soundLabel: string, loop: boolean = false) => {
    const sound = availableSounds.find(s => s.label === soundLabel);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselVolume;
      audio.loop = loop;
      audio.play().catch(() => {});
      if (loop) setActiveAlarm(audio);
    }
  }, [availableSounds, vesselVolume]);

  const stopAlarm = () => {
    if (activeAlarm) {
      activeAlarm.pause();
      setActiveAlarm(null);
    }
  };

  // Journalisation Tactique
  const addTacticalLog = async (type: string, lat: number, lng: number, photoUrl?: string) => {
    if (!firestore || !sharingId) return;
    const weather = await fetchWindyWeather(lat, lng);
    const log = {
        type,
        lat,
        lng,
        time: serverTimestamp(),
        wind: weather.windSpeed || 0,
        temp: weather.temp || 0,
        photoUrl: photoUrl || null
    };
    await addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), log);
    playSound(notifySounds.birds);
    toast({ title: `Signalement ${type}` });
  };

  // Urgences
  const sendEmergencySms = (type: 'MAYDAY' | 'PANPAN', contact: string, lat: number, lng: number) => {
    if (!contact) { toast({ variant: 'destructive', title: "Contact requis" }); return; }
    const posUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const body = `[${type}] ${vesselNickname || sharingId} : DEMANDE ASSISTANCE. Position : ${posUrl}`;
    window.location.href = `sms:${contact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
    if (firestore && sharingId) {
        updateDoc(doc(firestore, 'vessels', sharingId), { status: 'emergency', eventLabel: type });
    }
  };

  return {
    viewMode,
    setViewMode,
    activeAlarm,
    stopAlarm,
    audioAuthorized,
    initAudio,
    playSound,
    vesselVolume,
    setVesselVolume,
    notifySettings,
    setNotifySettings,
    notifySounds,
    setNotifySounds,
    techLogs,
    tacticalLogs,
    availableSounds,
    addTacticalLog,
    sendEmergencySms
  };
}
