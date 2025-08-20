export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",

  SUPABASE_URL: process.env.SUPABASE_URL || process.env.supabaseUrl || "",
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || process.env.supabaseKey || ""
};

export const hasSupabase = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE);
