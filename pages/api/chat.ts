// pages/api/chat.ts  —— Wuji v2.1：成本上蓋 + 嚴格 CORS + OpenAI 直連
import type { NextApiRequest, NextApiResponse } from "next";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

// ===== 參數 =====
const TZ = process.env.WUJI_TZ || "Asia/Taipei";
const CURRENCY = (process.env.WUJI_CURRENCY || "TWD").toUpperCase();
const FX_USD_TWD = Number(process.env.WUJI_FX_USD_TWD || 32);

// 上蓋（0 表不啟用）
const CAP_TURN  = Number(process.env.WUJI_COST_CAP_PER_TURN || "0");
const CAP_DAILY = Number(process.env.WUJI_DAILY_COST_CAP || "0");
const CAP_MONTH = Number(process.env.WUJI_MONTHLY_COST_CAP || "0");

// CORS 白名單
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// ===== CORS =====
function cors(res: NextApiResponse, req: NextApiRequest) {
  const origin = req.headers.origin || "";
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
}

// ===== 時區邊界（以 TZ 為準，輸出 ISO UTC）=====
function offsetOfTZ(zone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" });
  const off = fmt.formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || "GMT+00:00";
  const m = off.match(/GMT([+-]\d{2}):?(\d{2})?/i);
  return m ? `${m[1]}:${m[2] || "00"}` : "+00:00";
}
function startOfDayISO() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00${offsetOfTZ(TZ)}`).toISOString();
}
function startOfMonthISO() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" })
    .formatToParts(now);
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  return new Date(`${y}-${m}-01T00:00:00${offsetOfTZ(TZ)}`).toISOString();
}

// ===== Supabase REST 小工具 =====
async function sumCostBetween(startISO: string, endISO: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const q = new URL(`${url}/rest/v1/_io_gate_logs`);
  q.searchParams.set("select", "sum(cost)");
  q.searchParams.set("ts", `gte.${startISO}`);
  q.searchParams.append("ts", `lt.${endISO}`);
  q.searchParams.set("provider", "neq.env-check");
  const r = await fetch(q.toString(), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const js = await r.json().catch(() => []);
  const v = Array.isArray(js) && js[0] ? (Number(js[0].sum) || 0) : 0;
  return v;
}

async function writeGateLog(provider: string, model: string, usage: Usage, status: string, cost: number, meta?: any) {
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
    cost: Number(cost.toFixed(8)), // 以本地幣紀錄
    status, request_id: rid, meta: meta ?? null
  };

  await fetch(`${url}/rest/v1/_io_gate_logs`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row)
  }).catch(() => {});
}

// ===== 成本估算（GPT-4o mini）=====
function estimateCostLocal(usage: Usage) {
  // USD 單價（官方公開）：輸入 0.15 / 1M、輸出 0.60 / 1M
  const inUSD  = (Number(usage.prompt_tokens || 0)     / 1_000_000) * 0.15;
  const outUSD = (Number(usage.completion_tokens || 0) / 1_000_000) * 0.60;
  const usd = inUSD + outUSD;
  const local = CURRENCY === "USD" ? usd : usd * FX_USD_TWD;
  return { usd, local };
}

// ===== OpenAI 呼叫 =====
async function callOpenAI(messages: any[], model = "gpt-4o-mini") {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });
  const json: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OPENAI_${r.status}: ${JSON.stringify(json)}`);
  const text = json?.choices?.[0]?.message?.content ?? "";
  const usage: Usage = json?.usage ?? {};
  const usedModel: string = json?.model ?? model;
  return { text, usage, model: usedModel };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") { cors(res, req); return res.status(204).end(); }
  cors(res, req);

  try {
    // ---- 事前上蓋檢查 ----
    const nowISO = new Date().toISOString();
    if (CAP_MONTH > 0) {
      const usedM = await sumCostBetween(startOfMonthISO(), nowISO);
      if (usedM >= CAP_MONTH) return res.status(429).json({ error: "monthly_cap_exceeded", used: usedM, cap: CAP_MONTH });
    }
    if (CAP_DAILY > 0) {
      const usedD = await sumCostBetween(startOfDayISO(), nowISO);
      if (usedD >= CAP_DAILY) return res.status(429).json({ error: "daily_cap_exceeded", used: usedD, cap: CAP_DAILY });
    }

    // ---- 解析請求 ----
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
      res.setHeader("Allow", "GET, POST, OPTIONS");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ---- 呼叫模型 ----
    const result = await callOpenAI(messages, model);
    const priced = estimateCostLocal(result.usage);

    // 單回合上蓋（超過也會回應，但標註 over_cap）
    const overTurn = CAP_TURN > 0 && priced.local > CAP_TURN;

    await writeGateLog("OPENAI", result.model, result.usage, overTurn ? "over_cap" : "ok", priced.local, { from: "api/chat" });

    return res.status(200).json({
      provider: "OPENAI",
      model: result.model,
      usage: result.usage,
      currency: CURRENCY,
      cost_local: Number(priced.local.toFixed(6)),
      cap_notice: overTurn ? { per_turn_cap: CAP_TURN, exceeded_by: Number((priced.local - CAP_TURN).toFixed(6)) } : null,
      reply: result.text
    });
  } catch (e: any) {
    await writeGateLog("OPENAI", "unknown", {}, "error", 0, { error: e?.message || String(e) }).catch(() => {});
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
