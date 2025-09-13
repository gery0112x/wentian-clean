// 讓 /icons/icon-192.png、/icons/icon-512.png 永遠 200（A/B/C fallback）
import type { NextRequest } from 'next/server'

const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8V3a0AAAAASUVORK5CYII='

function parseSize(file: string) {
  const m = file.match(/icon-(\d+)\.png$/i)
  const n = m ? Number(m[1]) : 192
  if (n >= 384) return 512
  if (n >= 144) return 192
  return 192
}

async function tryApi(size: number, req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = `/api/assets/icon/${size}`
  try {
    const res = await fetch(url.toString())
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || 'image/png'
      return new Response(buf, {
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-icon-source': 'B-from-api',
          'x-icon-size': String(size)
        }
      })
    }
  } catch {}
  return null
}

export async function GET(req: NextRequest, { params }: { params: { file: string } }) {
  const size = parseSize(params.file)

  // A: 若未來真的放了 /public/icons/icon-*.png，Next 會直接走靜態；此 route 是保底
  // B: 轉呼叫 API fallback
  const b = await tryApi(size, req)
  if (b) return b

  // C: 最終保底（佔位）
  const buf = Buffer.from(PNG_1x1_BASE64, 'base64')
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-icon-source': 'C-placeholder',
      'x-icon-size': String(size)
    }
  })
}
