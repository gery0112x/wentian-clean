import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.SUPABASE_URL || (process.env as any).supabaseUrl;
  const key = process.env.SUPABASE_SERVICE_ROLE || (process.env as any).supabaseKey;
  if (!url || !key) return null;                // ← 不在頂層 throw
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) {
    // 缺 env 改在執行期回人話，不讓 build 掛
    return Response.json({ ok: false, error: "MISSING_SUPABASE_ENV" }, { status: 503 });
  }

  // TODO: 你的通知邏輯；先寫入一筆事件做占位即可
  const body = await req.json().catch(() => ({}));
  await sb.from("upgrade_events").insert({
    type: "notify",
    payload: body ?? {},
    created_at: new Date().toISOString()
  }).catch(() => null);

  return Response.json({ ok: true, step: "upgrade:notify (handler)" });
}
