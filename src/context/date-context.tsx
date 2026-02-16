'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { SplashScreen } from '@/components/splash-screen';
import type { SplashScreenSettings } from '@/lib/types';

type DateContextType = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isExiting, setIsExiting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore]);

  const { data: splashSettings, isLoading: isSettingsLoading, error: settingsError } = useDoc<SplashScreenSettings>(settingsRef);

  useEffect(() => {
    // Si on a une erreur ou si le chargement est fini (avec ou sans data)
    // On lance le timer de sortie du splash
    if (!isSettingsLoading) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      const duration = (splashSettings?.splashDuration || 2.5) * 1000;

      const timer1 = setTimeout(() => {
        setIsExiting(true);
        const timer2 = setTimeout(() => {
          setShowSplash(false);
          setSelectedDate(new Date());
        }, 1000);
        timersRef.current.push(timer2);
      }, duration);

      timersRef.current.push(timer1);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [splashSettings, isSettingsLoading]);

  const defaultSettings: SplashScreenSettings = useMemo(() => ({
    splashMode: 'image',
    splashImageUrl: '/icon-512x512.png',
    splashBgColor: '#000000',
    splashImageFit: 'contain',
    splashDuration: 2.5
  }), []);

  // En cas d'erreur ou si les données sont manquantes, on utilise systématiquement les réglages par défaut
  const finalSettings = (isSettingsLoading || settingsError) 
    ? defaultSettings 
    : (splashSettings || defaultSettings);

  const value = useMemo(() => ({
    selectedDate: selectedDate || new Date(),
    setSelectedDate,
  }), [selectedDate]);

  if (showSplash) {
    return <SplashScreen settings={finalSettings} isExiting={isExiting} />;
  }

  if (!selectedDate) {
    return null;
  }

  return (
    <DateContext.Provider value={value}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  const context = useContext(DateContext);
  if (context === undefined) {
    throw new Error('useDate must be used within a DateProvider');
  }
  return context;
}
