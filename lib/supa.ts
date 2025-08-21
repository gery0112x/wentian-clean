// /lib/supa.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let _service: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

/** 後端專用：使用 Service Role（會繞過 RLS） */
export function supaService(): SupabaseClient {
  if (_service) return _service;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    throw new Error('Service Role 未設定（缺 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE）');
  }
  _service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

/** （可選）前端/匿名用 */
export function supaAnon(): SupabaseClient {
  if (_anon) return _anon;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Anon Key 未設定（缺 SUPABASE_URL 或 SUPABASE_ANON_KEY）');
  }
  _anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anon;
}

/** 偵測目前 DB 角色（用一個不破壞性的 select 試探 RLS） */
export async function detectDbRole(): Promise<'service'|'anon'|'unknown'> {
  try {
    const s = supaService();
    // 若有開 RLS，anon 通常會被擋；service 會通過
    const { error } = await s.from('roles_routes').select('id').limit(1);
    if (error && /RLS|permission|not allowed/i.test(error.message)) return 'anon';
    return 'service';
  } catch {
    return 'anon';
  }
}
