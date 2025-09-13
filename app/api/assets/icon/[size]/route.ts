// A: public/icons/icon-<size>.png → B: /api/og/icon?size= → C: 1x1 fallback
import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

const ONE_BY_ONE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgMBgYlq8j8AAAAASUVORK5CYII=',
  'base64'
)

export async function GET(req: NextRequest, { params }: { params: { size: string } }) {
  const size = ['192','512'].includes(params.size) ? params.size : '192'
  const rel = `/icons/icon-${size}.png`
  const abs = path.join(process.cwd(), 'public', rel)

  // A: 靜態檔
  try {
    const file = await fs.readFile(abs)
    return new NextResponse(file, { headers: { 'content-type': 'image/png', 'x-src': 'A-static' } })
  } catch {}

  // B: Edge 動態
  try {
    const url = new URL(`/api/og/icon?size=${size}`, req.url)
    const r = await fetch(url.toString(), { cache: 'no-store' })
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer())
      return new NextResponse(buf, { headers: { 'content-type': 'image/png', 'x-src': 'B-dynamic' } })
    }
  } catch {}

  // C: 1x1 最小保底
  return new NextResponse(ONE_BY_ONE, { headers: { 'content-type': 'image/png', 'x-src': 'C-fallback' } })
}
