
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
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

  // Fetch splash settings from Firestore
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'splash');
  }, [firestore]);

  const { data: splashSettings, isLoading: isSettingsLoading } = useDoc<SplashScreenSettings>(settingsRef);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setShowSplash(false);
        setSelectedDate(new Date());
      }, 1000); // Wait for fade out animation
    }, 2500); // Total splash duration

    return () => clearTimeout(timer);
  }, []);

  // Use a neutral default while loading to avoid "text flicker"
  const defaultSettings: SplashScreenSettings = {
    splashMode: 'text',
    splashText: '', // Neutral text while loading
    splashBgColor: '#3b82f6',
    splashTextColor: '#ffffff',
    splashFontSize: '32',
  };

  // If loading, we use neutral settings. Once loaded, we use the Firestore settings or the full defaults.
  const finalSettings = isSettingsLoading 
    ? defaultSettings 
    : (splashSettings || { ...defaultSettings, splashText: 'Lagon & Brousse NC' });

  if (showSplash) {
    return <SplashScreen settings={finalSettings} isExiting={isExiting} />;
  }

  if (!selectedDate) {
    return null;
  }

  const value = {
    selectedDate,
    setSelectedDate,
  };

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
