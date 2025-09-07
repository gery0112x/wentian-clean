import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

function nowTag() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `v${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tag = url.searchParams.get("tag") ?? nowTag();
    const kind = (url.searchParams.get("kind") ?? "baseline") as "baseline" | "release";

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // 關鍵：把資料庫 schema 指到 gov
    const supa = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "gov" },
    });

    const row = {
      tag,
      kind,
      vercel_url: process.env.VERCEL_URL ?? null,
      vercel_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      vercel_branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      notes: "auto-tag",
    };

    const { data, error } = await supa
      .from("release_tags")
      .upsert(row, { onConflict: "tag" }) // 再按一次也不會重複報錯
      .select("tag, kind, vercel_commit_sha, vercel_branch, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
