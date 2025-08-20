import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";   // 強制動態
export const revalidate = 0;              // 不快取，避免被預渲染

export async function GET() {
  const t0 = Date.now();
  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ ok:false, error:"MISSING_OPENAI_API_KEY" }), {
      status: 500, headers: { "content-type":"application/json", "cache-control":"no-store" }
    });
  }
  try {
    const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL, messages:[{ role:"user", content:"ping"}], max_tokens:1 })
    });
    const txt = await r.text();
    return new Response(JSON.stringify({
      ok: r.ok, status: r.status, model: env.OPENAI_MODEL, base: env.OPENAI_BASE_URL,
      latency_ms: Date.now()-t0, sample: txt.slice(0,160)
    }), { status: r.ok ? 200 : r.status, headers: { "content-type":"application/json", "cache-control":"no-store" }});
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:"UPSTREAM_ERROR", detail:String(e).slice(0,200) }), {
      status: 502, headers: { "content-type":"application/json", "cache-control":"no-store" }
    });
  }
}
