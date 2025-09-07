import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, provider: "grok", hint_zh: "此端點正常，請用 POST 發訊息" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = body?.messages ?? [{ role: "user", content: "ping" }];
    const model = body?.model ?? (process.env.GROK_MODEL || "grok-2");
    const max_tokens = body?.max_tokens ?? 128;

    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const base = process.env.GROK_API_URL || "https://api.x.ai/v1/chat/completions";

    const r = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, max_tokens }),
    });

    const j = await r.json();
    return NextResponse.json({
      ok: true,
      provider: "grok",
      model,
      status: r.status,
      reply: j?.choices?.[0]?.message?.content ?? null,
      usage: j?.usage ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, provider: "grok", error: String(e?.message || e) }, { status: 500 });
  }
}
