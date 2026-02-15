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

// Move regions list outside to make it static and stable
const REGIONS_LIST = Object.keys(locationsByRegion);

export function LocationProvider({ children }: { children: ReactNode }) {
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

  const availableLocations = useMemo(() => {
    return Object.keys(locationsByRegion[selectedRegion] || {}).sort();
  }, [selectedRegion]);

  useEffect(() => {
    if (isUserLoading || (user && isProfileLoading)) {
      setIsLocationLoading(true);
      return;
    }
    
    if (userProfile) {
      if (userProfile.selectedRegion && REGIONS_LIST.includes(userProfile.selectedRegion)) {
        if (selectedRegion !== userProfile.selectedRegion) {
          _setSelectedRegion(userProfile.selectedRegion);
          // Only update date if it's different to avoid loops
          const regionalNow = getRegionalNow(userProfile.selectedRegion);
          setSelectedDate(regionalNow);
        }
      }
      if (userProfile.lastSelectedLocation && selectedLocation !== userProfile.lastSelectedLocation) {
        _setSelectedLocation(userProfile.lastSelectedLocation);
      }
    }

    setIsLocationLoading(false);
  }, [user, isUserLoading, userProfile, isProfileLoading, setSelectedDate, selectedRegion, selectedLocation]);

  const setSelectedRegion = useCallback((region: Region) => {
    _setSelectedRegion(region);
    const firstLoc = Object.keys(locationsByRegion[region])[0];
    _setSelectedLocation(firstLoc);
    
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

  const value = useMemo(() => ({
    regions: REGIONS_LIST,
    selectedRegion,
    setSelectedRegion,
    locations: availableLocations,
    selectedLocation,
    setSelectedLocation,
    isLocationLoading
  }), [selectedRegion, setSelectedRegion, availableLocations, selectedLocation, setSelectedLocation, isLocationLoading]);

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
