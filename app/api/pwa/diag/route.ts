// app/api/pwa/diag/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function ping(url: string) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    const ct = res.headers.get('content-type') || ''
    const ok = res.ok
    const ms = Date.now() - t0
    return { url, ok, status: res.status, ms, ct }
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
    `${base}/_models/openai/chat?q=ping`, // 經 rewrites 轉 /api/*
    `${base}/_r5/status`                    // 若無可忽略
  ]
  const checks = await Promise.all(urls.map(ping))

  // 彙整
  const summary = {
    manifest_ok: checks[0]?.ok === true,
    icon_192_ok: checks[1]?.ok === true && (checks[1]?.ct.includes('image/png')),
    icon_512_ok: checks[2]?.ok === true && (checks[2]?.ct.includes('image/png')),
    models_ping_ok: checks[3]?.ok === true,
    r5_status_ok: checks[4]?.ok ?? null,
  }

  // 除錯資訊
  const debug = {
    now: new Date().toISOString(),
    user_agent: req.headers.get('user-agent') || '',
    results: checks
  }

  return new Response(JSON.stringify({ summary, debug }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}
