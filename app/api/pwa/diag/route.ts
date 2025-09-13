// app/api/pwa/diag/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CheckResult = {
  ok: boolean;
  status: number;
  ct?: string;
  url: string;
  error?: string;
};

async function probe(url: string): Promise<CheckResult> {
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' });
    return {
      ok: r.ok,
      status: r.status,
      ct: r.headers.get('content-type') ?? undefined,
      url,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 0,
      url,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const [m, i192, i512, model] = await Promise.all([
    probe(`${origin}/manifest.webmanifest`),
    probe(`${origin}/icons/icon-192.png`),
    probe(`${origin}/icons/icon-512.png`),
    probe(`${origin}/_models`), // 若不存在會回 0/非 2xx，不影響其它檢查
  ]);

  // ✅ 嚴格模式下作空值保護
  const icon192Ok = Boolean(i192.ok && (i192.ct?.includes('image/png') ?? false));
  const icon512Ok = Boolean(i512.ok && (i512.ct?.includes('image/png') ?? false));

  const healthy = Boolean(m.ok && icon192Ok && icon512Ok);

  const body = {
    summary: {
      manifest_ok: m.ok,
      icon_192_ok: icon192Ok,
      icon_512_ok: icon512Ok,
      models_ping_ok: model.ok,
      healthy,
    },
    debug: { manifest: m, icon_192: i192, icon_512: i512, models: model },
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
