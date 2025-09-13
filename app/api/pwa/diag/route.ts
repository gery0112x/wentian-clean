// app/api/pwa/diag/route.ts
import { NextResponse } from 'next/server';
export const runtime = 'edge';

type Snap = {
  ok: boolean;
  status: number;
  ct: string | null;
  url: string | null;
  err?: string;
};

function snap(res: Response | null, err?: unknown): Snap {
  if (res) {
    return {
      ok: res.ok,
      status: res.status,
      ct: res.headers.get('content-type'),
      url: res.url,
    };
  }
  return { ok: false, status: 0, ct: null, url: null, err: String(err) };
}

export async function GET(req: Request) {
  const base = new URL(req.url).origin;

  const [m, i192, i512] = await Promise.allSettled([
    fetch(`${base}/manifest.webmanifest`, { cache: 'no-store' }),
    fetch(`${base}/icons/icon-192.png`, { cache: 'no-store' }),
    fetch(`${base}/icons/icon-512.png`, { cache: 'no-store' }),
  ]);

  const M = m.status === 'fulfilled' ? snap(m.value) : snap(null, m.reason);
  const I192 = i192.status === 'fulfilled' ? snap(i192.value) : snap(null, i192.reason);
  const I512 = i512.status === 'fulfilled' ? snap(i512.value) : snap(null, i512.reason);

  const healthy =
    M.ok &&
    I192.ok && (I192.ct?.includes('image/png') ?? false) &&
    I512.ok && (I512.ct?.includes('image/png') ?? false);

  return NextResponse.json(
    {
      summary: {
        manifest_ok: M.ok,
        icon_192_ok: I192.ok && (I192.ct?.includes('image/png') ?? false),
        icon_512_ok: I512.ok && (I512.ct?.includes('image/png') ?? false),
        healthy,
      },
      debug: { manifest: M, icon_192: I192, icon_512: I512 },
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
