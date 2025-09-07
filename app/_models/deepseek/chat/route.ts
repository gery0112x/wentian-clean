import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, provider: "deepseek", hint_zh: "此端點正常，請用 POST 發訊息" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = body?.messages ?? [{ role: "user", content: "ping" }];
    const model = body?.model ?? "deepseek-chat";
    const max_tokens = body?.max_tokens ?? 64;
    const key = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;

    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens }),
    });

    const j = await r.json();
    return NextResponse.json({
      ok: true,
      provider: "deepseek",
      model,
      status: r.status,
      reply: j?.choices?.[0]?.message?.content ?? null,
      usage: j?.usage ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, provider: "deepseek", error: String(e?.message || e) }, { status: 500 });
  }
}
