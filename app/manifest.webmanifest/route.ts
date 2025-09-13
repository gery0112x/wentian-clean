// app/manifest.webmanifest/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const manifest = {
    name: '無極入口',
    short_name: '無',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };

  return NextResponse.json(manifest, {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
}
