// pages/api/chat.ts  —— Wuji v2.1 帶成本上蓋 + 嚴格 CORS
import type { NextApiRequest, NextApiResponse } from "next";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

// ------ 基本設定 ------
const TZ = process.env.WUJI_TZ || "Asia/Taipei";
const CURRENCY = (process.env.WUJI_CURRENCY || "TWD").toUpperCase();
const FX_USD_TWD = Number(process.env.WUJI_FX_USD_TWD || 32); // 可在環境變數覆寫
const CAP_TURN = Number(process.env.WUJI_COST_CAP_PER_TURN || "0");      // 0 = 不啟用
const CAP_DAILY = Number(process.env.WUJI_DAILY_COST_CAP || "0");        // 0 = 不啟用
const CAP_MONTH = Number(process.env.WUJI_MONTHLY_COST_CAP || "0");      // 0 = 不啟用
const ALLOWED = (process.env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

function cors(res: NextApiResponse, req: NextApiRequest) {
  const origin = req.headers.origin || "";
  if (origin && ALLOWED.some(a => a === origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
}

// ------ 時間邊界（以 TZ 計算，但 REST 用 UTC ISO）------
function startOfDayISO() {
  const now = new Date();
  const z = new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour12:false,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const y = z.find(p=>p.type==="year")!.value, m = z.find(p=>p.type==="month")!.value, d = z.find(p=>p.type==="day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00${offsetOfTZ(TZ)}`).toISOString();
}
function startOfMonthISO() {
  const now = new Date();
  const z = new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour12:false,year:"numeric",month:"2-digit"}).formatToParts(now);
  const y = z.find(p=>p.type==="year")!.value, m = z.find(p=>p.type==="month")!.value;
  return new Date(`${y}-${m}-01T00:00:00${offsetOfTZ(TZ)}`).toISOString();
}
function offsetOfTZ(zone:string) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" });
  const parts = fmt.formatToParts(new Date());
  const off = parts.find(p=>p.type==="timeZoneName")?.value || "GMT+00:00";
  // 轉成 ±HH:MM
  const m = off.match(/GMT([+-]\d{2}):?(\d{2})?/i);
  return m ? `${m[1]}:${m[2]||"00"}` : "+00:00";
}

// ------ Supabase REST 小工具 ------
async function sumCostBetween(startISO:string, endISO:string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const q = new URL(`${url}/rest/v1/_io_gate_logs`);
  q.searchParams.set("select", "sum(cost)");
  q.searchParams.set("ts", `gte.${startISO}`);
  q.searchParams.append("ts", `lt.${endISO}`);
  q.searchParams.set("provider", "neq.env-check"); // 排除檢查用假資料
  const r = await fetch(q.toString(), { headers: { apikey:key, Authorization:`Bearer ${key}` }});
  const js = await r.json().catch(()=>[]);
  const v = Array.isArray(js) && js[0] ? (Number(js[0].sum) || 0) : 0;
  return v;
}

async function writeGateLog(provider:string, model:string, usage:Usage, status:string, cost:number, meta?:any) {
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
    cost: Number(cost.toFixed(8)), // 以本地幣別紀錄
    status, request_id: rid, meta: meta ?? null
  };
  await fetch(`${url}/rest/v1/_io_gate_logs`, {
    method:"POST",
    headers:{ apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json", Prefer:"return=minimal" },
    body: JSON.stringify(row)
  }).catch(()=>{});
}

// ------ 成本估算：採官方定價（gpt-4o-mini）------
function estimateCostLocal(usage:Usage, model:string) {
  // 目前只支援 gpt-4o-mini 的價目，之後可擴充表
  const inUSD  = (Number(usage.prompt_tokens||0)    / 1_000_000) * 0.15; // $/1M in
  const outUSD = (Number(usage.completion_tokens||0)/ 1_000_000) * 0.60; // $/1M out
  const usd = inUSD + outUSD;
  const local = CURRENCY === "USD" ? usd : usd * FX_USD_TWD;
  return { usd, local };
}

// ------ OpenAI 呼叫 ------
async function callOpenAI(messages:any[], model="gpt-4o-mini") {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model, messages, temperature:0.2 })
  });
  const json:any = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`OPENAI_${r.status}: ${JSON.stringify(json)}`);
  const text  = json?.choices?.[0]?.message?.content ?? "";
  const usage:Usage = json?.usage ?? {};
  const usedModel:string = json?.model ?? model;
  return { text, usage, model: usedModel };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") { cors(res, req); return res.status(204).end(); }
  cors(res, req);

  try {
    // ---- 事前上蓋檢查（超過即拒絕）----
    const dayStart  = startOfDayISO();
    const dayEnd    = new Date().toISOString();
    const monthStart= startOfMonthISO();
    const monthEnd  = new Date().toISOString();

    // 僅在有設定上蓋時才查詢 DB
    if (CAP_MONTH > 0) {
      const usedM = await sumCostBetween(monthStart, monthEnd);
      if (usedM >= CAP_MONTH) return res.status(429).json({ error:"monthly_cap_exceeded", used: usedM, cap: CAP_MONTH });
    }
    if (CAP_DAILY > 0) {
      const usedD = await sumCostBetween(dayStart, dayEnd);
      if (usedD >= CAP_DAILY) return res.status(429).json({ error:"daily_cap_exceeded", used: usedD, cap: CAP_DAILY });
    }

    // ---- 解析請求 ----
    let messages:any[] = [];
    let model = "gpt-4o-mini";
    if (req.method === "GET") {
      const q = (req.query.q as string) || "Say hello.";
      messages = [{ role:"user", content:q }];
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (Array.isArray(body?.messages)) messages = body.messages;
      if (typeof body?.model === "string" && body.model) model = body.model;
      if (messages.length === 0) return res.status(400).json({ error:"messages[] required" });
    } else {
      res.setHeader("Allow","GET, POST, OPTIONS");
      return res.status(405).json({ error:"Method Not Allowed" });
    }

    // ---- 呼叫模型 ----
    const result = await callOpenAI(messages, model);
    const priced = estimateCostLocal(result.usage, result.model);

    // ---- 單回合上蓋：若超標，仍回應但標示 over_cap ----
    const overTurn = CAP_TURN > 0 && priced.local > CAP_TURN;

    await writeGateLog("OPENAI", result.model, result.usage, overTurn ? "over_cap" : "ok", priced.local, { from:"api/chat" });

    return res.status(200).json({
      provider:"OPENAI",
      model: result.model,
      usage: result.usage,
      currency: CURRENCY,
      cost_local: Number(priced.local.toFixed(6)),
      cap_notice: overTurn ? { per_turn_cap: CAP_TURN, exceeded_by: Number((priced.local - CAP_TURN).toFixed(6)) } : null,
      reply: result.text
    });
  } catch (e:any) {
    // 失敗也記一筆（成本=0）
    await writeGateLog("OPENAI", "unknown", {}, "error", 0, { error: e?.message || String(e) }).catch(()=>{});
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
