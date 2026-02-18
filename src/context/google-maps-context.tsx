'use client';

import { useJsApiLoader } from '@react-google-maps/api';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type GoogleMapsContextType = {
  isLoaded: boolean;
  loadError: Error | undefined;
};

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(
  undefined
);

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  // CLÉ API CONFIRMÉE
  const googleMapsApiKey = "AIzaSyDs6qQO274Ro2RD4lVkr8KztsZIecP-ZDk";

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'lagon-brousse-google-maps',
    googleMapsApiKey: googleMapsApiKey,
    mapIds: ['satellite_id'],
    preventGoogleFontsLoading: true,
    version: 'weekly',
  });

  const value = useMemo(() => ({
    isLoaded,
    loadError,
  }), [isLoaded, loadError]);

  return (
    <GoogleMapsContext.Provider value={value}>
      {loadError && (
        <div className="fixed top-0 left-0 right-0 z-[200] p-4">
          <Alert variant="destructive" className="shadow-2xl border-2 bg-white">
            <AlertCircle className="size-4" />
            <AlertTitle className="font-black uppercase text-xs">Alerte Google Maps</AlertTitle>
            <AlertDescription className="text-[10px] font-medium leading-relaxed">
              Le service Google Maps signale une erreur : <strong>{loadError.message}</strong>. 
              Cela indique généralement que la clé API est expirée, désactivée ou que le compte de facturation (Billing) associé au projet <strong>studio-2943478321-f746e</strong> est inactif.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
}
