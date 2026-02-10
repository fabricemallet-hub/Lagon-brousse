'use client';

import { useEffect, ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { GoogleMapsProvider } from '@/context/google-maps-context';
import { CalendarViewProvider } from '@/context/calendar-view-context';
import { DateProvider } from '@/context/date-context';
import { LocationProvider } from '@/context/location-context';
import { CgvConsentGuard } from '@/components/cgv-consent-guard';
import { AppShell } from '@/components/app-shell';

export function RootProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // 1. Nettoyage des SW obsolètes
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          // On désinstalle tout SW qui n'est pas à la racine correcte
          if (registration.active?.scriptURL.includes('cloudworkstations.dev')) {
            registration.unregister();
          }
        }
      });

      // 2. Enregistrement simplifié pour PWABuilder
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(() => console.log('L&B NC: PWA Service Worker prêt.'))
          .catch((err) => console.warn('L&B NC: Erreur SW:', err));
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
