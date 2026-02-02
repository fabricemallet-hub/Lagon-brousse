'use client';

import { locations as locationsMap } from '@/lib/locations';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';

type LocationContextType = {
  locations: string[];
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
  isLocationLoading: boolean;
};

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export function LocationProvider({ children }: { children: ReactNode }) {
  const locations = Object.keys(locationsMap);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedLocation, _setSelectedLocation] = useState<string>('Nouméa');
  const [isLocationLoading, setIsLocationLoading] = useState(true);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    // While any user or profile data is loading, the location is loading.
    if (isUserLoading || (user && isProfileLoading)) {
      setIsLocationLoading(true);
      return;
    }
    
    // Once loading is finished...
    // If we have a user with a saved location, use it.
    if (userProfile && userProfile.lastSelectedLocation && locations.includes(userProfile.lastSelectedLocation)) {
      _setSelectedLocation(userProfile.lastSelectedLocation);
    } else {
      // Otherwise (no user, or user without saved location), use default.
      _setSelectedLocation('Nouméa');
    }

    // In any case, loading is finished now.
    setIsLocationLoading(false);

  }, [user, isUserLoading, userProfile, isProfileLoading]);


  const setSelectedLocation = useCallback((location: string) => {
    _setSelectedLocation(location);
    if (userDocRef) {
      updateDoc(userDocRef, { lastSelectedLocation: location }).catch(error => {
        // Not critical, can fail silently or with a console log.
        console.warn("Could not save last selected location:", error);
      });
    }
  }, [userDocRef]);

  const value = {
    locations,
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
