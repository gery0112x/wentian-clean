// A/B/C fallback: static -> generated -> final placeholder
import type { NextRequest } from 'next/server'

const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8V3a0AAAAASUVORK5CYII='

function pickSize(sizeRaw: string | null) {
  const n = Number(sizeRaw || 0)
  if (n >= 384) return 512        // 就近原則
  if (n >= 144) return 192
  return 192
}

async function tryStatic(urlPath: string) {
  try {
    // 嘗試讀 public 靜態檔（若未來你真的放 /public/icons/icon-192.png）
    const res = await fetch(new URL(urlPath, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost').toString())
    if (res.ok && res.headers.get('content-type')?.includes('image/')) {
      const buf = Buffer.from(await res.arrayBuffer())
      return new Response(buf, {
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-icon-source': 'A-static'
        }
      })
    }
  } catch {}
  return null
}

function generated(size: number, tag: string) {
  const buf = Buffer.from(PNG_1x1_BASE64, 'base64') // 先用 1x1 佔位，之後要真 192/512 再換
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-icon-source': tag,
      'x-icon-size': String(size)
    }
  })
}

export async function GET(req: NextRequest, { params }: { params: { size: string } }) {
  const size = pickSize(params.size)
  // A: 試著讀 /icons/icon-*.png（若未來真的放檔）
  const a = await tryStatic(`/icons/icon-${size}.png`)
  if (a) return a

  // B: 產生佔位圖（可運作、長快取）
  return generated(size, 'B-generated')
}
