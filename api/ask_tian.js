// api/ask_tian.js  (Edge runtime, 無 top-level await/return)
// 功能：一鍵升級(元始開工) + 空庫自動 seed 藍圖 + 多核心路由 + 記憶 + 估價/生命線

export const config = { runtime: 'edge' };

// ---------- utils ----------
function J(status, data, extraHeaders) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(data), { status, headers });
}
function getCookie(req, key) {
  const raw = req.headers.get("cookie") || "";
  const parts = raw.split(";").map(s => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    const k = i >= 0 ? p.slice(0, i) : p;
    const v = i >= 0 ? p.slice(i + 1) : "";
    if (k === key) return decodeURIComponent(v);
  }
  return null;
}
function newSID() { return Math.random().toString(36).slice(2, 12); }

// ---------- Supabase ----------
async function sbFetch(path, opts = {}) {
  const base = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE || "";
  if (!base || !key) return new Response("no supabase", { status: 500 });
  return fetch(base + "/rest/v1" + path, {
    method: opts.method || "GET",
    headers: Object.assign({
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      prefer: "return=representation"
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
}
async function sbGetMessages(sid, limit) {
  try {
    const r = await sbFetch("/messages?sid=eq." + encodeURIComponent(sid) + "&select=role,content,created_at&order=created_at.asc&limit=" + (limit || 8));
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
async function sbInsert(table, row) {
  try {
    const r = await sbFetch("/" + table, { method: "POST", body: row });
    if (!r.ok) return { ok: false, status: r.status, detail: await r.text().catch(() => "") };
    const data = await r.json().catch(() => ({}));
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e) }; }
}
async function sbPutKV(key, value) {
  await sbFetch("/config_kv?key=eq." + encodeURIComponent(key), { method: "DELETE" }).catch(() => {});
  return sbInsert("config_kv", { key, value });
}

// ---------- cost / lifeline ----------
function priceSheet() {
  const g = (k, v) => (process.env[k] ? parseFloat(process.env[k]) : v);
  return {
    gpt4o_in:       g("PRICE_GPT4O_IN",        5.00),
    gpt4o_out:      g("PRICE_GPT4O_OUT",      15.00),
    gpt4omini_in:   g("PRICE_GPT4OMINI_IN",    0.15),
    gpt4omini_out:  g("PRICE_GPT4OMINI_OUT",   0.60),
    deepseek_in:    g("PRICE_DEEPSEEK_IN",     0.27),
    deepseek_out:   g("PRICE_DEEPSEEK_OUT",    1.10),
    gemini_in:      g("PRICE_GEMINI_IN",       1.25),
    gemini_out:     g("PRICE_GEMINI_OUT",      5.00),
    grok_in:        g("PRICE_GROK_IN",         5.00),
    grok_out:       g("PRICE_GROK_OUT",       15.00)
  };
}
function estUSD(core, inChars, outChars, model) {
  const toTok = ch => Math.max(1, Math.round((ch || 0) / 3.5));
  const u = toTok(inChars), o = toTok(outChars || 250);
  const P = priceSheet();
  let In = 0, Out = 0;
  if (core === "gpt4o" || (/^gpt-4o/.test(model || ""))) { In = P.gpt4o_in; Out = P.gpt4o_out; }
  else if (core === "deepseek" || (/deepseek/.test(model || ""))) { In = P.deepseek_in; Out = P.deepseek_out; }
  else if (core === "gemini") { In = P.gemini_in; Out = P.gemini_out; }
  else if (core === "grok") { In = P.grok_in; Out = P.grok_out; }
  else { In = P.gpt4omini_in; Out = P.gpt4omini_out; }
  return Number(((u / 1000) * In + (o / 1000) * Out).toFixed(4));
}
function levelBy(usd) {
  const B = Math.max(0.01, parseFloat(process.env.DAILY_BUDGET_USD || "2"));
  const r = usd / B;
  if (r < 0.02) return "L1";
  if (r < 0.05) return "L2";
  if (r < 0.10) return "L3";
  if (r < 0.20) return "L4";
  return "L5";
}

// ---------- upstream callers ----------
async function callOpenAI(messages, max_tokens) {
  const key   = process.env.OPENAI_API_KEY;
  const base  = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!key) return { ok:false, why:"no_openai_key" };
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": "Bearer " + key },
    body: JSON.stringify({ model, messages, max_tokens: max_tokens || 400, temperature: 0.2 })
  });
  if (!r.ok) return { ok:false, why:"openai_http", status:r.status, detail: await r.text().catch(() => "") };
  const data = await r.json();
  const text = (data && data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
  return { ok:true, model, content:text };
}
async function callGemini(messages, max_tokens) {
  const key   = process.env.GEMINI_API_KEY;
  const base  = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  if (!key) return { ok:false, why:"no_gemini_key" };
  const url = base + "/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
  const text = messages.map(m => m.content).join("\n");
  const r = await fetch(url, {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body: JSON.stringify({ contents:[{ role:"user", parts:[{ text }] }], generationConfig:{ maxOutputTokens:max_tokens || 400 } })
  });
  if (!r.ok) return { ok:false, why:"gemini_http", status:r.status, detail: await r.text().catch(() => "") };
  const data = await r.json();
  const out  = (data && data.candidates && data.candidates[0] && data.candidates[0].content)
             ? (data.candidates[0].content.parts || []).map(p => p.text || "").join("")
             : "";
  return { ok:true, model, content: out };
}
async function callGrok(messages, max_tokens) {
  const key   = process.env.GROK_API_KEY;
  const model = process.env.GROK_MODEL || "grok-2";
  if (!key) return { ok:false, why:"no_grok_key" };
  const text = messages.map(m => m.content).join("\n");
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method:"POST",
    headers:{ "content-type":"application/json", "authorization":"Bearer " + key },
    body: JSON.stringify({ model, messages:[{ role:"user", content:text }], max_tokens:max_tokens || 400, temperature:0.2 })
  });
  if (!r.ok) return { ok:false, why:"grok_http", status:r.status, detail: await r.text().catch(() => "") };
  const data = await r.json();
  const out  = (data && data.choices && data.choices[0] && data.choices[0].message)
             ? data.choices[0].
