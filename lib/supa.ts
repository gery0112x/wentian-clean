// /lib/supa.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

type DbRole = 'service' | 'anon';

const URL = env.SUPABASE_URL;

/** 服務端專用：使用 Service Role Key（繞過 RLS） */
export function supaService() {
  return createClient(URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

/** 公用匿名：使用 Anon Key（受 RLS 保護） */
export function supaAnon() {
  return createClient(URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

/** 便利函式：依角色取 client（預設 anon） */
export function getSupa(role: DbRole = 'anon') {
  return role === 'service' ? supaService() : supaAnon();
}

/** 目前 API 執行時的 DB 角色（API Route 在伺服器上，可安全視為 service） */
export function currentDbRole(): DbRole {
  // 在 Vercel 的 Server Runtime 下，拿得到 SERVICE ROLE 就視為 service
  return env.SUPABASE_SERVICE_ROLE ? 'service' : 'anon';
}
