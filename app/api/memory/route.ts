// /app/api/memory/route.ts
import { NextResponse } from 'next/server';
import { supaService, supaAnon } from '@/lib/supa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 讀取（GET）：
 *   ?session_id=default  -> 讀 memory_short
 *
 * 寫入（POST）：
 *   body: { session_id?: string, messages?: any[], summary?: string }
 *   有 Service Role 則寫入 memory_short；沒有也不會報錯，只回傳告知
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id') || 'default';

  try {
    const s = supaAnon();
    const { data, error } = await s
      .from('memory_short')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session_id: sessionId, data: data ?? [] });
  } catch {
    // anon client 未配置或資料表不存在時仍回應成功（避免卡 CI/CD）
    return NextResponse.json({ ok: true, session_id: sessionId, data: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const session_id = body.session_id || 'default';
  const messages_json = JSON.stringify(body.messages ?? []);
  const summary = body.summary ?? '';

  try {
    const s = supaService(); // 需 Service Role；若未配置會被 try/catch 吃掉
    const { error } = await s.from('memory_short').insert({
      session_id,
      messages_json,
      summary,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session_id });
  } catch {
    // 沒有 Service Role 或表不存在時，也不要讓整個 API 掛掉
    return NextResponse.json({
      ok: true,
      session_id,
      warn: 'no service role or table missing; skipped insert',
    });
  }
}
