'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * MOTEUR AUDIO v63.0
 * Gère le déblocage du flux audio sur mobile et la gestion des alarmes actives.
 */
export function useAudioEngine() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const activeSoundsRef = useRef<Record<string, HTMLAudioElement>>({});

  /**
   * Débloque l'audio sur iOS/Android via une interaction utilisateur.
   */
  const unlockAudio = useCallback(() => {
    if (isUnlocked || typeof window === 'undefined') return;
    
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(0);
      oscillator.stop(0.1);
      
      setIsUnlocked(true);
      console.log("AudioEngine: Unlocked by user interaction");
    }
  }, [isUnlocked]);

  /**
   * Arrête tous les sons en cours.
   */
  const stopAll = useCallback(() => {
    Object.values(activeSoundsRef.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeSoundsRef.current = {};
    setIsAlarmActive(false);
  }, []);

  /**
   * Joue un son avec gestion du volume et du bouclage.
   */
  const play = useCallback((id: string, url: string, volume: number = 1, loop: boolean = false) => {
    if (!isUnlocked) {
        console.warn(`AudioEngine: Blocked - Unlock required for ${id}`);
        return;
    }

    if (activeSoundsRef.current[id] && activeSoundsRef.current[id].loop && !activeSoundsRef.current[id].paused) {
        return;
    }

    if (activeSoundsRef.current[id]) {
      activeSoundsRef.current[id].pause();
    }

    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    
    audio.play().then(() => {
        setIsAlarmActive(true);
    }).catch(e => {
        console.warn(`AudioEngine: Play failed for ${id}`, e);
    });

    activeSoundsRef.current[id] = audio;

    audio.onended = () => {
      if (!loop) {
        delete activeSoundsRef.current[id];
        if (Object.keys(activeSoundsRef.current).length === 0) {
            setIsAlarmActive(false);
        }
      }
    };
  }, [isUnlocked]);

  /**
   * Arrête un son spécifique.
   */
  const stop = useCallback((id: string) => {
    if (activeSoundsRef.current[id]) {
      activeSoundsRef.current[id].pause();
      delete activeSoundsRef.current[id];
      if (Object.keys(activeSoundsRef.current).length === 0) {
          setIsAlarmActive(false);
      }
    }
  }, []);

  return { unlockAudio, play, stop, stopAll, isUnlocked, isAlarmActive };
}
