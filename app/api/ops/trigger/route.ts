// app/api/ops/trigger/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { supaService, currentDbRole } from '@/lib/supa';

export const runtime = 'nodejs';

type Op = 'ping' | 'seed_all';

export async function POST(req: NextRequest) {
  try {
    const { op } = (await req.json().catch(() => ({}))) as { op?: Op };

    if (op === 'ping') {
      return NextResponse.json({
        ok: true,
        platform: '無極',
        realm: '元始境 00-00',
        who: '柯老',
        db_role: currentDbRole(),
      });
    }

    if (op === 'seed_all') {
      // 僅在 Service Role 下允許「播種」
      if (currentDbRole() !== 'service') {
        return NextResponse.json(
          { ok: false, error: 'RLS BLOCKED：請以 Service Role 執行種子資料' },
          { status: 401 },
        );
      }

      const s = supaService();

      // 確保資料表 roles_routes 存在資料（用 upsert 去重複）
      const rows = [
        { role: 'anon', route: '/chat', allow: true },
        { role: 'anon', route: '/api/llm/health', allow: true },
        { role: 'anon', route: '/api/version/info', allow: true },
        { role: 'service', route: '/api/ops/trigger', allow: true },
      ];

      for (const r of rows) {
        const { error } = await s
          .from('roles_routes')
          .upsert(r, { onConflict: 'role,route' }); // 需有複合唯一鍵 (role,route)
        if (error) throw error;
      }

      return NextResponse.json({ ok: true, step: 'seed_all(done)' });
    }

    return NextResponse.json(
      { ok: false, error: 'unknown op' },
      { status: 400 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
