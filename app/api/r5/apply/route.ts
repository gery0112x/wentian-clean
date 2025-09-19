// app/api/r5/apply/route.ts
export const runtime = 'edge';

function auth(req: Request) {
  const token = process.env.R5_ACTIONS_TOKEN || process.env.R5_RW_TEST;
  const got = req.headers.get('authorization') || '';
  const ok = token && got === `Bearer ${token}`;
  return ok;
}

export async function GET() {
  return Response.json({ ok: true, service: 'r5-apply', ts: new Date().toISOString() });
}

export async function POST(req: Request) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch (_) {}

  const kind = body?.kind || 'ping';

  // ---- 最小閉環：先支援 ping / echo ----
  if (kind === 'ping') {
    return Response.json({ ok: true, kind, ts: new Date().toISOString() });
  }
  if (kind === 'echo') {
    return Response.json({ ok: true, kind, data: body?.data ?? null });
  }

  // ---- 預留：之後在這裡代轉 GitHub / Supabase / Vercel ----
  // if (kind === 'sql_migrate') { ...使用 SUPABASE_SERVICE_ROLE_KEY 呼叫 SQL API... }
  // if (kind === 'vercel_promote') { ...使用 VERCEL_TOKEN 打 Promote API... }
  // if (kind === 'gh_dispatch') { ...使用 GITHUB_TOKEN 觸發 workflow_dispatch... }

  return Response.json({ ok: false, error: 'UNSUPPORTED_KIND', kind }, { status: 400 });
}
