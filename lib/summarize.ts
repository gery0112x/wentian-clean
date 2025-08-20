import { env } from "./env";

export async function summarizeHistory(history: Array<{role:string; content:string}>, longTerm: string) {
  const res = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: `請把以下對話濃縮為重點摘要（目的/決策/依賴/未解/指示）：
長期記憶（長期設定/規範/偏好）：${longTerm || "（無）"}` },
        ...history.slice(-30) // 避免太長
      ],
      max_tokens: 300
    })
  });
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}
