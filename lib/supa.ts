// /lib/supa.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

type DbRole = 'service' | 'anon';

const URL =
  process.env.SUPABASE_URL ||
  env.SUPABASE_URL;

// 直接從 process.env 讀，若沒值再退回 env 包裝（避免包裝漏帶 server-only）
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  env.SUPABASE_SERVICE_ROLE ||
  '';

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  '';

/** 服務端：Service Role（繞過 RLS） */
export function supaService() {
  if (!URL || !SERVICE_ROLE) {
    throw new Error('SUPABASE_URL 或 SUPABASE_SERVICE_ROLE 未設定');
  }
  return createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

/** 匿名：Anon（受 RLS） */
export function supaAnon() {
  if (!URL || !ANON_KEY) {
    throw new Error('SUPABASE_URL 或 SUPABASE_ANON_KEY 未設定');
  }
  return createClient(URL, ANON_KEY, { auth: { persistSession: false } });
}

/** 便利：依角色取 client（預設 anon） */
export function getSupa(role: DbRole = 'anon') {
  return role === 'service' ? supaService() : supaAnon();
}

/** 目前 DB 角色：只要拿得到 SERVICE_ROLE 就視為 service */
export function currentDbRole(): DbRole {
  return SERVICE_ROLE ? 'service' : 'anon';
}
