// lib/env.ts
export type Env = {
  // --- OpenAI / 兼容 API ---
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_BASE_URL: string; // <== 新增，預設 https://api.openai.com/v1

  // --- Supabase ---
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY?: string;         // 前端用（選填）
  SUPABASE_SERVICE_ROLE?: string;     // 後端用（選填）

  // --- 其他可選 ---
  VERCEL_TOKEN?: string;
};

const required = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export const env: Env = {
  // OpenAI / 兼容 API
  OPENAI_API_KEY: required("OPENAI_API_KEY"),
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",

  // Supabase
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,

  // 其他（選填）
  VERCEL_TOKEN: process.env.VERCEL_TOKEN,
};
