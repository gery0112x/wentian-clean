import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "./env";

export function getSupa(): SupabaseClient | null {
  if (!hasSupabase) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false }
  });
}
