// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

/** 依環境變數決定可用供應商與優先序（預設：OPENAI, DEEPSEEK, GOOGLE, XAI） */
const ENABLED = (process.env.WUJI_PROVIDERS_ENABLED || "OPENAI")
  .split(",")
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);
const ORDER = (process.env.WUJI_PROVIDER_ORDER || "OPENAI")
  .split(",")
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);

/** 選擇可用供應商（目前先實作 OPENAI；其他回 501 不支援） */
function pickProvider(): "OPENAI" | "UNSUPPORTED" {
  for (const p of ORDER) {
    if (!ENABLED.includes(p)) continue;
    if (p === "OPENAI" && process.env.OPENAI_API_KEY) return "OPENAI";
  }
  return "UNSUPPORTED";
}

/** 呼叫 OpenAI Chat Completions（最短路徑：gpt-4o-mini） */
async function callOpenAI(messages: any[], model = "gpt-4o-mini") {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2
    })
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = typeof json === "object" ? json : { error: String(json) };
    throw new Error(`OPENAI_${r.status}: ${JSON.stringify(err)}`);
  }
  const text = json?.choices?.[0]?.message?.content ?? "";
  const usage = json?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const usedModel = json?.model ?? model;
  return { text, usage, model: usedModel, raw: json };
}

/** 將結果寫入 _io_gate_logs（僅伺服端；不會曝露金鑰） */
async function writeGateLog(args: {
  provider: string;
  model: string;
  usage: { prompt_tokens?: number; completion_tokens?: number };
  status: string;
  meta?: any;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const rid = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-wuji`;

  const row = {
    ts: new Date().toISOString(),
    user_id: "wuji-app",
    route: process.env.WUJI_GATE_PATH || "/api/chat",
    provider: args.provider,
    model: args.model,
    tokens_in: Number(args.usage.prompt_tokens || 0),
    tokens_out: Number(args.usage.completion_tokens || 0),
    cost: 0, // 最短路徑：成本暫記 0；之後可改為依模型單價估算
    status: args.status,
    request_id: rid,
    meta: args.meta || null
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
    const provider = pickProvider();
    if (provider === "UNSUPPORTED") {
      res.status(501).json({ error: "No supported provider available. Enable OPENAI with OPENAI_API_KEY." });
      return;
    }

    // 支援兩種用法：
    // 1) GET ?q=hello（方便你用瀏覽器測）
    // 2) POST { messages: [{role:'user', content:'...'}], model? }
    let messages: any[] = [];
    let model = (req.method === "POST" ? (req.body?.model as string) : undefined) || "gpt-4o-mini";

    if (req.method === "GET") {
      const q = (req.query.q as string) || "Say hello.";
      messages = [{ role: "user", content: q }];
    } else if (req.method === "POST") {
      if (typeof req.body === "string") {
        try { req.body = JSON.parse(req.body); } catch {}
      }
      messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      if (messages.length === 0) {
        res.status(400).json({ error: "messages[] required" });
        return;
      }
    } else {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    // 目前只實作 OPENAI，其他供應商之後再擴充
    const result = await callOpenAI(messages, model);
    await writeGateLog({
      provider: "OPENAI",
      model: result.model,
      usage: result.usage,
      status: "ok",
      meta: { from: "api/chat" }
    });

    res.status(200).json({
      provider: "OPENAI",
      model: result.model,
      usage: result.usage,
      reply: result.text
    });
  } catch (e: any) {
    // 失敗也寫一筆 log（不阻擋回應）
    await writeGateLog({
      provider: "OPENAI",
      model: "unknown",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      status: "error",
      meta: { error: e?.message || String(e) }
    }).catch(() => {});
    res.status(500).json({ error: e?.message || String(e) });
  }
}
