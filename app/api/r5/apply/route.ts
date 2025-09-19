// app/api/r5/apply/route.ts
export const runtime = 'edge';

/** ====== 環境需求（沒設會回 500 說明） ======
 * R5_ACTIONS_TOKEN              // 本路由的Bearer
 * VERCEL_TOKEN, VERCEL_PROJECT_ID [, VERCEL_TEAM_ID]    // vercel_promote用
 * GH_TOKEN, GH_OWNER, GH_REPO                           // gh_dispatch / sql_migrate 用
 * SQL_MIGRATION_WORKFLOW? (預設: sql-migrate.yml)       // GH workflow file
 * SQL_MIGRATION_PATH?    (預設: supabase/migrations/20250915_gov_coldstore.sql)
 * SQL_MIGRATION_REF?     (預設: main)
 * DEFAULT_RELEASE_WORKFLOW? (預設: r5-release-on-green.yml)
 */

function okAuth(req: Request) {
  const token = process.env.R5_ACTIONS_TOKEN || process.env.R5_RW_TEST;
  const got = req.headers.get('authorization') || '';
  return !!token && got === `Bearer ${token}`;
}

function must(env: string | undefined, name: string) {
  if (!env) throw new Error(`MISSING_ENV:${name}`);
  return env;
}

async function jsonRes<T>(p: Promise<T>, status = 200) {
  try { return Response.json(await p, { status }); }
  catch (e: any) { return Response.json({ ok:false, error: String(e.message||e) }, { status: 500 }); }
}

export async function GET() {
  return Response.json({ ok:true, service:'r5-apply', ts:new Date().toISOString() });
}

export async function POST(req: Request) {
  if (!okAuth(req)) return new Response('Unauthorized', { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}

  const kind = body?.kind || 'ping';
  if (kind === 'ping') return Response.json({ ok:true, kind, ts:new Date().toISOString() });
  if (kind === 'echo') return Response.json({ ok:true, kind, data: body?.data ?? null });

  // ---------- vercel_promote：取最新 READY 的 preview → promote 到 production ----------
  if (kind === 'vercel_promote') {
    return jsonRes((async () => {
      const token = must(process.env.VERCEL_TOKEN, 'VERCEL_TOKEN');
      const projectId = must(process.env.VERCEL_PROJECT_ID, 'VERCEL_PROJECT_ID');
      const team = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : '';

      // 1) 找最新 READY preview
      const list = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&state=READY&target=preview&limit=1${team}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(`vercel list: ${r.status} ${t}`); }));

      const dep = list?.deployments?.[0];
      if (!dep?.uid) throw new Error('NO_READY_PREVIEW');

      // 2) promote
      const promote = await fetch(`https://api.vercel.com/v13/deployments/${dep.uid}/promote?target=production${team}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ meta: { triggeredBy: 'r5-apply' } })
      }).then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(`vercel promote: ${r.status} ${t}`); }));

      return { ok:true, kind, preview: dep.uid, promote };
    })());
  }

  // ---------- gh_dispatch：觸發 GitHub workflow_dispatch ----------
  if (kind === 'gh_dispatch') {
    return jsonRes((async () => {
      const token = must(process.env.GH_TOKEN, 'GH_TOKEN');
      const owner = must(process.env.GH_OWNER, 'GH_OWNER');
      const repo  = must(process.env.GH_REPO,  'GH_REPO');
      const workflow = body?.workflow || process.env.DEFAULT_RELEASE_WORKFLOW || 'r5-release-on-green.yml';
      const ref = body?.ref || 'main';
      const inputs = body?.inputs || {};

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        },
        body: JSON.stringify({ ref, inputs })
      });
      if (!res.ok) throw new Error(`gh_dispatch: ${res.status} ${await res.text()}`);
      return { ok:true, kind, workflow, ref, inputs };
    })());
  }

  // ---------- sql_migrate：用 GitHub workflow 跑指定 SQL 檔 ----------
  if (kind === 'sql_migrate') {
    return jsonRes((async () => {
      const token = must(process.env.GH_TOKEN, 'GH_TOKEN');
      const owner = must(process.env.GH_OWNER, 'GH_OWNER');
      const repo  = must(process.env.GH_REPO,  'GH_REPO');
      const workflow = process.env.SQL_MIGRATION_WORKFLOW || 'sql-migrate.yml';
      const ref = process.env.SQL_MIGRATION_REF || 'main';
      const sql_path = body?.sql_path || process.env.SQL_MIGRATION_PATH || 'supabase/migrations/20250915_gov_coldstore.sql';

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        },
        body: JSON.stringify({ ref, inputs: { sql_path } })
      });
      if (!res.ok) throw new Error(`sql_migrate: ${res.status} ${await res.text()}`);
      return { ok:true, kind, workflow, ref, sql_path };
    })());
  }

  return Response.json({ ok:false, error:'UNSUPPORTED_KIND', kind }, { status: 400 });
}
