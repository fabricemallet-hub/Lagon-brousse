'use client';

import { cn } from '@/lib/utils';
import './globals.css';
import { Suspense } from 'react';
import { RootProviders } from '@/components/root-providers';

/**
 * Root Layout - Version simplifiée pour éviter les erreurs de chargement de chunks.
 * La gestion des métadonnées et du Toaster est déportée ou sécurisée.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <title>Lagon & Brousse NC</title>
        <meta name="description" content="Assistant intelligent pour le terroir calédonien" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans overflow-x-hidden pt-[env(safe-area-inset-top)]')}>
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-slate-900 text-white font-black uppercase">Initialisation...</div>}>
          <RootProviders>{children}</RootProviders>
        </Suspense>
      </body>
    </html>
  );
}
