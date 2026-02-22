'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * MOTEUR AUDIO v81.0 - GESTION DES TRIGGERS & BOUCLES
 * Gère le déblocage du flux audio et la lecture prioritaire des alertes.
 */
export function useAudioEngine() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const activeSoundsRef = useRef<Record<string, HTMLAudioElement>>({});

  /**
   * Débloque l'audio sur iOS/Android via une interaction utilisateur.
   * Doit être appelé sur un clic bouton pour satisfaire les politiques Autoplay.
   */
  const unlockAudio = useCallback(() => {
    if (isUnlocked || typeof window === 'undefined') return;
    
    // Trick : Créer un contexte audio et le reprendre
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      
      // Jouer un son de 1ms pour forcer le déblocage
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(0);
      oscillator.stop(0.001);
      
      setIsUnlocked(true);
      console.log("AudioEngine: Unlocked & Ready");
    }
  }, [isUnlocked]);

  /**
   * Joue un son avec gestion du volume et du bouclage.
   */
  const play = useCallback((id: string, url: string, volume: number = 1, loop: boolean = false) => {
    if (!isUnlocked) {
        console.warn(`AudioEngine: Blocked - User interaction required to play ${id}`);
        return;
    }

    // Si le son est déjà en train de boucler, on ne le relance pas
    if (activeSoundsRef.current[id] && activeSoundsRef.current[id].loop && !activeSoundsRef.current[id].paused) {
        return;
    }

    // Arrêter l'ancienne instance si elle existe
    if (activeSoundsRef.current[id]) {
      activeSoundsRef.current[id].pause();
    }

    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    
    audio.play().then(() => {
        setIsAlarmActive(true);
    }).catch(e => {
        console.warn(`AudioEngine: Play failed for ${id}. Interaction might be missing.`, e);
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
   * Arrête un son spécifique (crucial pour stopper les boucles lors d'un retour à la normale).
   */
  const stop = useCallback((id: string) => {
    if (activeSoundsRef.current[id]) {
      activeSoundsRef.current[id].pause();
      activeSoundsRef.current[id].currentTime = 0;
      delete activeSoundsRef.current[id];
      
      if (Object.keys(activeSoundsRef.current).length === 0) {
          setIsAlarmActive(false);
      }
    }
  }, []);

  /**
   * Arrête toutes les alertes en cours.
   */
  const stopAll = useCallback(() => {
    Object.values(activeSoundsRef.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeSoundsRef.current = {};
    setIsAlarmActive(false);
  }, []);

  return { unlockAudio, play, stop, stopAll, isUnlocked, isAlarmActive };
}
