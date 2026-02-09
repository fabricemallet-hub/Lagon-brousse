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
     * CRITIQUE : Nettoyage en mode développement pour éviter les erreurs de cache.
     */
    if (process.env.NODE_ENV === 'development') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      return;
    }

    // Enregistrement Production
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !swRegisteredRef.current) {
      swRegisteredRef.current = true;
      // On attend que la page soit totalement chargée pour ne pas ralentir le rendu initial
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('L&B NC: Service Worker enregistré sur le scope:', reg.scope))
          .catch((err) => {
            console.warn('L&B NC: Échec de l\'enregistrement du SW:', err);
            swRegisteredRef.current = false;
          });
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
