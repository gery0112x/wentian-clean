// app/api/chat/route.ts
// 最短可用：直連 OpenAI，並把用量寫入 Supabase 的 _io_gate_logs
export const runtime = "nodejs"; // 保證用 Node runtime（避免 Edge 限制）

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

function pickProvider(): "OPENAI" | "UNSUPPORTED" {
  const enabled = (process.env.WUJI_PROVIDERS_ENABLED || "OPENAI")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const order = (process.env.WUJI_PROVIDER_ORDER || "OPENAI")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  for (const p of order) {
    if (!enabled.includes(p)) continue;
    if (p === "OPENAI" && process.env.OPENAI_API_KEY) return "OPENAI";
  }
  return "UNSUPPORTED";
}

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
  if (!r.ok) {
    const err = typeof json === "object" ? json : { error: String(json) };
    throw new Error(`OPENAI_${r.status}: ${JSON.stringify(err)}`);
  }
  const text = json?.choices?.[0]?.message?.content ?? "";
  const usage: Usage = json?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const usedModel: string = json?.model ?? model;
  return { text, usage, model: usedModel, raw: json };
}

async function writeGateLog(args: {
  provider: string; model: string; usage: Usage; status: string; meta?: any;
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
    cost: 0, // 先記 0；之後可按模型單價估算
    status: args.status,
    request_id: rid,
    meta: args.meta ?? null
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

async function handle(req: Request) {
  try {
    const provider = pickProvider();
    if (provider === "UNSUPPORTED") {
      return Response.json(
        { error: "No supported provider available. Enable OPENAI with OPENAI_API_KEY." },
        { status: 501 }
      );
    }

    // 兩種用法：GET ?q=...；或 POST { messages:[...] , model? }
    let messages: any[] = [];
    let model = "gpt-4o-mini";

    if (req.method === "GET") {
      const url = new URL(req.url);
      const q = url.searchParams.get("q") || "Say hello.";
      messages = [{ role: "user", content: q }];
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.messages)) messages = body.messages;
      if (typeof body?.model === "string" && body.model) model = body.model;
      if (messages.length === 0) {
        return Response.json({ error: "messages[] required" }, { status: 400 });
      }
    } else {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } });
    }

    const result = await callOpenAI(messages, model);
    await writeGateLog({ provider: "OPENAI", model: result.model, usage: result.usage, status: "ok", meta: { from: "api/chat" } });

    return Response.json({ provider: "OPENAI", model: result.model, usage: result.usage, reply: result.text }, { status: 200 });
  } catch (e: any) {
    await writeGateLog({
      provider: "OPENAI", model: "unknown",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      status: "error", meta: { error: e?.message || String(e) }
    }).catch(() => {});
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
