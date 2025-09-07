import { NextResponse } from "next/server";
export const runtime = "nodejs";

// 小白註解：把字串是否存在變成布林
const b = (x?: string) => !!x && x.trim() !== "";

export async function GET(req: Request) {
  // 讀你現成的治理變數（已存在於 Vercel）
  const providers_enabled = (process.env.WUJI_PROVIDERS_ENABLED || "")
    .split(",").map(s=>s.trim()).filter(Boolean);
  const provider_order = (process.env.WUJI_PROVIDER_ORDER || "")
    .split(",").map(s=>s.trim()).filter(Boolean);

  const caps = {
    per_turn: Number(process.env.WUJI_COST_CAP_PER_TURN ?? 0),
    per_day: Number(process.env.WUJI_DAILY_COST_CAP ?? 0),
    per_month: Number(process.env.WUJI_MONTHLY_COST_CAP ?? 0),
  };

  const keys_present = {
    openai: b(process.env.OPENAI_API_KEY),
    deepseek: b(process.env.DEEPSEEK_KEY) || b(process.env.DEEPSEEK_API_KEY),
    gemini: b(process.env.GEMINI_API_KEY),
    grok: b(process.env.GROK_API_KEY),
    xai: b(process.env.XAI_API_KEY),
  };

  const supabase_ok = {
    url: b(process.env.SUPABASE_URL) || b(process.env.NEXT_PUBLIC_SUPABASE_URL),
    service_role: b(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const gateway_ok =
    (keys_present.openai || keys_present.deepseek || keys_present.gemini || keys_present.grok || keys_present.xai)
    && supabase_ok.service_role;

  // 不再直接寫 _io_gate_logs，改「借用你已經 PASS 的 /api/wuji-check」
  let db_insert_ok_from_wuji_check = false;
  let io_id: number | null = null;
  try {
    const base = new URL(req.url).origin;              // 產生同站網址
    const res = await fetch(`${base}/api/wuji-check`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      db_insert_ok_from_wuji_check = !!j?.db_insert_ok;
      io_id = j?.io_id ?? null;
    }
  } catch {}

  return NextResponse.json({
    gateway_ok,
    providers_enabled,
    provider_order,
    caps,
    keys_present,
    supabase_ok,
    db_insert_ok_from_wuji_check, // 改看 wuji-check 的寫入結果
    io_id,
    ts: new Date().toISOString(),
    hint_zh: gateway_ok
      ? "代轉層可用；/api/wuji-check 已可寫入日誌"
      : "缺金鑰或缺 SUPABASE_SERVICE_ROLE_KEY（服務角色金鑰）"
  }, { status: 200 });
}
