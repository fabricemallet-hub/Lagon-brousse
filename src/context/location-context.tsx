'use client';

import { getAvailableLocations } from '@/lib/data';
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

type LocationContextType = {
  locations: string[];
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
};

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export function LocationProvider({ children }: { children: ReactNode }) {
  const locations = getAvailableLocations();
  const [selectedLocation, setSelectedLocation] = useState<string>('Nouméa');

  const value = {
    locations,
    selectedLocation,
    setSelectedLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
