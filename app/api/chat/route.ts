// app/api/chat/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { summarizeHistory } from '@/lib/summarize';

export const runtime = 'nodejs';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const { model, messages = [] } = (await req.json()) as {
      model?: string;
      messages?: Msg[];
    };

    // 系統前言（你之前定義的白話提案模組用語境）
    const system: Msg = {
      role: 'system',
      content:
        '你在一個工業平台中回覆：先白話+（括號術語）。若提到「白話提案模組」，就走草稿→驗證→2分鐘快閘→通過即接回/失敗即回滾。',
    };

    // 盡量維持你原有 summarize 的簽名（前一版編譯錯誤：少了第二參數）
    const summary =
      (await summarizeHistory(messages ?? [], env.OPENAI_MODEL)) ?? '';

    const body = {
      model: model || env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [system, ...(messages ?? [])] as Msg[],
      // 你如果要把 summary 丟給模型，這裡也可以：
      // metadata: { summary },
    };

    // 透過你設定的 OPENAI_BASE_URL 直連（或者走 OpenAI 官方端點）
    const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { ok: false, error: text || r.statusText },
        { status: r.status },
      );
    }

    const data = await r.json();
    return NextResponse.json({ ok: true, data, summary });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
