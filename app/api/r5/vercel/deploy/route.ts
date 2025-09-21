const { VERCEL_DEPLOY_HOOK } = process.env;

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST() {
  if (!VERCEL_DEPLOY_HOOK) {
    return j(500, {
      ok: false,
      error: { code: "CFG_MISSING", msg: "請設定 VERCEL_DEPLOY_HOOK（或改用 GitHub workflow 佈署）" },
    });
  }
  const r = await fetch(VERCEL_DEPLOY_HOOK, { method: "POST" });
  const text = await r.text();
  if (!r.ok) return j(r.status, { ok: false, error: { code: `VERCEL_${r.status}`, msg: text } });
  return j(200, { ok: true, data: { result: text } });
}
