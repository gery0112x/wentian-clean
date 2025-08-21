// /app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { supaService } from '@/lib/supa';          // 有 Service Role 就寫入，沒有也不影響
import { summarizeHistory } from '@/lib/summarize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type Body = { model?: string; messages: Msg[] };

export async function POST(req: Request) {
  const { model, messages }: Body = await req.json().catch(() => ({ messages: [] as Msg[] }));

  const system: Msg = {
    role: 'system',
    content: '你在工業平台中回覆，請先白話＋（括號術語）。'
  };

  const payload = {
    model: model || env.OPENAI_MODEL || 'gpt-4o',
    messages: [system, ...(messages || [])],
    temperature: 0.2
  };

  const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return NextResponse.json({ ok: false, error: `upstream ${r.status}`, detail }, { status: 500 });
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? '';

  // （可選）有 Service Role 就把對話存一下；沒設也不會壞
  try {
    const s = supaService();
    await s.from('memory_short').insert({
      session_id: 'default',
      messages_json: JSON.stringify(messages || []),
      // 你的 summarizeHistory 在專案內原本要 2 參數；我們在 summarize.ts 做了預設值，這裡照傳也 OK
      summary: await summarizeHistory(messages || [])
    });
  } catch {
    /* ignore: 沒 Service Role 或表不存在時不影響回應 */
  }

  return NextResponse.json({ ok: true, content: text, raw: data });
}
