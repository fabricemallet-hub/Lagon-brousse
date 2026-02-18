'use client';

import { useJsApiLoader } from '@react-google-maps/api';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CreditCard } from 'lucide-react';

type GoogleMapsContextType = {
  isLoaded: boolean;
  loadError: Error | undefined;
};

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(
  undefined
);

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  // CLÉ API VÉRIFIÉE : AIzaSyDs6qQO274Ro2RD4lVkr8KztsZIecP-ZDk
  const googleMapsApiKey = "AIzaSyDs6qQO274Ro2RD4lVkr8KztsZIecP-ZDk";

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'lagon-brousse-google-maps',
    googleMapsApiKey: googleMapsApiKey,
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
        <div className="fixed top-4 left-4 right-4 z-[250] animate-in slide-in-from-top-4">
          <Alert variant="destructive" className="shadow-2xl border-2 bg-white text-destructive">
            <AlertCircle className="size-5" />
            <AlertTitle className="font-black uppercase text-sm mb-2">Erreur Critique Google Maps</AlertTitle>
            <AlertDescription className="text-xs font-medium leading-relaxed">
              Le service Google Maps a renvoyé l'erreur : <code className="font-black bg-red-50 px-1">{loadError.message}</code>.
              <br /><br />
              <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-100 space-y-3">
                <p className="flex items-center gap-2 font-black text-red-800 uppercase text-[10px] tracking-widest">
                  <CreditCard className="size-4" /> Action Requise : Activer la Facturation
                </p>
                <p className="text-slate-700">
                  L'erreur <strong>ExpiredKeyMapError</strong> signifie que votre clé API est valide mais que votre <strong>Compte de Facturation (Billing)</strong> n'est pas actif sur ce projet.
                </p>
                <div className="bg-white/50 p-3 rounded-xl border border-red-200">
                  <p className="italic text-red-900 font-bold">
                    {"Solution : Allez dans la Console Google Cloud > Facturation et liez une carte bancaire. Sans cela, les cartes resteront grises."}
                  </p>
                </div>
              </div>
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
