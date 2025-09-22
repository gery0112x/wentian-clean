// app/api/r5/health/route.ts
import { NextResponse } from "next/server";
export async function GET() {
  try {
    // 輕量健康檢查（如需可改為探 Supabase /rest/v1）
    return NextResponse.json({ ok: true, service: "r5", ts: new Date().toISOString() }, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || "health_error" }, { status: 500 });
  }
}
