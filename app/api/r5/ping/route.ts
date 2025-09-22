// app/api/r5/ping/route.ts
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "r5", ts: new Date().toISOString() }, { status: 200 });
}
