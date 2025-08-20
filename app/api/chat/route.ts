// app/api/chat/route.ts
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { messages = [], model } = await req.json();
  const key  = process.env.OPENAI_API_KEY;
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const m    = model || process.env.OPENAI_MODEL || 'gpt-4o';
  if (!key) return Response.json({ error:'MISSING_OPENAI_API_KEY' }, { status:500 });

  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: m, messages, temperature: 0.2 })
  });
  const j = await r.json().catch(async () => ({ raw: await r.text() }));
  return Response.json(j, { status: r.status });
}
