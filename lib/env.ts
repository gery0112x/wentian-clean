// /lib/env.ts
export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'production',
};
