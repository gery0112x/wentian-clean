// app/api/r5/risk/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "ops.risk_cards";

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

function meta(extra: any = {}) {
  return {
    diag: {
      has_url: Boolean(urlPick.value),
      has_service_key: Boolean(keyPick.value),
      used_url_key: urlPick.name || null,
      used_service_key: keyPick.name || null,
      table: TABLE,
      hint_zh: "POST 上傳/覆寫風險卡；GET ?id= 查詢；GET ?health=1 健檢",
      ...extra,
    },
  };
}

async function rest(path: string, init?: RequestInit) {
  return fetch(`${urlPick.value}${path}`, {
    ...init,
    headers: {
      apikey: keyPick.value,
      Authorization: `Bearer ${keyPick.value}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function GET(req: NextRequest) {
  if (!urlPick.value || !keyPick.value) {
    return NextResponse.json({ ok: false, code: "MISSING_ENV", ...meta() }, { status: 500 });
  }

  const q = new URL(req.url).searchParams;
  if (q.get("health")) {
    const res = await rest(`/rest/v1/${TABLE}?select=id&limit=1`);
    if (res.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          code: "TABLE_NOT_VISIBLE",
          fix_zh: "PostgREST 尚未暴露 ops；請執行 alter role authenticator ... 並 reload",
          sql: `alter role authenticator in database postgres
  set pgrst.db_schemas = 'public,storage,graphql_public,extensions,ops';
select pg_notify('pgrst','reload config');`,
          ...meta(),
        },
        { status: 424 }
      );
    }
    return NextResponse.json({ ok: true, ...meta({ visible: true }) }, { status: 200 });
  }

  const id = q.get("id");
  if (id) {
    const res = await rest(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, code: "READ_ERROR", status: res.status, body: data, ...meta() }, { status: 502 });
    }
    return NextResponse.json({ ok: true, data, ...meta() }, { status: 200 });
  }

  const res = await rest(`/rest/v1/${TABLE}?select=id,name,version,updated_at&order=updated_at.desc&limit=50`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ ok: false, code: "LIST_ERROR", status: res.status, body: data, ...meta() }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data, ...meta() }, { status: 200 });
}

export async function POST(req: NextRequest) {
  if (!urlPick.value || !keyPick.value) {
    return NextResponse.json({ ok: false, code: "MISSING_ENV", ...meta() }, { status: 500 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const missing = ["id", "name", "version", "updated_at", "card"].filter(k => !body?.[k]);
  if (missing.length) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", missing, ...meta() }, { status: 400 });
  }

  const rec = {
    id: String(body.id),
    name: String(body.name),
    version: String(body.version),
    checksum: body.checksum ?? null,
    updated_at: body.updated_at,
    card: body.card,
  };

  const res = await rest(`/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(rec),
  });

  if (res.status === 201 || res.status === 200) {
    const rows = await res.json().catch(() => []);
    return NextResponse.json({ ok: true, db_status: res.status, rows, ...meta() }, { status: 201 });
  }

  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "TABLE_NOT_FOUND",
        hint_zh: "風險表不存在或未暴露；請先建表並暴露 ops",
        sql: `create schema if not exists ops;
create table if not exists ops.risk_cards (
  id text primary key, name text not null, version text not null,
  checksum text, updated_at timestamptz not null default now(),
  card jsonb not null, created_at timestamptz not null default now(),
  touched_at timestamptz not null default now()
);
grant usage on schema ops to service_role;
grant select, insert, update on ops.risk_cards to service_role;
alter role authenticator in database postgres
  set pgrst.db_schemas = 'public,storage,graphql_public,extensions,ops';
select pg_notify('pgrst','reload config');`,
        ...meta(),
      },
      { status: 424 }
    );
  }

  const txt = await res.text();
  return NextResponse.json({ ok: false, code: "DB_ERROR", status: res.status, body: txt.slice(0, 2000), ...meta() }, { status: 502 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } });
}
