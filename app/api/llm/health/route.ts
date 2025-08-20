import { env } from "@/lib/env";
export const runtime = 'nodejs';

export async function GET() {
  const t0 = Date.now();
  if (!env.OPENAI_API_KEY) {
    return Response.json({ ok:false, error:"MISSING_OPENAI_API_KEY" }, { status:500 });
  }
  try {
    const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL, messages:[{ role:"user", content:"ping"}], max_tokens:1 })
    });
    const txt = await r.text();
    return Response.json({
      ok: r.ok, status: r.status,
      model: env.OPENAI_MODEL, base: env.OPENAI_BASE_URL,
      latency_ms: Date.now()-t0,
      sample: txt.slice(0,160)
    }, { status: r.ok ? 200 : r.status });
  } catch (e:any) {
    return Response.json({ ok:false, error:"UPSTREAM_ERROR", detail:String(e).slice(0,200) }, { status:502 });
  }
}
