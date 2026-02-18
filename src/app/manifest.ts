import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'nc.lagonbrousse.app',
    name: 'Lagon & Brousse NC',
    short_name: 'L&B NC',
    description: 'Assistant intelligent pour le terroir calédonien (Pêche, Chasse, Jardinage)',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3498db',
    orientation: 'portrait',
    lang: 'fr-FR',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
