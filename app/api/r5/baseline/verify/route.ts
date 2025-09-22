// app/api/r5/baseline/verify/route.ts
import { NextResponse } from "next/server";
import { verifyBaseline } from "../../../../lib/r5/baseline";

export async function GET() {
  const res = await verifyBaseline();
  const status = res.ok ? 200 : 503;
  return NextResponse.json({ ok: res.ok, data: res }, { status });
}
