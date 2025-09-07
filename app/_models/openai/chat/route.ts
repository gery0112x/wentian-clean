import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  // 讓你用瀏覽器直接看「有沒有掛上」
  return NextResponse.json({ ok: true, provider: "openai", hint_zh: "此端點正常，請用 POST 發訊息" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = body?.messages ?? [{ role: "user", content: "ping" }];
    const model = body?.model ?? "gpt-4o-mini-2024-07-18";
    const max_tokens = body?.max_tokens ?? 64;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, max_tokens }),
    });

    const j = await r.json();
    return NextResponse.json({
      ok: true,
      provider: "openai",
      model,
      status: r.status,
      reply: j?.choices?.[0]?.message?.content ?? null,
      usage: j?.usage ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, provider: "openai", error: String(e?.message || e) }, { status: 500 });
  }
}
