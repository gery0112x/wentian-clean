// app/api/llm/health/route.ts
export const runtime = 'nodejs';

export async function GET() {
  const started = Date.now();
  const key   = process.env.OPENAI_API_KEY;
  const base  = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!key) {
    return Response.json({ ok:false, error:'MISSING_OPENAI_API_KEY' }, { status:500 });
  }
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages:[{ role:'user', content:'ping' }], max_tokens:1 })
    });
    const body = await r.text();
    return Response.json({
      ok: r.ok, status: r.status, model, base,
      latency_ms: Date.now() - started,
      sample: body.slice(0, 200)
    }, { status: r.ok ? 200 : r.status });
  } catch (e:any) {
    return Response.json({ ok:false, error:'UPSTREAM_ERROR', detail: String(e).slice(0,200) }, { status:502 });
  }
}
