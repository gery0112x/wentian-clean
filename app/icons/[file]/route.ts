// app/icons/[file]/route.ts
// runtime: Node.js（可用 zlib）— 產生真 192/512 PNG，清除 1x1 警告
import type { NextRequest } from 'next/server'
import { deflateSync } from 'zlib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** CRC32（PNG 需要） */
function crc32(buf: Uint8Array) {
  let c = ~0 >>> 0
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff]
  }
  return (~c) >>> 0
}
const table = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

/** 產生單色 PNG（真實 size×size，RGBA） */
function makeSolidPNG(size: number, rgba: [number, number, number, number]) {
  const [r, g, b, a] = rgba
  // 每列：1 byte filter(0) + size * 4 bytes
  const row = new Uint8Array(1 + size * 4)
  row[0] = 0
  for (let i = 0; i < size; i++) {
    row[1 + i * 4 + 0] = r
    row[1 + i * 4 + 1] = g
    row[1 + i * 4 + 2] = b
    row[1 + i * 4 + 3] = a
  }
  const raw = new Uint8Array((1 + size * 4) * size)
  for (let y = 0; y < size; y++) raw.set(row, y * (1 + size * 4))
  const compressed = deflateSync(raw)

  // 構建 PNG
  const sig = Uint8Array.from([137,80,78,71,13,10,26,10])
  function chunk(type: string, data: Uint8Array) {
    const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length)
    const typ = new TextEncoder().encode(type)
    const crcIn = new Uint8Array(typ.length + data.length)
    crcIn.set(typ, 0); crcIn.set(data, typ.length)
    const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(crcIn))
    return new Uint8Array([...len, ...typ, ...data, ...crc])
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, size)            // width
  dv.setUint32(4, size)            // height
  ihdr[8] = 8                      // bit depth
  ihdr[9] = 6                      // color type RGBA
  ihdr[10] = 0                     // compression
  ihdr[11] = 0                     // filter
  ihdr[12] = 0                     // interlace

  const iend = new Uint8Array(0)
  const png = new Uint8Array(
    sig.length +
    (12 + 13) +                     // IHDR
    (12 + compressed.length) +      // IDAT
    (12)                            // IEND
  )
  let off = 0
  png.set(sig, off); off += sig.length
  png.set(chunk('IHDR', ihdr), off); off += 12 + 13
  png.set(chunk('IDAT', compressed), off); off += 12 + compressed.length
  png.set(chunk('IEND', iend), off)

  return png
}

/** 嘗試讀靜態（若你之後真的放 /public/icons/icon-*.png 就會命中） */
async function tryStatic(pathname: string) {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost'
    const res = await fetch(new URL(pathname, base).toString())
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

function pickSize(file: string) {
  const m = file.match(/icon-(\d+)(?:-maskable)?\.png$/i)
  const n = m ? Number(m[1]) : 192
  if (n >= 384) return 512
  if (n >= 144) return 192
  return 192
}

/** 主流程：A 靜態 → B 動態產生（真尺寸） → C 最終保底 */
export async function GET(req: NextRequest, { params }: { params: { file: string } }) {
  const file = params.file || ''
  const size = pickSize(file)

  // A: 靜態
  const a = await tryStatic(`/icons/${file}`)
  if (a) return a

  // B: 動態產生（主題深色 #111827，maskable 用透明背景）
  const isMaskable = /-maskable\.png$/i.test(file)
  const rgba: [number, number, number, number] = isMaskable
    ? [17, 24, 39, 0]     // 透明背景（給 maskable）
    : [17, 24, 39, 255]   // 實心深色
  const png = makeSolidPNG(size, rgba)
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-icon-source': 'B-generated',
      'x-icon-size': String(size)
    }
  })
}
