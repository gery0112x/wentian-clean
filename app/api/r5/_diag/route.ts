import { NextResponse } from "next/server";

export async function GET() {
  const SB_URL_RAW = process.env.SUPABASE_URL || "";
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK || "";

  // 1) 清理成 Base（避免 /rest/v1 重複）
  const SB_BASE = SB_URL_RAW.replace(/\/rest\/v1\/?$/i, "");
  const restUrl = SB_BASE ? `${SB_BASE}/rest/v1` : "";

  // 2) 試打 GET r5_runs（僅取 1 筆，避免大回應）
  let postgrest_status = null as null | number;
  try {
    if (restUrl && SB_KEY) {
      const r = await fetch(`${restUrl}/r5_runs?select=id&limit=1`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        cache: "no-store",
      });
      postgrest_status = r.status;
    }
  } catch { postgrest_status = -1; }

  // 3) 試打 Deploy Hook（不看內容，只看狀態碼）
  let hook_status = null as null | number;
  try {
    if (VERCEL_DEPLOY_HOOK) {
      const r = await fetch(VERCEL_DEPLOY_HOOK, { method: "POST", cache: "no-store" });
      hook_status = r.status;
    }
  } catch { hook_status = -1; }

  return NextResponse.json({
    ok: true,
    env: {
      has_SUPABASE_URL: !!SB_URL_RAW,
      has_SERVICE_ROLE: !!SB_KEY,
      has_DEPLOY_HOOK: !!VERCEL_DEPLOY_HOOK,
      supabase_url_raw: SB_URL_RAW ? SB_URL_RAW.replace(/.{10}$/,"**********") : null, // 部分遮罩
      supabase_base_used: SB_BASE || null,
    },
    checks: {
      postgrest_status,   // 理想：200
      hook_status,        // 理想：200/204
    },
  });
}
