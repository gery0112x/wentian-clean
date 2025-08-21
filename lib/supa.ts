// /lib/supa.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 不要在瀏覽器用 service role！這份檔只會被伺服端 import。
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

export type DBRole = 'anon' | 'service_role';

export function supaAnon(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function supaService(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE in env.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function currentDbRole(which: 'service' | 'anon'): DBRole {
  return which === 'service' ? 'service_role' : 'anon';
}
