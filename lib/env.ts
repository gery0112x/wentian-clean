// lib/env.ts
type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;       // 前端用
  SUPABASE_SERVICE_ROLE: string;   // 後端用
  OPENAI_API_KEY?: string;
};

function must(name: keyof Env) {
  const v = process.env[name as string];
  if (!v) throw new Error(`Missing env ${name}`);
  return v as string;
}

export const env: Env = {
  SUPABASE_URL: must("SUPABASE_URL"),
  SUPABASE_ANON_KEY: must("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE: must("SUPABASE_SERVICE_ROLE"),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
