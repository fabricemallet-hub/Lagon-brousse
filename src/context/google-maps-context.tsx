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
  // CLÉ API : Assurez-vous qu'elle est définie dans .env.local 
  // sous le nom NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'lagon-brousse-google-maps',
    googleMapsApiKey: googleMapsApiKey || "",
    // Map ID spécifique pour le mode satellite haute fidélité
    mapIds: ['satellite_id'],
    preventGoogleFontsLoading: true,
    // On force l'utilisation du projet courant
    version: 'weekly',
  });

  const value = useMemo(() => ({
    isLoaded,
    loadError,
  }), [isLoaded, loadError]);

  if (!googleMapsApiKey && typeof window !== 'undefined') {
    console.error("ERREUR : NEXT_PUBLIC_GOOGLE_MAPS_API_KEY est manquante dans les variables d'environnement.");
  }

  return (
    <GoogleMapsContext.Provider value={value}>
      {loadError && (
        <div className="fixed top-0 left-0 right-0 z-[200] p-4">
          <Alert variant="destructive" className="shadow-2xl border-2">
            <AlertCircle className="size-4" />
            <AlertTitle className="font-black uppercase text-xs">Erreur Google Maps</AlertTitle>
            <AlertDescription className="text-[10px] font-medium leading-relaxed">
              Impossible de charger la carte. Vérifiez les restrictions de votre clé API (Referrer) dans la Google Cloud Console pour le projet studio-2943478321-f746e.
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
