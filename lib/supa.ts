// /lib/supa.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

type DbRole = 'service' | 'anon';

// URL 可以從 env 包裝或 process.env 擇一取得
const URL =
  process.env.SUPABASE_URL ??
  env.SUPABASE_URL;

// Service Role 允許從 env 包裝或 process.env 取得
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ??
  env.SUPABASE_SERVICE_ROLE ??
  '';

// 匿名金鑰：只從 process.env 讀，避免 TS 抱怨 env 沒這個欄位
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  '';

/** 服務端（繞過 RLS） */
export function supaService() {
  if (!URL || !SERVICE_ROLE) {
    throw new Error('SUPABASE_URL 或 SUPABASE_SERVICE_ROLE 未設定');
  }
  return createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

/** 匿名（受 RLS） */
export function supaAnon() {
  if (!URL || !ANON_KEY) {
    throw new Error('SUPABASE_URL 或 SUPABASE_ANON_KEY 未設定');
  }
  return createClient(URL, ANON_KEY, { auth: { persistSession: false } });
}

/** 依角色取 client（預設 anon） */
export function getSupa(role: DbRole = 'anon') {
  return role === 'service' ? supaService() : supaAnon();
}

/** 目前 DB 角色（只要拿得到 SERVICE_ROLE 就當 service） */
export function currentDbRole(): DbRole {
  return SERVICE_ROLE ? 'service' : 'anon';
}
