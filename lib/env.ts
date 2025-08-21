export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};
