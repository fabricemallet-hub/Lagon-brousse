'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useMemo } from 'react';

export type CalendarView = 'peche' | 'champs';

type CalendarViewContextType = {
  calendarView: CalendarView;
  setCalendarView: (view: CalendarView) => void;
};

const CalendarViewContext = createContext<CalendarViewContextType | undefined>(
  undefined
);

export function CalendarViewProvider({ children }: { children: ReactNode }) {
  const [calendarView, setCalendarView] = useState<CalendarView>('peche');

  const value = useMemo(() => ({
    calendarView,
    setCalendarView,
  }), [calendarView]);

  return (
    <CalendarViewContext.Provider value={value}>
      {children}
    </CalendarViewContext.Provider>
  );
}

export function useCalendarView() {
  const context = useContext(CalendarViewContext);
  if (context === undefined) {
    throw new Error('useCalendarView must be used within a CalendarViewProvider');
  }
  return context;
}
