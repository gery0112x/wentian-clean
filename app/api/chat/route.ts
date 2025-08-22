// app/api/chat/route.ts
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

function envOrDie(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const OPENAI_API_KEY  = envOrDie('OPENAI_API_KEY');
const OPENAI_MODEL    = process.env.OPENAI_MODEL ?? 'gpt-4o-2024-08-06';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inputMessages: Msg[] = Array.isArray(body?.messages) ? body.messages : [];
    const system: Msg = {
      role: 'system',
      content: '你在一個工業平台中回覆：先由後台（白話提案模組）判斷是否接手；未接手再走一般聊天。回覆請精簡清楚。'
    };

    const payload = {
      model: body?.model ?? OPENAI_MODEL,
      messages: [system, ...inputMessages],
    };

    const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return Response.json(
        { ok: false, error: `upstream ${r.status}: ${errText}` },
        { status: 500 },
      );
    }

    const data = await r.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      '';

    return Response.json({
      ok: true,
      message: { role: 'assistant', content },
      usage: data?.usage ?? null,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
