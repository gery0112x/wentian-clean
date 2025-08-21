// lib/supa.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

const isServer = typeof window === "undefined";

/** 以 anon key 建立 client（瀏覽器用、或當作後端 fallback） */
export function supaAnon(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: !isServer, autoRefreshToken: !isServer },
    global: { headers: { "X-Client-Info": "wentian-clean/anon" } },
  });
}

/** 以 service_role 建立 client（伺服端用；缺少時會回退 anon） */
export function supaService(): SupabaseClient {
  const key = isServer && SUPABASE_SERVICE_ROLE
    ? SUPABASE_SERVICE_ROLE
    : SUPABASE_ANON_KEY; // fallback，避免直接 500
  const roleHint = key === SUPABASE_SERVICE_ROLE ? "service" : "server-ANON";
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": `wentian-clean/${roleHint}` } },
  });
}

/** 統一入口：伺服端→service_role；瀏覽器→anon */
export function getSupa(): SupabaseClient {
  return isServer ? supaService() : supaAnon();
}

/** 目前 DB 角色：伺服端且有 service_role 才回 service_role，否則 anon */
export function currentDbRole(): "service_role" | "anon" {
  return isServer && !!SUPABASE_SERVICE_ROLE ? "service_role" : "anon";
}

// 新名字別名（給新程式用）
export const dbRole = currentDbRole;
