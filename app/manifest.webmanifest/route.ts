// app/manifest.webmanifest/route.ts
import { NextResponse } from 'next/server';

// Edge 可加快首包
export const runtime = 'edge';

export async function GET() {
  const manifest = {
    name: '無極入口',
    short_name: '無',
    start_url: '/home',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      // 正式建議的 MIME
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
  });
}
