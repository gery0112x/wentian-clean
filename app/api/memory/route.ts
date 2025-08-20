import { getSupa } from "@/lib/supa";
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId="default", longTerm="" } = body;
  const supa = getSupa();
  if (!supa) return Response.json({ ok:false, error:"MISSING_SUPABASE_ENV" }, { status:503 });
  await supa.from("long_term_memory").upsert({ session_id: sessionId, content: longTerm });
  return Response.json({ ok:true });
}
