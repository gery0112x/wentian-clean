// app/api/ops/trigger/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET;

  if (!url) throw new Error('Missing SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE (Service Role)');

  // 用 Service Role 建 admin client（會自動帶 Bearer key）
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const { op } = await req.json().catch(() => ({} as any));
    if (!op) {
      return NextResponse.json(
        { ok: false, error: 'bad_request: missing { op }' },
        { status: 400 },
      );
    }

    const supa = admin();

    // 先檢查目前角色（anon / service_role）
    const who = await supa.rpc('whoami');
    const role = (who.data as string) || 'unknown';

    if (op === 'ping') {
      return NextResponse.json({
        ok: true,
        platform: '無極',
        realm: '元始境 00-00',
        who: '柯老',
        db_role: role,
      });
    }

    if (role !== 'service_role') {
      return NextResponse.json(
        {
          ok: false,
          error:
            `RLS_BLOCKED: 現在用的是「${role}」不是 service_role。` +
            ` 請到 Vercel 專案設定 > Environment Variables，設定：` +
            ` SUPABASE_URL（專案 URL）與 SUPABASE_SERVICE_ROLE（Service Role key），並重新部署。`,
          hint: 'Service Role 會自動繞過 RLS；anon 會被擋。',
        },
        { status: 401 },
      );
    }

    if (op === 'seed_all') {
      // 基礎路由權限
      const { error: rErr } = await supa
        .from('roles_routes')
        .insert([
          { role: '無極.元始境 00-00', route: '/chat', allow: true },
          { role: '無極.元始境 00-00', route: '/api/*', allow: true },
          { role: '柯老', route: '/chat', allow: true },
          { role: '柯老', route: '/api/*', allow: true },
        ]);

      if (rErr) throw rErr;

      // 建一筆示範提案
      const { data: p, error: pErr } = await supa
        .from('proposals')
        .insert([
          {
            goal: '新增新版區塊（白話提案示例）',
            scope: { area: 'ui/header', files: ['app/layout.tsx', 'app/page.tsx'] },
            impact: { risk: 'low', systems: ['next', 'vercel'], users: 'all' },
            artifacts: { preview: null, pr: null },
            notes: '由 ops/trigger 建立的示範提案',
            status: 'draft',
            model: 'gpt-4o',
          },
        ])
        .select()
        .single();
      if (pErr) throw pErr;

      const { error: iErr } = await supa.from('proposal_items').insert([
        {
          proposal_id: p!.id,
          path: 'app/page.tsx',
          change: { type: 'insert', section: 'hero', text: 'Hello WUJI' },
          diff: '++ 新增 hero 區塊',
        },
      ]);
      if (iErr) throw iErr;

      await supa.from('audit_events').insert([
        {
          actor: '系統',
          action: 'bootstrap:seed',
          payload_json: { demo: true },
          result: { ok: true },
        },
      ]);

      return NextResponse.json({
        ok: true,
        op,
        db_role: role,
        seeded_proposal: p!.id,
      });
    }

    return NextResponse.json({ ok: false, error: `unknown op: ${op}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
