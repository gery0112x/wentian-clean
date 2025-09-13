import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'
export const contentType = 'image/png'

export async function GET(req: NextRequest) {
  const size = Number(new URL(req.url).searchParams.get('size') || '192')
  const fontSize = size === 512 ? 200 : 72
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
          color: '#fff',
          fontSize,
          fontWeight: 800,
        }}
      >
        無
      </div>
    ),
    { width: size, height: size }
  )
}
