'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { GoogleMapsProvider } from '@/context/google-maps-context';
import { CalendarViewProvider } from '@/context/calendar-view-context';
import { DateProvider } from '@/context/date-context';
import { LocationProvider } from '@/context/location-context';
import { CgvConsentGuard } from '@/components/cgv-consent-guard';
import { AppShell } from '@/components/app-shell';

/**
 * Client-side component that wraps the application with all necessary providers
 * and handles client-only logic like Service Worker registration.
 */
export function RootProviders({ children }: { children: ReactNode }) {
  const swRegisteredRef = useRef(false);

  useEffect(() => {
    /**
     * CRITIQUE : Nettoyage des Service Workers en mode développement.
     * 
     * En environnement de développement (Firebase Studio / Workstations), le cache du 
     * Service Worker entre souvent en conflit avec le rechargement à chaud (HMR) 
     * de Next.js. Cela provoque des erreurs de type "ChunkLoadError".
     */
    if (process.env.NODE_ENV === 'development') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          if (registrations.length > 0) {
            console.log('L&B NC: Nettoyage des SW en mode développement...');
            for (const registration of registrations) {
              registration.unregister();
            }
          }
        });
      }
      return;
    }

    // Enregistrement unique du Service Worker pour la production uniquement
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !swRegisteredRef.current) {
      swRegisteredRef.current = true;
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('L&B NC: Service Worker enregistré (Production)');
        })
        .catch((err) => {
          console.error('L&B NC: Échec de l\'enregistrement du SW:', err);
          swRegisteredRef.current = false;
        });
    }
  }, []);

  return (
    <FirebaseClientProvider>
      <GoogleMapsProvider>
        <CalendarViewProvider>
          <DateProvider>
            <LocationProvider>
              <CgvConsentGuard>
                <AppShell>{children}</AppShell>
              </CgvConsentGuard>
            </LocationProvider>
          </DateProvider>
        </CalendarViewProvider>
      </GoogleMapsProvider>
    </FirebaseClientProvider>
  );
}
