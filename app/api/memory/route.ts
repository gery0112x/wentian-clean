// /app/api/memory/route.ts
import { NextResponse } from 'next/server';
import { supaService } from '@/lib/supa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const s = supaService();
  const { session_id = 'default', messages = [] } = await req.json().catch(() => ({}));

  try {
    const { data, error } = await s
      .from('memory_long')
      .insert({
        session_id,
        messages_json: JSON.stringify(messages),
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
