// app/api/ops/trigger/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const { op } = await req.json().catch(() => ({ op: 'seed_all' }));
    const supa = admin();

    if (op === 'seed_all') {
      // 基礎權限：讓「無極.元始境 00-00」與「柯老」可用主要路徑
      await supa.from('roles_routes').insert([
        { role: '無極.元始境 00-00', route: '/chat', allow: true },
        { role: '無極.元始境 00-00', route: '/api/*', allow: true },
        { role: '柯老', route: '/chat', allow: true },
        { role: '柯老', route: '/api/*', allow: true },
      ]).select().throwOnError();

      // 建立一筆示範提案（白話提案：新增新版區塊）
      const { data: p, error: pe } = await supa.from('proposals').insert([{
        goal: '新增新版區塊（白話提案示例）',
        scope: { area: 'ui/header', files: ['app/layout.tsx','app/page.tsx'] },
        impact: { risk: 'low', systems: ['next','vercel'], users: 'all' },
        artifacts: { preview: null, pr: null },
        notes: '由 ops/trigger 建立的示範提案',
        status: 'draft',
        model: 'gpt-4o'
      }]).select().single();

      if (pe) throw pe;

      // 加入一條細項
      await supa.from('proposal_items').insert([{
        proposal_id: p!.id,
        path: 'app/page.tsx',
        change: { type: 'insert', section: 'hero', text: 'Hello WUJI' },
        diff: '++ 新增 hero 區塊'
      }]).throwOnError();

      // 審計一筆
      await supa.from('audit_events').insert([{
        actor: '系統',
        action: 'bootstrap:seed',
        payload_json: { demo: true },
        result: { ok: true }
      }]).throwOnError();

      return NextResponse.json({ ok: true, op, seeded_proposal: p!.id });
    }

    if (op === 'ping') {
      return NextResponse.json({ ok: true, platform: '無極', realm: '元始境 00-00', who: '柯老' });
    }

    return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
