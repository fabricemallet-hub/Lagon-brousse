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
      // 1. Nettoyage des SW d'origine différente (conflits cloudworkstations)
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          if (registration.active?.scriptURL.includes('cloudworkstations.dev')) {
            registration.unregister();
          }
        }
      });

      // 2. Enregistrement propre
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(() => console.log('L&B NC: Service Worker opérationnel.'))
          .catch((err) => console.warn('L&B NC: Erreur enregistrement SW:', err));
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
