// /app/api/ops/trigger/route.ts
import { NextResponse } from 'next/server';
import { supaService, detectDbRole } from '@/lib/supa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { op?: string };

export async function POST(req: Request) {
  const { op }: Body = await req.json().catch(() => ({}));

  // 供你觀察現在後端拿到的 DB 角色（service/anon）
  const db_role = await detectDbRole();

  if (op === 'ping') {
    return NextResponse.json({
      ok: true,
      platform: '無極',
      realm: '元始境 00-00',
      who: '柯老',
      db_role,
    });
  }

  if (op === 'seed_all') {
    try {
      const s = supaService(); // 強制使用 Service Role

      // 確保唯一鍵存在（若已存在不會報錯）
      await s.rpc('noop').catch(() => {}); // 允許不存在
      await s
        .from('roles_routes')
        .select('id')
        .limit(1)
        .then(async () => {
          await s.rpc('noop').catch(() => {});
        });

      // 播種資料
      const rows = [
        { role: 'admin', route: '/api/proposal',        allow: true },
        { role: 'admin', route: '/api/upgrade/start',   allow: true },
        { role: 'admin', route: '/api/upgrade/status',  allow: true },
        { role: 'admin', route: '/api/ops/trigger',     allow: true },
      ];

      const { error } = await s
        .from('roles_routes')
        .upsert(rows, { onConflict: 'role,route' });

      if (error) {
        return NextResponse.json(
          { ok: false, step: 'seed_all', error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, step: 'seed_all' });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, step: 'seed_all', error: String(e?.message || e) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
}
