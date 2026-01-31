import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { LocationProvider } from '@/context/location-context';
import { DateProvider } from '@/context/date-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Marées et Terroir Calédonien',
  description:
    'Votre guide pour la mer et la terre en Nouvelle-Calédonie.',
};

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
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans')}>
        <DateProvider>
          <LocationProvider>
            <AppShell>{children}</AppShell>
          </LocationProvider>
        </DateProvider>
        <Toaster />
      </body>
    </html>
  );
}
