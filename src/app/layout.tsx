import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import './globals.css';
import { Suspense } from 'react';
import { RootProviders } from '@/components/root-providers';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Lagon & Brousse NC',
  description: 'Assistant intelligent pour le terroir calédonien (Pêche, Chasse, Jardinage)',
  applicationName: 'L&B NC',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#3498db',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#3498db" />
        <link rel="icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans overflow-x-hidden')}>
        <Suspense fallback={null}>
          <RootProviders>{children}</RootProviders>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
