// api/ask_tian.js  (Edge runtime, safe version)
// 一鍵升級(元始開工) + 空庫自動 seed 藍圖 + 多核心路由 + 記憶 + 估價/生命線

export const config = { runtime: "edge" };

/* -------------------- utils -------------------- */
function J(status, data, extraHeaders) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (extraHeaders) for (const k in extraHeaders) headers[k] = extraHeaders[k];
  return new Response(JSON.stringify(data), { status, headers });
}
function getCookie(req, key) {
  const raw = req.headers.get("cookie") || "";
  const parts = raw.split(";").map(s => s.trim());
  for (let i=0;i<parts.length;i++){
    const p = parts[i]; if(!p) continue;
    const j = p.indexOf("="); const k = j>=0 ? p.slice(0,j) : p; const v = j>=0 ? p.slice(j+1) : "";
    if (k === key) return decodeURIComponent(v);
  }
  return null;
}
function newSID(){ return Math.random().toString(36).slice(2,12); }

/* -------------------- Supabase -------------------- */
async function sbFetch(path, opts) {
  const base = (process.env.SUPABASE_URL || "").replace(/\/+$/,"");
  const key  = process.env.SUPABASE_SERVICE_ROLE || "";
  if (!base || !key) return new Response("no supabase", { status: 500 });
  return fetch(base + "/rest/v1" + path, {
    method: (opts && opts.method) || "GET",
    headers: Object.assign({
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      prefer: "return=representation"
    }, (opts && opts.headers) || {}),
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
}
async function sbInsert(table, row){
  try{
    const r = await sbFetch("/"+table, { method:"POST", body: row });
    if (!r.ok) return { ok:false, status:r.status, detail: await r.text().catch(()=> "") };
    const data = await r.json().catch(()=> ({}));
    return { ok:true, data };
  }catch(e){ return { ok:false, error:String(e) }; }
}
async function sbGetMessages(sid, limit){
  try{
    const r = await sbFetch("/messages?sid=eq."+encodeURIComponent(sid)+"&select=role,content,created_at&order=created_at.asc&limit="+(limit||8));
    if(!r.ok) return [];
    return await r.json();
  }catch(e){ return []; }
}
async function sbPutKV(key, value){
  await sbFetch("/config_kv?key=eq."+encodeURIComponent(key), { method:"DELETE" }).catch(()=>{});
  return sbInsert("config_kv", { key, value });
}

/* -------------------- price & life -------------------- */
function priceSheet(){
  function g(k,v){ return process.env[k] ? parseFloat(process.env[k]) : v; }
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
function estUSD(core, inChars, outChars, model){
  function toTok(ch){ return Math.max(1, Math.round((ch||0)/3.5)); }
  const u = toTok(inChars), o = toTok(outChars || 250);
  const P = priceSheet(); let In=0, Out=0;
  if (core==="gpt4o" || (/^gpt-4o/.test(model||""))){ In=P.gpt4o_in; Out=P.gpt4o_out; }
  else if (core==="deepseek" || (/deepseek/.test(model||""))){ In=P.deepseek_in; Out=P.deepseek_out; }
  else if (core==="gemini"){ In=P.gemini_in; Out=P.gemini_out; }
  else if (core==="grok"){ In=P.grok_in; Out=P.grok_out; }
  else { In=P.gpt4omini_in; Out=P.gpt4omini_out; }
  return Number(((u/1000)*In + (o/1000)*Out).toFixed(4));
}
function levelBy(usd){
  const B = Math.max(0.01, parseFloat(process.env.DAILY_BUDGET_USD || "2"));
  const r = usd / B;
  if (r < 0.02) return "L1";
  if (r < 0.05) return "L2";
  if (r < 0.10) return "L3";
  if (r < 0.20) return "L4";
  return "L5";
}

/* -------------------- upstreams -------------------- */
async function callOpenAI(messages, max_tokens){
  const key = process.env.OPENAI_API_KEY;
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!key) return { ok:false, why:"no_openai_key" };
  const r = await fetch(base + "/chat/completions", {
    method:"POST",
    headers:{ "content-type":"application/json", "authorization":"Bearer " + key },
    body: JSON.stringify({ model:model, messages:messages, max_tokens:max_tokens||400, temperature:0.2 })
  });
  if (!r.ok) return { ok:false, why:"openai_http", status:r.status, detail: await r.text().catch(()=> "") };
  const data = await r.json();
  const text = (data && data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
  return { ok:true, model:model, content:text };
}
async function callGemini(messages, max_tokens){
  const key = process.env.GEMINI_API_KEY;
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  if (!key) return { ok:false, why:"no_gemini_key" };
  const url = base + "/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
  const text = messages.map(m => m.content).join("\n");
  const r = await fetch(url, {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body: JSON.stringify({ contents:[{ role:"user", parts:[{ text:text }] }], generationConfig:{ maxOutputTokens:max_tokens||400 } })
  });
  if (!r.ok) return { ok:false, why:"gemini_http", status:r.status, detail: await r.text().catch(()=> "") };
  const data = await r.json();
  const out = (data && data.candidates && data.candidates[0] && data.candidates[0].content)
            ? (data.candidates[0].content.parts||[]).map(p=>p.text||"").join("")
            : "";
  return { ok:true, model:model, content:out };
}
async function callGrok(messages, max_tokens){
  const key = process.env.GROK_API_KEY;
  const model = process.env.GROK_MODEL || "grok-2";
  if (!key) return { ok:false, why:"no_grok_key" };
  const text = messages.map(m => m.content).join("\n");
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method:"POST",
    headers:{ "content-type":"application/json", "authorization":"Bearer " + key },
    body: JSON.stringify({ model:model, messages:[{ role:"user", content:text }], max_tokens:max_tokens||400, temperature:0.2 })
  });
  if (!r.ok) return { ok:false, why:"grok_http", status:r.status, detail: await r.text().catch(()=> "") };
  const data = await r.json();
  const out = (data && data.choices && data.choices[0] && data.choices[0].message)
            ? data.choices[0].message.content : "";
  return { ok:true, model:model, content:out };
}

/* -------------------- blueprint & SQL -------------------- */
const DEFAULT_BLUEPRINT = {
  styles: [
    { code:"gu-tech", name:"古風×科技", css:{ accent:"#D4AF37", bg:"#0B0F14" }, notes:"黑底金線·0.8s進場·圓角大按鈕" },
    { code:"plain",   name:"極簡",     css:{ accent:"#9aa7b4", bg:"#0B0F14" } }
  ],
  voices: [
    { code:"zhangmen", name:"掌門令", system:"你是冷靜斷語的決策助手，回答短、條列化、少婉轉，不用Emoji。" },
    { code:"opslog",   name:"工務札記", system:"分段輸出：現況/風險/建議/行動；重點條列，數據為先。" },
    { code:"warm",     name:"溫柔說", system:"語氣溫和，先結論後解釋，必要時舉例。" }
  ],
  modules: [
    { code:"entry", name:"入口·問天", endpoint:"/index.html",            enabled:true  },
    { code:"audit", name:"監察院",     endpoint:"/api/metrics_summary",   enabled:true  },
    { code:"grey",  name:"灰情報",     endpoint:"/api/grey_intel_ingest", enabled:true  },
    { code:"legal", name:"法務組",     endpoint:"/api/legal",             enabled:false },
    { code:"proj",  name:"專案模組",   endpoint:"/api/projects",          enabled:false },
    { code:"rich",  name:"富策體",     endpoint:"/api/rich_core",         enabled:false }
  ],
  policy: {
    daily_budget_usd: 2.0,
    offpeak_hours: "23:00-06:00 Asia/Taipei",
    realtime_route: ["gpt4o","gemini","grok"],
    offline_route:  ["deepseek","gpt4o"],
    lifeline: { L1:0.02, L2:0.05, L3:0.10, L4:0.20, L5:1.00 }
  },
  triggers: { boot:["元始開工","開工","元始啟動","開始施工","開始"], submit_blueprint:["元始交卷","交付藍圖","交卷"] },
  kpi: [
    { code:"speed", name:"回應速度",  formula:"p95_latency_ms",       phase:"全域" },
    { code:"cpa",   name:"每答成本",  formula:"estimate_usd/answers", phase:"全域" },
    { code:"fixr",  name:"拉歪修正率", formula:"corrective/total",     phase:"監察" }
  ]
};

const SQL_BOOTSTRAP = [
  "create table if not exists sessions(",
  "  id uuid primary key default gen_random_uuid(),",
  "  sid text unique not null,",
  "  created_at timestamptz default now()",
  ");",
  "create table if not exists messages(",
  "  id bigserial primary key,",
  "  sid text not null,",
  "  role text not null check (role in ('user','assistant','system')),",
  "  content text not null,",
  "  created_at timestamptz default now()",
  ");",
  "create table if not exists routing_events(",
  "  id bigserial primary key,",
  "  sid text not null,",
  "  core text not null,",
  "  estimate_usd numeric(10,5),",
  "  level text,",
  "  created_at timestamptz default now()",
  ");",
  "create table if not exists config_kv(",
  "  key text primary key,",
  "  value jsonb not null,",
  "  updated_at timestamptz default now()",
  ");"
].join("\n");

async function seedBlueprintIfEmpty(){
  const ping = await sbFetch("/config_kv?select=key&limit=1");
  if (!ping.ok) return { ok:false, why:"missing_table" };
  const m = {
    style_profiles: DEFAULT_BLUEPRINT.styles,
    voice_profiles: DEFAULT_BLUEPRINT.voices,
    modules:       DEFAULT_BLUEPRINT.modules,
    policy:        DEFAULT_BLUEPRINT.policy,
    triggers:      DEFAULT_BLUEPRINT.triggers,
    kpi_rules:     DEFAULT_BLUEPRINT.kpi
  };
  let seeded = 0; const details = [];
  const keys = Object.keys(m);
  for (let i=0;i<keys.length;i++){
    const k = keys[i];
    const r = await sbFetch("/config_kv?key=eq."+encodeURIComponent(k)+"&select=key&limit=1");
    const a = r.ok ? await r.json() : [];
    if (!Array.isArray(a) || a.length===0){
      await sbPutKV(k, m[k]).catch(()=>{});
      seeded++; details.push(k);
    }
  }
  return { ok:true, seeded:seeded, details:details };
}

async function runUpgradeChecklist(){
  const env = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    grok:   !!process.env.GROK_API_KEY,
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_ROLE
  };
  let t1="ok", t2="ok", t3="ok";
  try{ const r1=await sbFetch("/messages?select=id&limit=1"); if(!r1.ok)t1="missing"; }catch(e){ t1="missing"; }
  try{ const r2=await sbFetch("/routing_events?select=id&limit=1"); if(!r2.ok)t2="missing"; }catch(e){ t2="missing"; }
  try{ const r3=await sbFetch("/config_kv?select=key&limit=1"); if(!r3.ok)t3="missing"; }catch(e){ t3="missing"; }

  const needSQL = (t1==="missing" || t2==="missing" || t3==="missing");
  const sql = needSQL ? SQL_BOOTSTRAP : "";
  let seed = { ok:false, seeded:0, details:[] };
  if (!needSQL) seed = await seedBlueprintIfEmpty();

  const tips = [
    "① Production 網域固定 sid；換網域會是新 sid（記憶分開）。",
    "② 金鑰放 Production；DeepSeek 需搭配 OPENAI_BASE_URL=https://api.deepseek.com。",
    "③ 長聊自動帶入最近 8 句；監察院統計 routing_events。",
    "④ 一鍵升級已自動灌入預設藍圖（若資料庫為空）。"
  ];

  return { env:env, tables:{ messages:t1, routing_events:t2, config_kv:t3 }, needSQL:needSQL, sql:sql, seed:seed, tips:tips };
}

