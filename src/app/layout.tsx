'use client';

import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { LocationProvider } from '@/context/location-context';
import { DateProvider } from '@/context/date-context';
import { CalendarViewProvider } from '@/context/calendar-view-context';
import './globals.css';
import { Suspense, useEffect } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { GoogleMapsProvider } from '@/context/google-maps-context';

function AppContent({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('Service Worker enregistré avec succès:', registration.scope);
          },
          (err) => {
            console.error('Échec de l\'enregistrement du Service Worker:', err);
          }
        );
      });
    }
  }, []);

  return (
    <FirebaseClientProvider>
      <GoogleMapsProvider>
        <CalendarViewProvider>
          <DateProvider>
            <LocationProvider>
              <AppShell>{children}</AppShell>
            </LocationProvider>
          </DateProvider>
        </CalendarViewProvider>
      </GoogleMapsProvider>
    </FirebaseClientProvider>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="initial-scale=1, minimum-scale=0.1, maximum-scale=5, user-scalable=yes" />
        <link rel="icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans')}>
        <Suspense fallback={null}>
         <AppContent>{children}</AppContent>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}