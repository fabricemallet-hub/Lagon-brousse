
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

  // Use a neutral default while loading to avoid "blue flash"
  // We use the app background color or transparent to be seamless
  const defaultSettings: SplashScreenSettings = {
    splashMode: 'text',
    splashText: '', 
    splashBgColor: '#edf1f4', // Neutral off-white matching app background
    splashTextColor: 'transparent',
    splashFontSize: '32',
  };

  // If loading, we use neutral settings. Once loaded, we use the Firestore settings.
  const finalSettings = isSettingsLoading 
    ? defaultSettings 
    : (splashSettings || { ...defaultSettings, splashText: 'Lagon & Brousse NC', splashBgColor: '#3b82f6', splashTextColor: '#ffffff' });

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
