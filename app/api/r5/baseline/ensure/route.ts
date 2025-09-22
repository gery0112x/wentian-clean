// app/api/r5/baseline/ensure/route.ts
import { NextResponse } from "next/server";
import { ensureBaselineOk } from "../../../../../lib/r5/baseline";

export async function GET() {
  const res = await ensureBaselineOk(); // 和 /api/r5/start 用同一套守門
  const status = res.ok ? 200 : 503;
  return NextResponse.json({ ok: res.ok, data: res }, { status });
}
