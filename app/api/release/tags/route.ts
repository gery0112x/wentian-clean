import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

export async function GET(){
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(supabaseUrl, supabaseKey, { auth:{persistSession:false,autoRefreshToken:false} });

  const { data, error } = await supa
    .from("gov.release_tags")
    .select("created_at, tag, kind, vercel_commit_sha, vercel_branch")
    .order("created_at", { ascending:false })
    .limit(10);

  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:400 });
  return NextResponse.json({ ok:true, items:data }, { status:200 });
}
