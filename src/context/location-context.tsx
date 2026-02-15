
'use client';

import { locationsByRegion } from '@/lib/locations';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserAccount, Region } from '@/lib/types';

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
      }
      if (userProfile.lastSelectedLocation) {
        // We only set it if it belongs to the current region or after region is determined
        _setSelectedLocation(userProfile.lastSelectedLocation);
      }
    }

    setIsLocationLoading(false);
  }, [user, isUserLoading, userProfile, isProfileLoading]);

  const setSelectedRegion = useCallback((region: Region) => {
    _setSelectedRegion(region);
    const firstLoc = Object.keys(locationsByRegion[region])[0];
    _setSelectedLocation(firstLoc);
    
    if (userDocRef) {
      updateDoc(userDocRef, { 
        selectedRegion: region,
        lastSelectedLocation: firstLoc 
      }).catch(console.warn);
    }
  }, [userDocRef]);

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
