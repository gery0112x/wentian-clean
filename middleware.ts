// 無極 v2.1 － Vercel 環境變數健康檢查（通用，App/Pages 皆可）
// 放在 repo 根目錄即可生效。只在 /wuji-health 這個路徑回傳 JSON。
// 不輸出任何金鑰值，只回 missing/numeric_bad 名稱清單。

import { NextResponse } from "next/server";

export const config = {
  matcher: ["/wuji-health"],
};

export function middleware() {
  const required = [
    "OPENAI_API_KEY","GROK_API_KEY","DEEPSEEK_KEY","GEMINI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "WUJI_COST_CAP_PER_TURN","WUJI_DAILY_COST_CAP","WUJI_MONTHLY_COST_CAP",
    "WUJI_TZ","WUJI_REPORT_EMAIL",
    "WUJI_PROVIDERS_ENABLED","WUJI_PROVIDER_ORDER","WUJI_GATE_PATH","ALLOWED_ORIGINS",
    "NEXT_PUBLIC_UI_LAYOUT","NEXT_PUBLIC_UI_CARD_MODE","NEXT_PUBLIC_UI_DENSITY","NEXT_PUBLIC_THEME",
    "WUJI_WENJIE_DRIFT_ALERT"
  ];
  const optional = ["WUJI_CURRENCY","UPGRADER_WEBHOOK_TOKEN","GITHUB_REPO","GITHUB_BRANCH","GITHUB_TOKEN"];

  const present: Record<string, boolean> = {};
  for (const k of required) present[k] = !!process.env[k]?.toString().trim();

  const missing = Object.entries(present).filter(([,v])=>!v).map(([k])=>k);

  const nums = ["WUJI_COST_CAP_PER_TURN","WUJI_DAILY_COST_CAP","WUJI_MONTHLY_COST_CAP","WUJI_WENJIE_DRIFT_ALERT"];
  const numeric_bad = nums.filter(k => {
    const v = process.env[k];
    return !(typeof v === "string" && v.trim().length>0 && !Number.isNaN(Number(v)));
  });

  const opt_missing = optional.filter(k => !process.env[k]?.toString().trim());

  const body = {
    runtime: "edge-middleware",
    summary: { ok: missing.length===0, missing, total_required: required.length, present: required.length - missing.length },
    numeric_ok: numeric_bad.length===0, numeric_bad,
    optional_missing: opt_missing
  };

  return new NextResponse(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}
