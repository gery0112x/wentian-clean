import { assertModel } from '../../../_models/_shared/model-allow';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ ok: true, provider: 'grok', hint: 'POST JSON to chat' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const err = assertModel('grok', body?.model);
    if (err) return err;

    const gw = process.env.AI_GATEWAY_URL || process.env.GATEWAY_URL;
    if (!gw) {
      return new Response(JSON.stringify({ ok:false, error:'MISSING_GATEWAY_URL', hint:'set AI_GATEWAY_URL=https://<gateway-domain>' }), { status: 500 });
    }

    const r = await fetch(`${gw}/grok/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Stream through
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error:'ROUTE_ERROR', message: String(e?.message || e) }), { status: 500 });
  }
}