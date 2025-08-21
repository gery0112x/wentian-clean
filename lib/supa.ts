// lib/supa.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * 取得 Supabase client
 * - 伺服端(Next.js API Route / Server) 預設使用 service_role（可寫表 & 繞過 RLS）
 * - 瀏覽器(前端) 預設使用 anon（安全）
 *
 * 你也可以明確指定 getSupa('service') 或 getSupa('anon')
 */
export function getSupa(
  mode: "service" | "anon" = typeof window === "undefined" ? "service" : "anon"
): SupabaseClient {
  if (!env.SUPABASE_URL) {
    throw new Error("Missing env.SUPABASE_URL");
  }

  const key =
    mode === "service" ? env.SUPABASE_SERVICE_ROLE : env.SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      mode === "service"
        ? "Missing env.SUPABASE_SERVICE_ROLE"
        : "Missing env.SUPABASE_ANON_KEY"
    );
  }

  return createClient(env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { "X-Client-Info": "wentian-clean" },
    },
  });
}

// 需要顯式語意時可用（不強制）：
export const serverSupa = () => getSupa("service");
export const browserSupa = () => getSupa("anon");
