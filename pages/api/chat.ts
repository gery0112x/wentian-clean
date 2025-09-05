// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

async function callOpenAI(messages: any[], model = "gpt-4o-mini") {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });
  const json: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OPENAI_${r.status}: ${JSON.stringify(json)}`);
  const text = json?.choices?.[0]?.message?.content ?? "";
  const usage: Usage = json?.usage ?? {};
  const usedModel: string = json?.model ?? model;
  return { text, usage, model: usedModel };
}

async function writeGateLog(provider: string, model: string, usage: Usage, status: string, meta?: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const rid = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-wuji`;

  const row = {
    ts: new Date().toISOString(),
    user_id: "wuji-app",
    route: process.env.WUJI_GATE_PATH || "/api/chat",
    provider, model,
    tokens_in: Number(usage.prompt_tokens || 0),
    tokens_out: Number(usage.completion_tokens || 0),
    cost: 0, // 之後再加成本估算
    status,
    request_id: rid,
    meta: meta ?? null
  };

  await fetch(`${url}/rest/v1/_io_gate_logs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(row)
  }).catch(() => {});
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let messages: any[] = [];
    let model = "gpt-4o-mini";

    if (req.method === "GET") {
      const q = (req.query.q as string) || "Say hello.";
      messages = [{ role: "user", content: q }];
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (Array.isArray(body?.messages)) messages = body.messages;
      if (typeof body?.model === "string" && body.model) model = body.model;
      if (messages.length === 0) return res.status(400).json({ error: "messages[] required" });
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const result = await callOpenAI(messages, model);
    await writeGateLog("OPENAI", result.model, result.usage, "ok", { from: "api/chat" });

    return res.status(200).json({ provider: "OPENAI", model: result.model, usage: result.usage, reply: result.text });
  } catch (e: any) {
    await writeGateLog("OPENAI", "unknown", { }, "error", { error: e?.message || String(e) }).catch(() => {});
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
