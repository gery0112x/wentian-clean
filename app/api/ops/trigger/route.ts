// /app/api/ops/trigger/route.ts
import { NextResponse } from 'next/server';
import { currentDbRole, supaService } from '@/lib/supa';

export const runtime = 'nodejs';

type Body = { op?: 'ping' | 'seed_all' };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const op = body.op ?? 'ping';
  const role = currentDbRole();

  if (op === 'ping') {
    return NextResponse.json({
      ok: true,
      platform: '無極',
      realm: '元始境 00-00',
      who: '柯老',
      db_role: role,
    });
  }

  if (op === 'seed_all') {
    if (role !== 'service') {
      return NextResponse.json(
        { ok: false, error: 'RLS BLOCKED: seed 需要 service role' },
        { status: 401 },
      );
    }

    const s = supaService();
    try {
      // 範例：確保一筆基本資料存在（你有唯一鍵時可用 onConflict）
      // 這裡用 upsert；若你的表沒有唯一鍵，請先在 DB 設定唯一鍵（如 role+route）
      await s
        .from('roles_routes')
        .upsert([{ role: 'admin', route: '/chat', allow: true }], {
          onConflict: 'role,route',
        });

      return NextResponse.json({ ok: true, step: 'seed_all' });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, step: 'seed_all', error: e?.message ?? String(e) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
}
