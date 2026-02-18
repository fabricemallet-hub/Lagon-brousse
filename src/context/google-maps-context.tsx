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
  // CLÉ API UTILISÉE POUR LE PROJET studio-2943478321-f746e
  // Elle doit être autorisée pour "Maps JavaScript API" et "Identity Toolkit API"
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
              Le service Google Maps signale une erreur : <strong>{loadError.message}</strong>.<br /><br />
              <strong>ExpiredKeyMapError</strong> signifie que votre clé API est rejetée par Google. 
              Même si l'API est activée, vérifiez impérativement dans votre Console Google Cloud :<br />
              1. Que votre <strong>Compte de Facturation (Billing)</strong> est bien rattaché au projet.<br />
              2. Que la clé elle-même n'est pas marquée comme "Désactivée" dans l'onglet <strong>Identifiants</strong>.<br />
              3. Que le domaine <strong>https://studio.firebase.google.com/*</strong> est autorisé dans les restrictions HTTP.
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
