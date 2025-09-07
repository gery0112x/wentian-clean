import { NextResponse } from "next/server";
export const runtime = "nodejs";

function toGeminiContents(messages: any[]) {
  return (messages || []).map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content ?? "") }],
  }));
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "gemini", hint_zh: "此端點正常，請用 POST 發訊息" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = body?.messages ?? [{ role: "user", content: "ping" }];
    const model = body?.model ?? (process.env.GEMINI_MODEL || "gemini-1.5-flash-latest");
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(String(key))}`;

    const payload = { contents: toGeminiContents(messages) };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json();
    const reply =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ?? null;

    return NextResponse.json({
      ok: true,
      provider: "gemini",
      model,
      status: r.status,
      reply,
      usage: j?.usageMetadata ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, provider: "gemini", error: String(e?.message || e) }, { status: 500 });
  }
}
