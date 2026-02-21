'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * MOTEUR AUDIO v62.0
 * Gère le déblocage du flux audio sur mobile et la lecture des alarmes tactiques.
 */
export function useAudioEngine() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const activeSoundsRef = useRef<Record<string, HTMLAudioElement>>({});

  /**
   * Débloque l'audio sur iOS/Android via une interaction utilisateur.
   * Doit être appelé lors du clic sur "Lancer le partage" ou "Suivre".
   */
  const unlockAudio = useCallback(() => {
    if (isUnlocked || typeof window === 'undefined') return;
    
    // Création d'un AudioContext silencieux pour réveiller le moteur
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0; // Silencieux
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(0);
      oscillator.stop(0.1);
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      setIsUnlocked(true);
      console.log("AudioEngine: Unlocked for alerts");
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
  }, []);

  /**
   * Joue un son avec gestion du volume et du bouclage.
   */
  const play = useCallback((id: string, url: string, volume: number = 1, loop: boolean = false) => {
    // Si le son tourne déjà en boucle, on ne le relance pas
    if (activeSoundsRef.current[id] && activeSoundsRef.current[id].loop && !activeSoundsRef.current[id].paused) {
        return;
    }

    // Arrête l'ancienne instance si elle existe
    if (activeSoundsRef.current[id]) {
      activeSoundsRef.current[id].pause();
    }

    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    
    audio.play().catch(e => {
        console.warn(`AudioEngine: Lecture bloquée pour ${id}. Attente interaction.`, e);
    });

    activeSoundsRef.current[id] = audio;

    audio.onended = () => {
      if (!loop) {
        delete activeSoundsRef.current[id];
      }
    };
  }, []);

  /**
   * Arrête un son spécifique.
   */
  const stop = useCallback((id: string) => {
    if (activeSoundsRef.current[id]) {
      activeSoundsRef.current[id].pause();
      delete activeSoundsRef.current[id];
    }
  }, []);

  return { unlockAudio, play, stop, stopAll, isUnlocked };
}
