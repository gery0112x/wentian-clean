// runtime: Edge；回聲與基本 headers 記錄
import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";

export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", hint_zh: "請以 POST 帶 {echo}" });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const echo = body?.echo ?? null;

  return NextResponse.json({
    ok: true,
    pong: echo,
    ts: new Date().toISOString(),
    ua: req.headers.get("user-agent") || ""
  });
}
