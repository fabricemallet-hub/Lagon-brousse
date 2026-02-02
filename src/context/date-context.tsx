'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { AppLogo } from '@/components/icons';

function InitialLoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(100, prev + Math.floor(Math.random() * 10) + 5);
      });
    }, 150);

    return () => {
        clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="relative mb-8">
        <AppLogo className="size-24 text-primary" />
        <div className="absolute inset-0 flex items-center justify-center -z-10">
            <div className="size-28 rounded-full border-2 border-primary/20 animate-ping"></div>
        </div>
      </div>
      <div className="w-56">
        <Progress value={progress} className="h-2" />
        <p className="text-center text-sm text-muted-foreground mt-2">{progress}%</p>
      </div>
    </div>
  );
}

type DateContextType = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

const DateContext = createContext<DateContextType | undefined>(
  undefined
);

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
        setSelectedDate(new Date());
    }, 1800); // Let the animation play out

    return () => clearTimeout(timer);
  }, []);


  if (!selectedDate) {
    return <InitialLoadingScreen />;
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
