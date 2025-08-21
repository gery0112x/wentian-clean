// /lib/env.ts
export const env = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  // OpenAI / VLM
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',

  NODE_ENV: process.env.NODE_ENV || 'production',
};
