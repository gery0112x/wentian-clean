// /app/api/ops/trigger/route.ts
import { NextResponse } from 'next/server';
import { supaService, currentDbRole } from '@/lib/supa';

type Body = {
  op?: 'ping' | 'seed_all';
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const op = body.op ?? 'ping';

    // 單一入口：目前兩個動作 ping / seed_all
    if (op === 'ping') {
      // 用 service role 可同時當健康檢查與權限檢查
      let dbRole: 'service_role' | 'anon' = 'anon';
      try {
        const s = supaService();
        // 讀個 NOW() 試試 service key 是否能用（不需要真的查表）
        await s.rpc('pg_sleep', { seconds: 0 }).catch(() => null);
        dbRole = currentDbRole('service');
      } catch {
        dbRole = currentDbRole('anon');
      }

      return NextResponse.json({
        ok: true,
        platform: '無極',
        realm: '元始境 00-00',
        who: '柯老',
        db_role: dbRole,
      });
    }

    if (op === 'seed_all') {
      // 必須用 service role 才能繞過 RLS
      const s = supaService();

      // ===== 依你的資料表調整 =====
      // 這裡示範寫入 roles_routes（若你的欄位不同請改成你的 schema）
      // upsert 可避免重複
      const { error: err1 } = await s
        .from('roles_routes')
        .upsert(
          [
            { role: 'admin', route: '/chat', allow: true },
            { role: 'guest', route: '/api/llm/health', allow: true },
            { role: 'guest', route: '/api/version/info', allow: true },
          ],
          { onConflict: 'role,route' }
        );

      if (err1) {
        return NextResponse.json(
          { ok: false, step: 'seed.roles_routes', error: err1.message },
          { status: 500 }
        );
      }

      // 你還有其它表要 seed，就在下面繼續加（同樣使用 s = service client）
      // const { error: err2 } = await s.from('feature_flags').upsert([...], { onConflict: 'key' });
      // if (err2) return NextResponse.json({ ok:false, step: 'seed.feature_flags', error: err2.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        step: 'seed_all:done',
        db_role: 'service_role',
      });
    }

    return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
