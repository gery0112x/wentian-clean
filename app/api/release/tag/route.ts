import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

function nowTag(){
  const tz = new Date();
  const pad = (n:number)=>String(n).padStart(2,"0");
  const y=tz.getFullYear(), m=pad(tz.getMonth()+1), d=pad(tz.getDate());
  const hh=pad(tz.getHours()), mm=pad(tz.getMinutes());
  return `v${y}${m}${d}-${hh}${mm}`;
}

export async function GET(req: Request){
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag") || nowTag();
  const kind = (url.searchParams.get("kind") || "baseline") as "baseline"|"release";

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(supabaseUrl, supabaseKey, { auth:{persistSession:false,autoRefreshToken:false} });

  const row = {
    tag, kind,
    vercel_url: process.env.VERCEL_URL || null,
    vercel_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    vercel_branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    notes: "auto-tag"
  };

  const { data, error } = await supa.from("gov.release_tags")
    .insert(row).select("*").single();

  if (error) {
    return NextResponse.json({ ok:false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok:true, tag:data.tag, kind:data.kind, data }, { status: 200 });
}
