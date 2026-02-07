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
    // Enregistrement unique du Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !swRegisteredRef.current) {
      swRegisteredRef.current = true;
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('L&B NC: Service Worker actif');
        })
        .catch((err) => {
          console.error('L&B NC: Erreur SW:', err);
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
