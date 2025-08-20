import { env } from "@/lib/env";
import { getSupa } from "@/lib/supa";
import { summarizeHistory } from "@/lib/summarize";
export const runtime = 'nodejs';

type Msg = { role:"user"|"assistant"|"system"; content:string };

export async function POST(req: Request) {
  const { sessionId = "default", messages = [] } = await req.json() as {sessionId?:string; messages: Msg[]};
  const supa = getSupa();

  // 讀長期記憶（雙層：長期）
  let longTerm = "";
  if (supa) {
    const { data } = await supa.from("long_term_memory").select("content").eq("session_id", sessionId).single();
    longTerm = data?.content || "";
  }

  // 讀對話歷史（雙層：短期）
  let history: Msg[] = [];
  if (supa) {
    const { data } = await supa.from("memory_sessions").select("history,summary").eq("session_id", sessionId).single();
    history = data?.history || [];
    // 若超過 10 輪就簡述前文
    if (history.length > 10) {
      const summary = await summarizeHistory(history.slice(0, -10), longTerm);
      await supa.from("memory_sessions").upsert({ session_id: sessionId, summary, history: history.slice(-10) });
      history = history.slice(-10);
    }
  }

  const system: Msg = { role: "system", content: `你在一個工業平台中回覆：先白話＋（括號術語）。` + (longTerm ? ` 長期記憶：${longTerm}` : "") };

  const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.OPENAI_MODEL, temperature: 0.2, messages: [system, ...history, ...messages] })
  });
  const j = await r.json().catch(async () => ({ raw: await r.text() }));

  // 寫回短期歷史
  if (supa && Array.isArray(messages) && j?.choices?.[0]?.message?.content) {
    const newHist = [...history, ...messages, { role:"assistant", content: j.choices[0].message.content }] as Msg[];
    await supa.from("memory_sessions").upsert({ session_id: sessionId, history: newHist });
  }

  return Response.json(j, { status: r.status });
}
