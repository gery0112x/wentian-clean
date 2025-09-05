// pages/api/wuji-check.ts
import type { NextApiRequest, NextApiResponse } from "next";

// 1) 檢查必要環境變數是否「有載入」且數值型可轉成數字
function envCheck() {
  const required = [
    "OPENAI_API_KEY","GROK_API_KEY","DEEPSEEK_KEY","GEMINI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "WUJI_COST_CAP_PER_TURN","WUJI_DAILY_COST_CAP","WUJI_MONTHLY_COST_CAP",
    "WUJI_TZ","WUJI_REPORT_EMAIL",
    "WUJI_PROVIDERS_ENABLED","WUJI_PROVIDER_ORDER","WUJI_GATE_PATH","ALLOWED_ORIGINS",
    "NEXT_PUBLIC_UI_LAYOUT","NEXT_PUBLIC_UI_CARD_MODE","NEXT_PUBLIC_UI_DENSITY","NEXT_PUBLIC_THEME",
    "WUJI_WENJIE_DRIFT_ALERT"
  ] as const;

  const present: Record<string, boolean> = {};
  for (const k of required) present[k] = Boolean(process.env[k]?.toString().trim());

  const missing = Object.entries(present).filter(([,v])=>!v).map(([k])=>k);

  const nums = ["WUJI_COST_CAP_PER_TURN","WUJI_DAILY_COST_CAP","WUJI_MONTHLY_COST_CAP","WUJI_WENJIE_DRIFT_ALERT"] as const;
  const numeric_bad = nums.filter(k => {
    const v = process.env[k];
    return !(typeof v === "string" && v.trim().length>0 && !Number.isNaN(Number(v)));
  });

  return { ok: missing.length===0 && numeric_bad.length===0, missing, numeric_bad };
}

// 2) 用 Supabase REST 寫一筆 _io_gate_logs（server 端，僅用 service role）
//    將 body 型別定義為 unknown，避免 TS 報「string 不可指派給 null」
async function writeSmokeLog(): Promise<{ ok: boolean; status: number; body: unknown; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { ok: false, status: 0, body: null, error: "Supabase env missing" };
  }

  const rid =
    (globalThis as any).crypto?.randomUUID?.() ??
    `${Date.now()}-wuji`;

  const row = {
    ts: new Date().toISOString(),
    user_id: "wuji-smoke",
    route: "/api/wuji-check",
    provider: "env-check",
    model: "n/a",
    tokens_in: 0,
    tokens_out: 0,
    cost: 0,
    status: "ok",
    request_id: rid,
    meta: { source: "wuji-check" }
  };

  try {
    const r = await fetch(`${url}/rest/v1/_io_gate_logs`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    });

    const body: unknown = r.ok ? "inserted" : await r.text();
    return { ok: r.ok, status: r.status, body, error: null };
  } catch (e: any) {
    return { ok: false, status: 0, body: null, error: e?.message || String(e) };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const env = envCheck();
  const db = await writeSmokeLog();

  res.status(200).json({
    runtime: "node-serverless",
    env_ok: env.ok,
    missing: env.missing,
    numeric_bad: env.numeric_bad,
    db_insert_ok: db.ok,
    db_status: db.status,
    db_error: db.error ?? null,
    db_body: db.body
  });
}
