'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

type DateContextType = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

const DateContext = createContext<DateContextType | undefined>(
  undefined
);

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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
