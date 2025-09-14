// app/api/r5/inspect/route.ts
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

export async function GET(req: NextRequest) {
  const schema = new URL(req.url).searchParams.get("schema");

  if (!urlPick.value || !keyPick.value) {
    return NextResponse.json(
      {
        ok: false,
        code: "MISSING_ENV",
        used_url_key: urlPick.name || null,
        used_service_key: keyPick.name || null,
        hint_zh: "請設定 SUPABASE_URL +（Service Role 任一名稱）；僅伺服端使用"
      },
      { status: 500 }
    );
  }

  // 呼叫 RPC: public.r5_inspect
  const res = await fetch(`${urlPick.value}/rest/v1/rpc/r5_inspect`, {
    method: "POST",
    headers: {
      apikey: keyPick.value,
      Authorization: `Bearer ${keyPick.value}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_schema: schema })
  });

  // 函式不存在時，回傳一次性 SQL 提示
  if (res.status === 404) {
    return NextResponse.json(
      {
        ok: false,
        code: "RPC_NOT_FOUND",
        hint_zh: "請先在 Supabase SQL Editor 執行一次 r5_inspect 的建立 SQL",
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
    {
      ok: true,
      diag: {
        used_url_key: urlPick.name,
        used_service_key: keyPick.name,
        schema: schema ?? null
      },
      data
    },
    { status: 200 }
  );
}
