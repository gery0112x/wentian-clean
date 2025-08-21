// app/api/ops/trigger/route.ts
import { NextRequest } from "next/server";
import { supaService } from "@/lib/supa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, any>;
const j = (obj: Json, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * 後台運營觸發器：
 *  - op=ping     ：健康檢查（並嘗試檢測 service role 可用性）
 *  - op=seed_all ：以 service role 播種初始資料（繞過 RLS）
 */
export async function POST(req: NextRequest) {
  let body: Json = {};
  try {
    body = await req.json();
  } catch {
    // ignore empty body
  }

  const op = String(body?.op ?? "").trim();

  // 1) 健康檢查
  if (op === "ping") {
    // 預設視為 anon；能成功用 service role 做個輕量動作就標記為 service
    let role: "anon" | "service" = "anon";
    try {
      const s = supaService();

      // 輕量檢查：嘗試呼叫一個 RPC；若不存在也會被 catch。
      // 你若沒有暴露 pg_sleep RPC，這段會進 catch，不影響結果。
      const { error } = await s.rpc("pg_sleep", { seconds: 0 });
      if (!error) role = "service";
    } catch {
      role = "anon";
    }

    return j({
      ok: true,
      platform: "無極",
      realm: "元始境 00-00",
      who: "柯老",
      db_role: role,
    });
  }

  // 2) 播種初始資料（需要 Service Role，否則會被 RLS 擋）
  if (op === "seed_all") {
    try {
      const s = supaService();

      // 依你的 schema 調整；此處示範 roles_routes 的 upsert
      const rows = [
        { role: "admin", route: "/api/proposal", allow: true },
        { role: "admin", route: "/api/upgrade/start", allow: true },
        { role: "admin", route: "/api/upgrade/status", allow: true },
        { role: "admin", route: "/api/ops/trigger", allow: true },
      ];

      const { error } = await s
        .from("roles_routes")
        .upsert(rows, { onConflict: "role,route" });

      if (error) {
        return j(
          {
            ok: false,
            step: "seed_all",
            error: error.message,
            hint:
              "若看到 RLS 錯誤，代表目前不是用 Service Role。請在 Vercel 設定 SUPABASE_SERVICE_ROLE 並確保本 route 使用 runtime=nodejs。",
          },
          500
        );
      }

      return j({ ok: true, step: "seed_all" });
    } catch (e: any) {
      return j(
        {
          ok: false,
          error: String(e?.message ?? e ?? "seed failed"),
          hint:
            "請確認已設定 SUPABASE_SERVICE_ROLE，且此 API 在 Node 環境執行（不是 Edge）。",
        },
        500
      );
    }
  }

  return j({ ok: false, error: "unknown op", got: op }, 400);
}
