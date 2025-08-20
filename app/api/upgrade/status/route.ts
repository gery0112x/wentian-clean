import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.SUPABASE_URL || (process.env as any).supabaseUrl;
  const key = process.env.SUPABASE_SERVICE_ROLE || (process.env as any).supabaseKey;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ ok:false, error:"MISSING_SUPABASE_ENV" }, { status:503 });

  const { data, error } = await sb.from("upgrade_events")
    .select("*").order("created_at", { ascending: false }).limit(10);

  if (error) return Response.json({ ok:false, error:String(error) }, { status:500 });
  return Response.json({ ok:true, events:data ?? [] });
}
