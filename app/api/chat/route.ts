// /app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { supaService } from '@/lib/supa';          // 可選：有 Service Role 才會寫入
import { summarizeHistory } from '@/lib/summarize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type Body = { model?: string; messages: Msg[] };

export async function POST(req: Request) {
  const { model, messages }: Body = await req.json();

  // 平台系統提示：白話＋（術語）
  const system: Msg = {
    role: 'system',
    content: '你在一個工業平台中回覆；先白話＋（括號術語）。'
  };

  const payload = {
    model: model || env.OPENAI_MODEL || 'gpt-4o',
    messages: [system, ...(messages || [])],
    temperature: 0.2
  };

  const upstream = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: `upstream ${upstream.status}`, detail },
      { status: 500 }
    );
  }

  const data = await upstream.json();
  const text = data?.choices?.[0]?.message?.content ?? '';

  // 可選：有 Service Role 就把對話存一下（沒設也不會噴錯）
  try {
    const s = supaService(); // 若未設定 Service Role 會 throw，被 catch 吞掉
    await s.from('memory_short').insert({
      session_id: 'default',
      messages_json: JSON.stringify(messages || []),
      summary: await summarizeHistory(messages || [])
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, content: text, raw: data });
}
