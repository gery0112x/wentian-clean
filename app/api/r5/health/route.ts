// runtime: Edge；標準健康檢查
import { NextResponse } from "next/server";
export const runtime = "edge";

export async function GET() {
  const now = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    service: "r5",
    time: now,
    hint_zh: "此端點正常，亦可用 POST /_r5/ping 回聲測試"
  });
}
