'use client';

import { locationsByRegion } from '@/lib/locations';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserAccount, Region } from '@/lib/types';
import { useDate } from './date-context';
import { getRegionalNow } from '@/lib/utils';

type LocationContextType = {
  regions: string[];
  selectedRegion: Region;
  setSelectedRegion: (region: Region) => void;
  locations: string[];
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
  isLocationLoading: boolean;
};

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export function LocationProvider({ children }: { children: ReactNode }) {
  const regions = Object.keys(locationsByRegion);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { setSelectedDate } = useDate();
  
  const [selectedRegion, _setSelectedRegion] = useState<Region>('CALEDONIE');
  const [selectedLocation, _setSelectedLocation] = useState<string>('Nouméa');
  const [isLocationLoading, setIsLocationLoading] = useState(true);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  // Filtered locations based on selected region
  const availableLocations = useMemo(() => {
    return Object.keys(locationsByRegion[selectedRegion] || {}).sort();
  }, [selectedRegion]);

  useEffect(() => {
    if (isUserLoading || (user && isProfileLoading)) {
      setIsLocationLoading(true);
      return;
    }
    
    if (userProfile) {
      if (userProfile.selectedRegion && regions.includes(userProfile.selectedRegion)) {
        _setSelectedRegion(userProfile.selectedRegion);
        // On synchronise la date affichée au chargement
        setSelectedDate(getRegionalNow(userProfile.selectedRegion));
      }
      if (userProfile.lastSelectedLocation) {
        _setSelectedLocation(userProfile.lastSelectedLocation);
      }
    }

    setIsLocationLoading(false);
  }, [user, isUserLoading, userProfile, isProfileLoading, setSelectedDate, regions]);

  const setSelectedRegion = useCallback((region: Region) => {
    _setSelectedRegion(region);
    const firstLoc = Object.keys(locationsByRegion[region])[0];
    _setSelectedLocation(firstLoc);
    
    // CRITIQUE : Si on change de région, on recalcule "Aujourd'hui" pour cette région
    // (Tahiti a 21h de retard sur la NC, la date peut donc changer)
    setSelectedDate(getRegionalNow(region));
    
    if (userDocRef) {
      updateDoc(userDocRef, { 
        selectedRegion: region,
        lastSelectedLocation: firstLoc 
      }).catch(console.warn);
    }
  }, [userDocRef, setSelectedDate]);

  const setSelectedLocation = useCallback((location: string) => {
    _setSelectedLocation(location);
    if (userDocRef) {
      updateDoc(userDocRef, { lastSelectedLocation: location }).catch(console.warn);
    }
  }, [userDocRef]);

  const value = {
    regions: [...regions],
    selectedRegion,
    setSelectedRegion,
    locations: availableLocations,
    selectedLocation,
    setSelectedLocation,
    isLocationLoading
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
