// app/api/r5/apply/route.ts
export async function POST(req: Request) {
  const ok = req.headers.get('authorization') === `Bearer ${process.env.R5_ACTIONS_TOKEN}`;
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const job = await req.json(); // { kind: "sql_migrate" | "deploy" | "gh_dispatch", ... }
  // 這裡用伺服端已配置的：SUPABASE_SERVICE_ROLE_KEY / GITHUB_TOKEN / VERCEL_TOKEN 去代轉
  // switch(job.kind) { ... 呼叫各家 API ... }
  return Response.json({ ok: true });
}
