// lib/supa.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * 自動判斷環境：
 * - Server（Node/Edge/Route/Server Action）：用 service_role（繞 RLS，可寫）
 * - Browser：用 anon（受 RLS 保護）
 * 別在任何情況把 service_role 放到瀏覽器。
 */
export function getSupa(): SupabaseClient {
  const isServer = typeof window === "undefined";
  if (isServer) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "wentian-clean/server" } },
    });
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { headers: { "X-Client-Info": "wentian-clean/browser" } },
  });
}

// 明確語意別名（可自由使用）
export const serverSupa = () =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "wentian-clean/server" } },
  });

export const browserSupa = () =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { headers: { "X-Client-Info": "wentian-clean/browser" } },
  });
