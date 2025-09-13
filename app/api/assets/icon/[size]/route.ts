// app/api/icon/[size]/route.ts
import React from 'react'
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: { size?: string } }) {
  const n = Number(ctx?.params?.size)
  const s = Number.isFinite(n) ? Math.max(48, Math.min(1024, n)) : 192
  const font = Math.round(s * 0.42)

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#111827', color: '#fff', fontSize: font, fontWeight: 800
      }}>
        無
      </div>
    ),
    { width: s, height: s }
  )
}
