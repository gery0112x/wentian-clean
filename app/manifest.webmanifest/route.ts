import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function GET() {
  const body = {
    name: '無極入口',
    short_name: '無極',
    start_url: '/home',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      { src: '/api/assets/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/api/assets/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }
  return NextResponse.json(body, { headers: { 'content-type': 'application/manifest+json' } })
}
