// @/lib/supa.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export type DbRole = 'anon' | 'service';

/** 伺服端 Service Role 用戶端（繞過 RLS，用於後台管理與批次作業） */
export function supaService() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    throw new Error('SUPABASE_URL 或 SUPABASE_SERVICE_ROLE 未設定');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

/** 回報目前伺服端所用的 DB 角色（有沒有 Service Role Key） */
export function currentDbRole(): DbRole {
  return env.SUPABASE_SERVICE_ROLE ? 'service' : 'anon';
}
