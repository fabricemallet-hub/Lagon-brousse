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
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'L&B NC',
  },
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
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans overflow-x-hidden pt-[env(safe-area-inset-top)]')}>
        <Suspense fallback={null}>
          <RootProviders>{children}</RootProviders>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
