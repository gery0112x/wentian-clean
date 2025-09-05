// pages/api/wuji-check.js
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  // 1) 檢查必要環境變數是否「有載入」且數值型可轉成數字
  const required = [
    "OPENAI_API_KEY","GROK_API_KEY","DEEPSEEK_KEY","GEMINI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "WUJI_COST_CAP_PER_TURN","WUJI_DAILY_COST_CAP","WUJI_MONTHLY_COST_CAP",
    "WUJI_TZ","WUJI_REPORT_EMAIL",
    "WUJI_PROVIDERS_ENABLED","WUJI_PROVIDER_ORDER","WUJI_GATE_PATH","ALLOWED_ORIGINS",
    "NEXT_PUBLIC_UI_LAYOUT","NEXT_PUBLIC_UI_CARD_MODE","NEXT_PUBLIC_UI_DENSITY","NEXT_PUBLIC_THEME",
    "WUJI_WENJIE_DRIFT_ALERT"
  ];

  const present = {};
  for (const k of required) present[k] = !!(process.env[k] && String(process.env[k]).trim());
  const missing = Object.entries(present).filter(([,v]) => !v).map(([k]) => k);

  const numericKeys = ["WUJI_COST_CAP_PER_TURN","WUJI_DAILY_COST_CAP","WUJI_MONTHLY_COST_CAP","WUJI_WENJIE_DRIFT_ALERT"];
  const numeric_bad = numericKeys.filter(k => Number.isNaN(Number(process.env[k])));

  // 2) 寫一筆 _io_gate_logs（用 Supabase REST；不會曝露金鑰）
  let db = { ok:false, status:0, body:null, error:null };
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
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
        request_id: randomUUID(),
        meta: { source: "wuji-check" }
      };
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
      db.ok = r.ok;
      db.status = r.status;
      db.body = r.ok ? "inserted" : await r.text();
    } else {
      db.error = "Supabase env missing";
    }
  } catch (e) {
    db.error = e?.message || String(e);
  }

  res.status(200).json({
    runtime: "node",
    env_ok: missing.length===0 && numeric_bad.length===0,
    missing, numeric_bad,
    db_insert_ok: db.ok, db_status: db.status, db_error: db.error, db_body: db.body
  });
}
