
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
 * Client-side component that wraps the application with all necessary providers.
 */
export function RootProviders({ children }: { children: ReactNode }) {
  const swRegisteredRef = useRef(false);

  useEffect(() => {
    // On n'enregistre le Service Worker que sur les domaines de production ou de test Firebase
    const isPublicUrl = window.location.hostname.includes('hosted.app') || 
                        window.location.hostname.includes('web.app') || 
                        window.location.hostname.includes('firebaseapp.com');

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !swRegisteredRef.current) {
      swRegisteredRef.current = true;
      
      // Enregistrement différé pour ne pas bloquer le chargement initial (important pour PWABuilder)
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('L&B NC: PWA Service Worker prêt.'))
          .catch((err) => {
            console.warn('L&B NC: Échec SW:', err);
            swRegisteredRef.current = false;
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
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