/* -------------------- handler -------------------- */
export default async function handler(req){
  if (req.method === "GET") return J(200, { ok:true, name:"ask_tian", message:"WenTian alive" });
  if (req.method !== "POST") return J(405, { error:"Method Not Allowed" });

  let sid = getCookie(req, "sid"); let setCookie = null;
  if (!sid){ sid = newSID(); setCookie = "sid="+encodeURIComponent(sid)+"; Path=/; Max-Age="+(60*60*24*365)+"; SameSite=Lax"; }

  let p={}; try{ p = await req.json(); }catch(e){}
  const intent = (p.intent || "").trim();
  const coreReq = String(p.core || "gpt4o").toLowerCase();
  const voice = String(p.voice || "掌門令");

  const norm = intent.replace(/\s+/g,"");
  const bootWords = ["元始開工","開工","元始啟動","開始施工","開始"];
  const submitWords = ["元始交卷","交付藍圖","交卷"];

  if (bootWords.some(w => norm.indexOf(w)>=0)){
    const chk = await runUpgradeChecklist();
    const L = [];
    L.push("【一鍵升級·檢查結果】");
    L.push("金鑰：OpenAI=" + (chk.env.openai?"OK":"缺") + "，Gemini=" + (chk.env.gemini?"OK":"缺") + "，Grok=" + (chk.env.grok?"OK":"缺"));
    L.push("Supabase：URL=" + (chk.env.supabase_url?"OK":"缺") + "，金鑰=" + (chk.env.supabase_key?"OK":"缺"));
    L.push("資料表：messages=" + chk.tables.messages + "，routing_events=" + chk.tables.routing_events + "，config_kv=" + chk.tables.config_kv);
    if (chk.needSQL){ L.push("請到 Supabase SQL Editor 貼上以下 SQL（若已存在不會覆蓋）："); L.push(chk.sql); }
    else { L.push("藍圖寫入（僅在空庫時）：seeded=" + chk.seed.seeded + "，keys=[" + chk.seed.details.join(", ") + "]"); }
    for (let i=0;i<chk.tips.length;i++) L.push(chk.tips[i]);
    return J(200, { ok:true, answer: L.join("\n") }, setCookie ? { "set-cookie": setCookie } : undefined);
  }

  if (submitWords.some(w => norm.indexOf(w)>=0)){
    const m = (intent.match(/```json([\s\S]*?)```/i) || [])[1] || (intent.match(/\{[\s\S]*\}$/) || [])[0];
    if (!m) return J(200, { ok:false, error:"未找到 JSON 內容（請用 ```json ... ``` 包起來）" }, setCookie ? { "set-cookie": setCookie } : undefined);
    let pack; try{ pack = JSON.parse(m); }catch(e){ return J(200, { ok:false, error:"JSON 解析失敗：" + String(e) }, setCookie ? { "set-cookie": setCookie } : undefined); }
    if (pack.styles)  await sbPutKV("style_profiles", pack.styles).catch(()=>{});
    if (pack.voices)  await sbPutKV("voice_profiles", pack.voices).catch(()=>{});
    if (pack.modules) await sbPutKV("modules",       pack.modules).catch(()=>{});
    if (pack.policy)  await sbPutKV("policy",        pack.policy).catch(()=>{});
    if (pack.triggers)await sbPutKV("triggers",      pack.triggers).catch(()=>{});
    if (pack.kpi)     await sbPutKV("kpi_rules",     pack.kpi).catch(()=>{});
    return J(200, { ok:true, answer:"【藍圖已入庫】" }, setCookie ? { "set-cookie": setCookie } : undefined);
  }

  const sys = (voice === "掌門令")
    ? "你是冷靜斷語的決策助手，回答要短、條列化、少婉轉，不用Emoji。"
    : "你是務實的助手，回答清楚、條列化。";
  const history = await sbGetMessages(sid, 8);
  const messages = [{ role:"system", content: sys }];
  for (let i=0;i<history.length;i++) messages.push({ role: history[i].role, content: history[i].content });
  messages.push({ role:"user", content:intent });

  const order = (coreReq==="gpt4o") ? ["gpt4o","gemini","grok"]
              : (coreReq==="gemini")? ["gemini","gpt4o","grok"]
              : ["gpt4o","gemini","grok"];

  let up=null, used="mock";
  for (let i=0;i<order.length;i++){
    const c = order[i];
    if (c==="gpt4o"){ up = await callOpenAI(messages, 400); if (up && up.ok){ used="gpt4o"; break; } }
    if (c==="gemini"){ up = await callGemini(messages, 400); if (up && up.ok){ used="gemini"; break; } }
    if (c==="grok"){ up = await callGrok(messages, 400); if (up && up.ok){ used="grok"; break; } }
  }

  const inChars = intent.length + history.reduce((s,m)=> s + (m.content||"").length, 0);
  const outChars = (up && up.content ? up.content.length : 0);
  const estimate_usd = estUSD(used, inChars, outChars, up && up.model);
  const level = levelBy(estimate_usd);

  await sbInsert("messages", { sid:sid, role:"user", content:intent }).catch(()=>{});
  if (up && up.ok) await sbInsert("messages", { sid:sid, role:"assistant", content: up.content }).catch(()=>{});
  await sbInsert("routing_events", { sid:sid, core:used, estimate_usd:estimate_usd, level:level }).catch(()=>{});

  if (!up || !up.ok){
    return J(200, { ok:true, route:"mock", answer:"[模擬] 上游暫時無回覆", estimate_usd:estimate_usd, level:level },
      setCookie ? { "set-cookie": setCookie } : undefined);
  }
  return J(200, { ok:true, route:used, model: up.model, answer: up.content, estimate_usd:estimate_usd, level:level },
    setCookie ? { "set-cookie": setCookie } : undefined);
}
