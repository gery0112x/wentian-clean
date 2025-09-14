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
  "SERVICE_ROLE",
]);

const SUPABASE_URL = urlPick.value || "";
const SERVICE_KEY  = keyPick.value || "";
const TABLE = "ops.io_requests"; // 正式表

/** 僅回診斷資訊，避免與回應最外層 ok 重複鍵 */
function meta(extra: any = {}) {
  return {
    diag: {
      has_url: Boolean(SUPABASE_URL),
      has_service_key: Boolean(SERVICE_KEY),
      used_url_key: urlPick.name || null,
      used_service_key: keyPick.name || null,
      table: TABLE,
      hint_zh: "POST 寫入正式表；GET ?inspect=1&schema=public 可列 DB/排程",
      ...extra,
    },
  };
}

async function rpcInspect(schema: string | null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/r5_inspect`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_schema: schema }),
    cache: "no-store",
  });

  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "RPC_NOT_FOUND",
        ...meta(),
        hint_zh: "請先建立函式 public.r5_inspect",
      },
      { status: 424 }
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: "RPC_ERROR", status: res.status, body: data, ...meta() },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, ...meta({ schema }), data }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const inspect = url.searchParams.get("inspect");
  const schema = url.searchParams.get("schema");

  if (inspect) {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { ok: false, code: "MISSING_ENV", ...meta() },
        { status: 500 }
      );
    }
    return rpcInspect(schema);
  }

  return NextResponse.json({ ok: true, ...meta() }, { status: 200 });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, code: "MISSING_ENV", ...meta() },
      { status: 500 }
    );
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const ip =
    (req.headers.get("x-real-ip") ||
     req.headers.get("x-forwarded-for") ||
     "").split(",")[0].trim() || null;

  const payload = {
    op: body?.op ?? "generic",
    status: body?.status ?? "queued",
    source: body?.source ?? "r5",
    path: "/_r5/rw-test",
    user_id: body?.user_id ?? null,
    session_id: body?.session_id ?? null,
    ip,
    ua: req.headers.get("user-agent") || null,
    tags: Array.isArray(body?.tags) ? body.tags : null,
    cost_cents: body?.cost_cents ?? 0,
    input_tokens: body?.input_tokens ?? null,
    output_tokens: body?.output_tokens ?? null,
    payload: body?.payload ?? body ?? null,
    result: null,
    error: null,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (res.status === 201) {
    const rows = await res.json().catch(() => []);
    return NextResponse.json({ ok: true, db_status: 201, rows, ...meta() }, { status: 201 });
  }

  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "TABLE_NOT_FOUND",
        hint_zh: "請先建立 ops.io_requests，並確保 ops 已暴露到 PostgREST",
        sql: `-- 建表 + 權限
create schema if not exists ops;
create extension if not exists pgcrypto with schema extensions;
create table if not exists ops.io_requests (
  id bigserial primary key,
  trace_id uuid default gen_random_uuid(),
  op text, status text default 'queued',
  source text, path text, user_id uuid, session_id text,
  ip inet, ua text, tags text[],
  cost_cents integer default 0,
  input_tokens integer, output_tokens integer,
  payload jsonb, result jsonb, error jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
grant usage on schema ops to service_role;
grant all privileges on all tables in schema ops to service_role;
grant all privileges on all sequences in schema ops to service_role;
-- 暴露 ops
alter role authenticator in database postgres
  set pgrst.db_schemas = 'public,storage,graphql_public,extensions,ops';
select pg_notify('pgrst','reload config');`,
        ...meta(),
      },
      { status: 424 }
    );
  }

  const text = await res.text();
  return NextResponse.json(
    { ok: false, code: "DB_ERROR", status: res.status, body: text.slice(0, 2000), ...meta() },
    { status: 502 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET,POST,OPTIONS" },
  });
}
