// app/api/pwa/diag/route.ts
import { NextRequest } from 'next/server'
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function ping(url: string) {
  const t0 = Date.now()
  try {
    const r = await fetch(url, { cache: 'no-store' })
    return { url, ok: r.ok, status: r.status, ms: Date.now() - t0, ct: r.headers.get('content-type') || '' }
  } catch (e: any) {
    return { url, ok: false, status: 0, ms: Date.now() - t0, error: String(e) }
  }
}

export async function GET(req: NextRequest) {
  const base = new URL('/', req.url).origin
  const urls = [
    `${base}/manifest.webmanifest`,
    `${base}/api/icon/192`,
    `${base}/api/icon/512`,
    `${base}/_models/openai/chat?q=ping`
  ]
  const results = await Promise.all(urls.map(ping))
  const [m, i192, i512, model] = results
  return Response.json({
    summary: {
      manifest_ok: m.ok,
      icon_192_ok: i192.ok && i192.ct.includes('image/png'),
      icon_512_ok: i512.ok && i512.ct.includes('image/png'),
      models_ping_ok: model.ok
    },
    results,
    now: new Date().toISOString()
  })
}
