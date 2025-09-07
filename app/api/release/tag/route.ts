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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // 服務角色金鑰（只給伺服端）
    const supa = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // ⚠️ 不要設定 db.schema，預設就是 public
    });

    const row = {
      tag,
      kind,
      vercel_url: process.env.VERCEL_URL ?? null,
      vercel_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      vercel_branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      notes: "auto-tag",
    };

    // 操作 public.release_tags（其實寫 'release_tags' 即可）
    const { data, error } = await supa
      .from("release_tags")
      .upsert(row, { onConflict: "tag" })    // 同 tag 再登記不會重複報錯
      .select("tag, kind, vercel_commit_sha, vercel_branch, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
