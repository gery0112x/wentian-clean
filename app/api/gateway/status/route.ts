import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

const b = (x?: string) => !!x && x.trim() !== "";

export async function GET() {
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

  // 寫入一筆日誌（沿用你現有的 _io_gate_logs 規則）
  let db_insert_ok = false, io_id: number | null = null, db_error: string | null = null;
  try {
    if (gateway_ok) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await supa
        .from("_io_gate_logs")
        .insert({ path: "/api/gateway/status", status: "probe", meta: { providers_enabled, provider_order, caps } })
        .select("id").single();
      if (error) throw error;
      db_insert_ok = true; io_id = data?.id ?? null;
    }
  } catch (e: any) { db_error = e?.message ?? "unknown"; }

  return NextResponse.json({
    gateway_ok,                // 代轉層是否基本可用
    providers_enabled,         // 已啟用供應商清單
    provider_order,            // 呼叫順序
    caps,                      // 上蓋（回合/日/月）
    keys_present,              // 各家金鑰是否存在（true/false）
    supabase_ok,               // DB 變數是否就緒
    db_insert_ok, io_id, db_error,
    ts: new Date().toISOString(),
    hint_zh: gateway_ok ? "代轉層可用；已寫入日誌" : "缺金鑰或缺服務角色金鑰(SUPABASE_SERVICE_ROLE_KEY)"
  }, { status: 200 });
}
