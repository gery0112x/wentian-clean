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

function diag(extra: any = {}) {
  return {
    ok: Boolean(urlPick.value && keyPick.value),
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

/* -------- GET --------
   - /_r5/risk?health=1          健檢（含表可視性）
   - /_r5/risk?id=risk.MCP       取單卡
   - /_r5/risk                   列最新 50 張
*/
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const health = q.get("health");
  const id = q.get("id");

  if (!urlPick.value || !keyPick.value) {
    return NextResponse.json(
      { ok: false, code: "MISSING_ENV", ...diag() },
      { status: 500 }
    );
  }

  if (health) {
    // 嘗試讀 1 列判斷 PostgREST 是否看得到 ops.risk_cards
    const res = await rest(`/rest/v1/${TABLE}?select=id&limit=1`);
    if (res.status === 404) {
      return NextResponse.json(
        {
          ok: false,
          code: "TABLE_NOT_VISIBLE",
          ...diag(),
          fix_zh:
            "PostgREST 尚未暴露 ops schema；請在 SQL Editor 執行 alter role authenticator ... pgrst.db_schemas 加入 ops 並 reload",
          sql: `alter role authenticator in database postgres
  set pgrst.db_schemas = 'public,storage,graphql_public,extensions,ops';
select pg_notify('pgrst','reload config');`,
        },
        { status: 424 }
      );
    }
    // 200/206 視為可見
    return NextResponse.json(diag({ visible: true }), { status: 200 });
  }

  if (id) {
    const res = await rest(
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: "READ_ERROR", status: res.status, body: data },
        { status: 502 }
      );
    }
    return NextResponse.json({ ...diag(), data }, { status: 200 });
  }

  // list
  const res = await rest(`/rest/v1/${TABLE}?select=id,name,version,updated_at&order=updated_at.desc&limit=50`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: "LIST_ERROR", status: res.status, body: data },
      { status: 502 }
    );
  }
  return NextResponse.json({ ...diag(), data }, { status: 200 });
}

/* -------- POST --------
   Body（JSON）：
   {
     "id":"risk.MCP",
     "name":"MCP 模組風險卡",
     "version":"v1.0",
     "updated_at":"2025-09-14T12:00:00Z",   // 你原本 +08:00 這裡可用 UTC
     "checksum":"MCP_risk_v1_0",
     "card":{ ... 原始卡片 JSON（含 risks…） ... }
   }
*/
export async function POST(req: NextRequest) {
  if (!urlPick.value || !keyPick.value) {
    return NextResponse.json(
      { ok: false, code: "MISSING_ENV", ...diag() },
      { status: 500 }
    );
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  // 基本驗證
  const missing = ["id", "name", "version", "updated_at", "card"].filter(
    (k) => !body?.[k]
  );
  if (missing.length) {
    return NextResponse.json(
      { ok: false, code: "INVALID_INPUT", missing, hint_zh: "必填欄位缺失" },
      { status: 400 }
    );
  }

  // 準備 upsert（on_conflict=id）
  const rec = {
    id: String(body.id),
    name: String(body.name),
    version: String(body.version),
    checksum: body.checksum ?? null,
    updated_at: body.updated_at,
    card: body.card,
  };

  const res = await rest(
    `/rest/v1/${TABLE}?on_conflict=id`,
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(rec),
    }
  );

  if (res.status === 201 || res.status === 200) {
    const rows = await res.json().catch(() => []);
    return NextResponse.json(
      { ok: true, db_status: res.status, rows },
      { status: 201 }
    );
  }

  if (res.status === 404) {
    // 表/可見性問題 → 回自救腳本
    return NextResponse.json(
      {
        ok: false,
        code: "TABLE_NOT_FOUND",
        hint_zh: "風險表不存在或未暴露；請先在 SQL Editor 建表並將 ops 納入 pgrst.db_schemas",
        sql: `-- 建表
create schema if not exists ops;
create table if not exists ops.risk_cards (
  id text primary key,
  name text not null,
  version text not null,
  checksum text,
  updated_at timestamptz not null default now(),
  card jsonb not null,
  created_at timestamptz not null default now(),
  touched_at timestamptz not null default now()
);
grant usage on schema ops to service_role;
grant select, insert, update on ops.risk_cards to service_role;
-- 暴露 ops：
alter role authenticator in database postgres
  set pgrst.db_schemas = 'public,storage,graphql_public,extensions,ops';
select pg_notify('pgrst','reload config');`,
      },
      { status: 424 }
    );
  }

  const txt = await res.text();
  return NextResponse.json(
    { ok: false, code: "DB_ERROR", status: res.status, body: txt.slice(0, 2000) },
    { status: 502 }
  );
}
