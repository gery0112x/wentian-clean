// app/api/llm/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type ModelCode = 'DS' | '4O' | 'GM' | 'GK';

export async function POST(req: NextRequest) {
  try {
    const { modelCode, messages } = (await req.json()) as { modelCode: ModelCode; messages: Msg[] };

    if (!modelCode || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    switch (modelCode) {
      case 'DS':
        return NextResponse.json({ provider: 'deepseek', text: await callDeepSeek(messages) });
      case '4O':
        return NextResponse.json({ provider: 'openai', text: await callOpenAI(messages) });
      case 'GM':
        return NextResponse.json({ provider: 'gemini', text: await callGemini(messages) });
      case 'GK':
        return NextResponse.json({ provider: 'grok', text: await callGrok(messages) });
      default:
        return NextResponse.json({ error: 'unknown_model' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('LLM complete error', e);
    return NextResponse.json({ error: 'server_error', detail: String(e?.message || e) }, { status: 500 });
  }
}

// ---- Providers ----

async function callDeepSeek(messages: Msg[]): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('Missing DEEPSEEK_API_KEY');

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callOpenAI(messages: Msg[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // 你也可以改成 'gpt-4o'；這裡用 mini 省費
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callGemini(messages: Msg[]): Promise<string> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('Missing GOOGLE_API_KEY');

  // 轉成 Gemini 結構
  const contents = [
    {
      role: 'user',
      parts: [{ text: messages.map(m => `${m.role}: ${m.content}`).join('\n\n') }],
    },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? '';
  return text;
}

async function callGrok(messages: Msg[]): Promise<string> {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error('Missing GROK_API_KEY');

  // xAI Grok API 基本上與 OpenAI Chat Completions 相容
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-latest', // 若報錯可改 'grok-beta'
      messages,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}
