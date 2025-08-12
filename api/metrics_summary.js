export const config = { runtime: 'edge' };

function J(status, data) {
  return new Response(JSON.stringify(data), { status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'} });
}

export default async function handler(req) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/,'') + `/rest/v1/routing_events?select=core,estimate_usd,created_at`;
  const key = process.env.SUPABASE_SERVICE_ROLE || '';
  if (!url || !key) return J(200, { ok:false, why:'no_supabase' });
  const r = await fetch(url, { headers:{ 'apikey':key, 'authorization':`Bearer ${key}` } });
  if (!r.ok) return J(200, { ok:false, why:'supabase_http', status:r.status, detail: await r.text().catch(()=> '') });
  const rows = await r.json();
  const total = rows.reduce((s,x)=> s + (parseFloat(x.estimate_usd)||0), 0);
  const byCore = {};
  for (const x of rows) byCore[x.core] = (byCore[x.core]||0) + (parseFloat(x.estimate_usd)||0);
  return J(200, { ok:true, total_usd: Number(total.toFixed(4)), by_core: byCore });
}
