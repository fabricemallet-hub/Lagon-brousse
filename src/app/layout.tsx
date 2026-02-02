
import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { LocationProvider } from '@/context/location-context';
import { DateProvider } from '@/context/date-context';
import { CalendarViewProvider } from '@/context/calendar-view-context';
import './globals.css';
import { Suspense } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { GoogleMapsProvider } from '@/context/google-maps-context';

export const metadata: Metadata = {
  title: 'Lagon & Brousse NC',
  description:
    'Votre guide pour la mer et la terre en Nouvelle-Calédonie.',
  manifest: '/manifest.webmanifest',
};

function AppContent({ children }: { children: React.ReactNode }) {
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
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
