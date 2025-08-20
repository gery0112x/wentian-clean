import { env } from "@/lib/env";
import { getSupa } from "@/lib/supa";
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { sessionId="default", utterance="", includeErrors=true, models=[] } = await req.json();

  // 拉錯誤併案（可無 Supabase，自動降級）
  const supa = getSupa();
  let errorNotes = "";
  if (includeErrors && supa) {
    const { data } = await supa.from("error_backlog").select("title,detail").limit(5);
    errorNotes = (data||[]).map((d:any)=>`- ${d.title}: ${d.detail}`).join("\n");
  }

  const prompt = [
    { role:"system", content: "用白話＋（術語）產出『異動條文表單』，欄位固定 10 格：Goal/Scope/Change Items/Flowchart(Mermaid)/Artifacts/ProsCons/ RiskRollback/Dependencies/Estimate/ErrorMerge+Advice。輸出 JSON。" },
    { role:"user", content: `我的需求（白話）：${utterance}\n若有既有錯誤併案：\n${errorNotes || "（無）"}` }
  ];

  const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model: env.OPENAI_MODEL, temperature:0.2, messages: prompt, response_format: { type: "json_object" } })
  });

  const j = await r.json().catch(async()=>({ raw: await r.text()}));
  return Response.json(j, { status: r.status });
}
