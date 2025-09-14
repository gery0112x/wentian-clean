// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Picked = { name: string; value: string | undefined };

function pickEnv(candidates: string[]): Picked {
  for (const name of candidates) {
    const v = process.env[name];
    if (v && String(v).trim().length > 0) return { name, value: v };
  }
  return { name: "", value: undefined };
}

const urlPick = pickEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const keyPick = pickEnv([
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SERVICE_ROLE"
]);

const SUPABASE_URL = urlPick.value || "";
const SERVICE_KEY  = keyPick.value || "";

function diag() {
  return {
    ok: Boolean(SUPABASE_URL && SERVICE_KEY),
    diag: {
      has_url: Boolean(SUPABASE_URL),
      has_service_key: Boolean(SERVICE_KEY),
      used_url_key: urlPick.name || null,
      used_service_key: keyPick.name || null,
      table: "public.r5_rw_log",
      hint_zh: "POST 可寫入；若 424→先在 Supabase 建表後重試"
    }
  };
}

export async function GET() {
  return NextResponse.json(diag(), { status: 200 });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        code: "MISSING_ENV",
        used_url_key: urlPick.name || null,
        used_service_key: keyPick.name || null,
        hint_zh: "環境變數未命中；已同時支援多種名稱，請檢查 GET 診斷欄位"
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

  if (res.status === 201) {
    const rows = await res.json();
    return NextResponse.json({ ok: true, db_status: 201, rows }, { status: 201 });
  }

  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "TABLE_NOT_FOUND",
        hint_zh: "請先建立資料表 public.r5_rw_log 後重試",
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

  const text = await res.text();
  return NextResponse.json(
    { ok: false, code: "DB_ERROR", status: res.status, body: text.slice(0, 2000) },
    { status: 502 }
  );
}
