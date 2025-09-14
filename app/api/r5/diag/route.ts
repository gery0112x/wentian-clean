import { NextResponse } from 'next/server';

export async function GET() {
  const env = process.env;
  const has = (k: string) => !!env[k] && env[k]!.trim() !== '';
  return NextResponse.json({
    ok: true,
    r5: { ping: '/_r5/ping', diag: '/_r5/diag' },
    public: {
      NEXT_PUBLIC_R5_BASE: env.NEXT_PUBLIC_R5_BASE || null,
      NEXT_PUBLIC_MODELS_BASE: env.NEXT_PUBLIC_MODELS_BASE || null,
    },
    providers: {
      openai: has('OPENAI_API_KEY'),
      deepseek: has('DEEPSEEK_API_KEY'),
      grok: has('GROK_API_KEY'),
      gemini: has('GEMINI_API_KEY'),
    },
    ts: new Date().toISOString(),
  });
}
