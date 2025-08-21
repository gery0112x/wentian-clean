// app/api/ops/trigger/route.ts
import { NextRequest } from "next/server";
import { supaService, currentDbRole } from "@/lib/supa";

// 必須用 Node 執行，才能安全使用 Service Role
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, any>;
const j = (obj: Json, init?: number) =>
  new Response(JSON.stringify(obj), {
    status: init ?? 200,
    headers: { "content-type": "application/json" },
  });

/**
 * 後台運營觸發器：
 *  - op=ping      ：健康檢查 + 回報目前 DB 角色（anon/service）
 *  - op=seed_all  ：以 service role 播種初始資料（繞過 RLS）
 */
export async function POST(req: NextRequest) {
  let body: Json = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const op = String(body?.op ?? "").trim();

  // 1) 健康檢查（同時檢測 service role 是否可用）
  if (op === "ping") {
    let role = currentDbRole("anon");
    try {
      const s = supaService();
      // 輕量 RPC 測試（不串 .catch，直接檢查回傳）
      const { error } = await s.rpc("pg_sleep", { seconds: 0 });
      if (!error) role = currentDbRole("service");
    } catch {
      role = currentDbRole("anon");
    }
    return j({ ok: true, platform: "無極", realm: "元始境 00-00", who: "柯老", db_role: role });
  }

  // 2) 播種資料（需要 Service Role；若用 anon 就會被 RLS 擋下）
  if (op === "seed_all") {
    try {
      const s = supaService();

      // 例：roles_routes 播種（若表不存在會回錯；這裡只示範流程）
      // 你的 schema 若不同，改成實際的表和欄位
      const rows = [
        { role: "admin", route: "/api/proposal", allow: true },
        { role: "admin", route: "/api/upgrade/start", allow: true },
        { role: "admin", route: "/api/upgrade/status", allow: true },
        { role: "admin", route: "/api/ops/trigger", allow: true },
      ];

      const { error } = await s
        .from("roles_routes")
        .upsert(rows, { onConflict: "role,route" }); // 若有 unique constraint，請調整

      if (error) return j({ ok: false, step: "seed_all", error: error.message }, 500);

      return j({ ok: true, step: "seed_all" });
    } catch (e: any) {
      return j(
        {
          ok: false,
          error: String(e?.message ?? e ?? "seed failed"),
          hint:
            "若看到 RLS 錯誤，代表現在用的是 anon key。請在 Vercel 設定 SUPABASE_SERVICE_ROLE 並確定本 route 使用 runtime=nodejs。",
        },
        500
      );
    }
  }

  return j({ ok: false, error: "unknown op", got: op }, 400);
}
