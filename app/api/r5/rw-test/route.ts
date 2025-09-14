// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs"; // 需使用 Node 才能安全讀取服務金鑰

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE || "";

function diag() {
  return {
    ok: true,
    diag: {
      has_url: Boolean(SUPABASE_URL),
      has_service_key: Boolean(SERVICE_KEY),
      table: "public.r5_rw_log",
      hint_zh: "POST 可嘗試寫入；若 424→先在 Supabase 建表後重試"
    }
  };
}

export async function GET() {
  return NextResponse.json(diag());
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        code: "MISSING_ENV",
        hint_zh: "請於 Vercel 設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE（非公開）"
      },
      { status: 500 }
    );
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const payload = {
    source: "r5",
    path: "/_r5/rw-test",
    note: body?.note ?? null,
    created_at: new Date().toISOString()
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/r5_rw_log`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  // 成功：201 + 回傳新列
  if (res.status === 201) {
    const json = await res.json();
    return NextResponse.json({ ok: true, db_status: 201, rows: json }, { status: 201 });
  }

  // 表不存在：給出一次性 SQL
  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "TABLE_NOT_FOUND",
        hint_zh: "請先在 Supabase 建立資料表 public.r5_rw_log 後重試。",
        sql: `create table if not exists public.r5_rw_log (
  id bigserial primary key,
  source text,
  path text,
  note text,
  created_at timestamptz default now()
);`
      },
      { status: 424 }
    );
  }

  // 其他錯誤：透傳片段
  const text = await res.text();
  return NextResponse.json(
    { ok: false, code: "DB_ERROR", status: res.status, body: text.slice(0, 2000) },
    { status: 502 }
  );
}
