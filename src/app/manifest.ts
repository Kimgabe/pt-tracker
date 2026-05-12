import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PT Tracker',
    short_name: 'PT',
    description: '개인 운동 & 식단 트래커',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
