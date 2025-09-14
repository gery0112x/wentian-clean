// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pick(names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return { name: n, value: v };
  }
  return { name: "", value: "" };
}

const urlPick = pick(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const keyPick = pick([
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SERVICE_ROLE"
]);

const SUPABASE_URL = urlPick.value || "";
const SERVICE_KEY  = keyPick.value || "";

function diag(extra: any = {}) {
  return {
    ok: Boolean(SUPABASE_URL && SERVICE_KEY),
    diag: {
      has_url: Boolean(SUPABASE_URL),
      has_service_key: Boolean(SERVICE_KEY),
      used_url_key: urlPick.name || null,
      used_service_key: keyPick.name || null,
      table: "public.r5_rw_log",
      hint_zh: "POST 可寫入；GET ?inspect=1 可列出資料庫/排程",
      ...extra
    }
  };
}

async function callInspect(schema: string | null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/r5_inspect`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_schema: schema })
  });

  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "RPC_NOT_FOUND",
        hint_zh: "Supabase 端尚未建立函式 public.r5_inspect（請在 SQL Editor 先執行建立 SQL）"
      },
      { status: 424 }
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: "RPC_ERROR", status: res.status, body: data },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { ok: true, ...diag({ schema }), data },
    { status: 200 }
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const inspect = url.searchParams.get("inspect");
  const schema = url.searchParams.get("schema");

  if (inspect) {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        {
          ok: false,
          code: "MISSING_ENV",
          used_url_key: urlPick.name || null,
          used_service_key: keyPick.name || null,
          hint_zh: "請設定 SUPABASE_URL + Service Role（金鑰僅伺服端）"
        },
        { status: 500 }
      );
    }
    return callInspect(schema);
  }

  return NextResponse.json(diag(), { status: 200 });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        code: "MISSING_ENV",
        hint_zh: "請於 Vercel 設定 SUPABASE_URL 與 Service Role（金鑰）"
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
