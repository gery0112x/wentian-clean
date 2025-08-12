export const config = { runtime: 'edge' };

function J(status, data, extraHeaders) {
  const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(data), { status, headers });
}

function getCookie(req, key) {
  const raw = req.headers.get('cookie') || '';
  const parts = raw.split(';').map(s => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const [k, ...rest] = p.split('=');
    if (k === key) return decodeURIComponent(rest.join('='));
  }
  return null;
}
function newSID() { return Math.random().toString(36).slice(2, 12); }

async function sbFetch(path, opts={}) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/,'') + `/rest/v1${path}`;
  const key = process.env.SUPABASE_SERVICE_ROLE || '';
  if (!url || !key) return { ok:false, why:'no_supabase' };
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: Object.assign({
      'apikey': key, 'authorization': `Bearer ${key}`,
      'content-type': 'application/json', 'prefer':'return=representation'
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  return r;
}

async function sbGetMessages(sid, limit=8) {
  const r = await sbFetch(`/messages?sid=eq.${encodeURIComponent(sid)}&select=role,content,created_at&order=created_at.asc&limit=${limit}`);
  if (!r.ok) return [];
  return await r.json();
}
async function sbInsert(table, row) {
  // ---- PATCH A: upsert to config_kv ----
async function sbPutKV(key, value) {
  await sbFetch(`/config_kv?key=eq.${encodeURIComponent(key)}`, { method:'DELETE' });
  return await sbInsert('config_kv', { key, value });
}

  const r = await sbFetch(`/${table}`, { method:'POST', body: row });
  if (!r.ok) return { ok:false, status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json().catch(()=> ({}));
  return { ok:true, data };
}

function priceSheet(){
  const g = (k, v) => (process.env[k] ? parseFloat(process.env[k]) : v);
  return {
    gpt4o_in: g('PRICE_GPT4O_IN', 5.00),
    gpt4o_out: g('PRICE_GPT4O_OUT', 15.00),
    gpt4omini_in: g('PRICE_GPT4OMINI_IN', 0.15),
    gpt4omini_out: g('PRICE_GPT4OMINI_OUT', 0.60),
    deepseek_in: g('PRICE_DEEPSEEK_IN', 0.27),
    deepseek_out: g('PRICE_DEEPSEEK_OUT', 1.10),
    gemini_in: g('PRICE_GEMINI_IN', 1.25),
    gemini_out: g('PRICE_GEMINI_OUT', 5.00),
    grok_in: g('PRICE_GROK_IN', 5.00),
    grok_out: g('PRICE_GROK_OUT', 15.00),
  };
}
function estUSD(core, inChars, outChars, model){
  const toTok = (ch)=> Math.max(1, Math.round(ch/3.5));
  const u = toTok(inChars||0), o = toTok(outChars||250);
  const P = priceSheet();
  let In=0, Out=0;
  if (core==='gpt4o'||/^gpt-4o/.test(model||'')) { In=P.gpt4o_in; Out=P.gpt4o_out; }
  else if (core==='deepseek'||/deepseek/.test(model||'')) { In=P.deepseek_in; Out=P.deepseek_out; }
  else if (core==='gemini') { In=P.gemini_in; Out=P.gemini_out; }
  else if (core==='grok') { In=P.grok_in; Out=P.grok_out; }
  else { In=P.gpt4omini_in; Out=P.gpt4omini_out; }
  const usd = (u/1000)*In + (o/1000)*Out;
  return Number(usd.toFixed(4));
}
function levelBy(usd){
  const B = Math.max(0.01, parseFloat(process.env.DAILY_BUDGET_USD || '2'));
  const r = usd/B;
  if (r < 0.02) return 'L1';
  if (r < 0.05) return 'L2';
  if (r < 0.10) return 'L3';
  if (r < 0.20) return 'L4';
  return 'L5';
}

// Upstream callers
async function callOpenAI(messages, max_tokens) {
  const key   = process.env.OPENAI_API_KEY;
  const base  = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!key) return { ok:false, why:'no_openai_key' };
  const r = await fetch(`${base}/chat/completions`, {
    method:'POST',
    headers:{ 'content-type':'application/json', 'authorization': `Bearer ${key}`},
    body: JSON.stringify({ model, messages, max_tokens: max_tokens || 400, temperature:0.2 })
  });
  if (!r.ok) return { ok:false, why:'openai_http', status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return { ok:true, model, content:text };
}
async function callGemini(messages, max_tokens) {
  const key   = process.env.GEMINI_API_KEY;
  const base  = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (!key) return { ok:false, why:'no_gemini_key' };
  const url = `${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const text = messages.map(m=>m.content).join("\n");
  const r = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ contents:[{ role:'user', parts:[{ text }]}], generationConfig:{ maxOutputTokens: max_tokens || 400 } }) });
  if (!r.ok) return { ok:false, why:'gemini_http', status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json();
  const out  = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') ?? '';
  return { ok:true, model, content: out };
}
async function callGrok(messages, max_tokens) {
  const key   = process.env.GROK_API_KEY;
  const model = process.env.GROK_MODEL || 'grok-2';
  if (!key) return { ok:false, why:'no_grok_key' };
  const text = messages.map(m=>m.content).join("\n");
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages:[{role:'user', content:text}], max_tokens: max_tokens || 400, temperature:0.2 })
  });
  if (!r.ok) return { ok:false, why:'grok_http', status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json();
  const out  = data?.choices?.[0]?.message?.content ?? '';
  return { ok:true, model, content: out };
}

// Upgrade checks (when intent is "元始開工")
// Special command: 元始交卷 / 交付藍圖
const intentNorm = (intent || '').replace(/\s+/g,'');
const submitWords = ['元始交卷','交付藍圖','交卷'];
if (submitWords.some(w => intentNorm.includes(w))) {
  // 抓 JSON（支援 ```json ... ``` 或直接 { ... }）
  const m = (intent.match(/```json([\s\S]*?)```/i) || [])[1]
         || (intent.match(/\{[\s\S]*\}$/) || [])[0];
  if (!m) return J(200, { ok:false, error:'未找到 JSON 內容（請用 ```json ... ``` 包起來）' });

  let pack; try { pack = JSON.parse(m); } catch(e) {
    return J(200, { ok:false, error:'JSON 解析失敗：' + String(e) });
  }

  const touched = {styles:0, voices:0, modules:0, policy:0, triggers:0, kpi:0};
  if (pack.styles)  { await sbPutKV('style_profiles', pack.styles);   touched.styles  = pack.styles.length || 1; }
  if (pack.voices)  { await sbPutKV('voice_profiles', pack.voices);   touched.voices  = pack.voices.length || 1; }
  if (pack.modules) { await sbPutKV('modules', pack.modules);         touched.modules = pack.modules.length || 1; }
  if (pack.policy)  { await sbPutKV('policy', pack.policy);           touched.policy  = 1; }
  if (pack.triggers){ await sbPutKV('triggers', pack.triggers);       touched.triggers= Object.keys(pack.triggers||{}).length || 1; }
  if (pack.kpi)     { await sbPutKV('kpi_rules', pack.kpi);           touched.kpi     = pack.kpi.length || 1; }

  return J(200, { ok:true, answer:
    `【藍圖已入庫】styles=${touched.styles} voices=${touched.voices} modules=${touched.modules} policy=${touched.policy} triggers=${touched.triggers} kpi=${touched.kpi}` 
  });
}

// ---- PATCH B: default blueprint & upgraded checklist (auto seed) ----
const DEFAULT_BLUEPRINT = {
  styles: [
    { code:'gu-tech', name:'古風×科技', css:{ accent:'#D4AF37', bg:'#0B0F14' }, notes:'黑底金線·0.8s進場·圓角大按鈕' },
    { code:'plain',   name:'極簡',     css:{ accent:'#9aa7b4', bg:'#0B0F14' } }
  ],
  voices: [
    { code:'zhangmen', name:'掌門令', system:'你是冷靜斷語的決策助手，回答短、條列化、少婉轉，不用Emoji。' },
    { code:'opslog',   name:'工務札記', system:'分段輸出：現況/風險/建議/行動；重點條列，數據為先。' },
    { code:'warm',     name:'溫柔說', system:'語氣溫和，先結論後解釋，必要時舉例。' }
  ],
  modules: [
    { code:'entry', name:'入口·問天', endpoint:'/index.html',              enabled:true  },
    { code:'audit', name:'監察院',     endpoint:'/api/metrics_summary',     enabled:true  },
    { code:'grey',  name:'灰情報',     endpoint:'/api/grey_intel_ingest',   enabled:true  },
    { code:'legal', name:'法務組',     endpoint:'/api/legal',               enabled:false },
    { code:'proj',  name:'專案模組',   endpoint:'/api/projects',            enabled:false },
    { code:'rich',  name:'富策體',     endpoint:'/api/rich_core',           enabled:false }
  ],
  policy: {
    daily_budget_usd: 2.0,
    offpeak_hours: '23:00-06:00 Asia/Taipei',
    realtime_route: ['gpt4o','gemini','grok'],
    offline_route:  ['deepseek','gpt4o'],
    lifeline: { L1:0.02, L2:0.05, L3:0.10, L4:0.20, L5:1.00 }
  },
  triggers: {
    boot: ['元始開工','開工','元始啟動','開始施工','開始'],
    submit_blueprint: ['元始交卷','交付藍圖','交卷']
  },
  kpi: [
    { code:'speed',         name:'回應速度',     formula:'p95_latency_ms',          phase:'全域' },
    { code:'cost_per_ans',  name:'每答成本',     formula:'estimate_usd/answers',    phase:'全域' },
    { code:'correction_rate',name:'拉歪修正率',  formula:'corrective_proposals/total_proposals', phase:'監察' }
  ]
};

async function seedBlueprintIfEmpty() {
  const ping = await sbFetch('/config_kv?select=key&limit=1');
  if (!ping.ok) return { ok:false, why:'missing_table' };

  const src = DEFAULT_BLUEPRINT;
  const mapping = {
    style_profiles: src.styles,
    voice_profiles: src.voices,
    modules:       src.modules,
    policy:        src.policy,
    triggers:      src.triggers,
    kpi_rules:     src.kpi
  };
  const keys = Object.keys(mapping);
  let seeded = 0, details = [];

  for (const k of keys) {
    const r = await sbFetch(`/config_kv?key=eq.${encodeURIComponent(k)}&select=key&limit=1`);
    const a = r.ok ? await r.json() : [];
    if (!Array.isArray(a) || a.length === 0) {
      await sbPutKV(k, mapping[k]).catch(()=>{});
      seeded++; details.push(k);
    }
  }
  return { ok:true, seeded, details };
}

async function runUpgradeChecklist() {
  const env = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    grok:   !!process.env.GROK_API_KEY,
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_ROLE
  };

  let sbMessages='ok', sbRouting='ok', sbKV='ok';
  try { const r1 = await sbFetch('/messages?select=id&limit=1'); if(!r1.ok) sbMessages='missing'; } catch { sbMessages='missing'; }
  try { const r2 = await sbFetch('/routing_events?select=id&limit=1'); if(!r2.ok) sbRouting='missing'; } catch { sbRouting='missing'; }
  try { const r3 = await sbFetch('/config_kv?select=key&limit=1'); if(!r3.ok) sbKV='missing'; } catch { sbKV='missing'; }

  const needSQL = (sbMessages==='missing' || sbRouting==='missing' || sbKV==='missing');
  const sql = needSQL ? `
create table if not exists sessions(
  id uuid primary key default gen_random_uuid(),
  sid text unique not null,
  created_at timestamptz default now()
);
create table if not exists messages(
  id bigserial primary key,
  sid text not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz default now()
);
create table if not exists routing_events(
  id bigserial primary key,
  sid text not null,
  core text not null,
  estimate_usd numeric(10,5),
  level text,
  created_at timestamptz default now()
);
create table if not exists config_kv(
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);`.trim() : '';

  // 若表都在，順便自動 seed 預設藍圖（只在空的時候）
  let seed = { ok:false, seeded:0, details:[] };
  if (!needSQL) seed = await seedBlueprintIfEmpty();

  const tips = [
    '① Production 網域使用固定 sid；換網域會是新 sid（記憶會分開）。',
    '② 金鑰放 Production；DeepSeek 需搭配 OPENAI_BASE_URL=https://api.deepseek.com。',
    '③ 長聊自動帶入最近 8 句；監察院統計 routing_events。',
    '④ 一鍵升級已自動灌入預設藍圖（若資料庫為空）。'
  ];

  return {
    env,
    tables:{ messages:sbMessages, routing_events:sbRouting, config_kv:sbKV },
    needSQL, sql, seed, tips
  };
}
 {
  const env = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    grok: !!process.env.GROK_API_KEY,
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_ROLE
  };
  // Check Supabase tables existence quickly
  let sbMessages = 'ok', sbRouting = 'ok';
  try {
    const r1 = await sbFetch('/messages?select=id&limit=1');
    if (!r1.ok) sbMessages = 'missing';
  } catch { sbMessages = 'missing'; }
  try {
    const r2 = await sbFetch('/routing_events?select=id&limit=1');
    if (!r2.ok) sbRouting = 'missing';
  } catch { sbRouting = 'missing'; }

  const needSQL = (sbMessages==='missing' || sbRouting==='missing');
  const sql = needSQL ? `
create table if not exists sessions(
  id uuid primary key default gen_random_uuid(),
  sid text unique not null,
  created_at timestamptz default now()
);
create table if not exists messages(
  id bigserial primary key,
  sid text not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz default now()
);
create table if not exists routing_events(
  id bigserial primary key,
  sid text not null,
  core text not null,
  estimate_usd numeric(10,5),
  level text,
  created_at timestamptz default now()
);`.trim() : '';

  const tips = [
    '① 入口固定用 Production 網域，Cookie 才會綁同一 sid。',
    '② 金鑰全放 Production；DeepSeek 要搭配 OPENAI_BASE_URL=https://api.deepseek.com。',
    '③ 長聊會自動帶入最近 8 句；超長將加入摘要（下一版）。',
    '④ 監察院以 routing_events 匯總成本，生命線門檻可用 DAILY_BUDGET_USD 覆寫。'
  ];

  return { env, tables:{ messages:sbMessages, routing_events:sbRouting }, needSQL, sql, tips };
}

export default async function handler(req) {
  if (req.method === 'GET') return J(200, { ok:true, name:'ask_tian', message:'WenTian alive' });

  if (req.method !== 'POST') return J(405, { error:'Method Not Allowed' });

  // session
  let sid = getCookie(req, 'sid');
  let setCookie = null;
  if (!sid) {
    sid = newSID();
    setCookie = `sid=${encodeURIComponent(sid)}; Path=/; Max-Age=${60*60*24*365}; SameSite=Lax`;
  }

  let p = {}; try { p = await req.json(); } catch {}
  const intent = (p.intent || '').trim();
  const coreIn = String(p.core || '').toLowerCase();
  const sys = (p.voice === '掌門令')
    ? '你是冷靜斷語的決策助手，回答要短、條列化、少婉轉，不用Emoji。'
    : '你是務實的助手，回答清楚、條列化。';

  // Special command: 元始開工 → run upgrade checklist and return ops text
  if (intent && intent.includes('元始開工')) {
    const chk = await runUpgradeChecklist();
    let ops = ['【一鍵升級·檢查結果】'];
    ops.push(`金鑰：OpenAI=${chk.env.openai?'OK':'缺'}, Gemini=${chk.env.gemini?'OK':'缺'}, Grok=${chk.env.grok?'OK':'缺'}`);
    ops.push(`Supabase：URL=${chk.env.supabase_url?'OK':'缺'}，金鑰=${chk.env.supabase_key?'OK':'缺'}`);
    ops.push(`資料表：messages=${chk.tables.messages}，routing_events=${chk.tables.routing_events}`);
    if (chk.needSQL) {
      ops.push('請到 Supabase SQL Editor 執行以下 SQL（一次貼上即可）：');
      ops.push(chk.sql);
    } else {
      ops.push('資料表完整，無需建表。');
    }
    ops = ops.concat(chk.tips);
    const body = { ok:true, ops: ops.join('\n') };
    return J(200, body, setCookie ? { 'set-cookie': setCookie } : undefined);
  }

  // build messages with short memory
  let history = [];
  try { history = await sbGetMessages(sid, 8); } catch {}
  const msgs = [{ role:'system', content: sys }];
  for (const m of history) msgs.push({ role: m.role, content: m.content });
  msgs.push({ role:'user', content: intent });

  // choose core with fallback
  const order = coreIn === 'gpt4o' ? ['gpt4o','gemini','grok']
              : coreIn === 'gemini' ? ['gemini','gpt4o','grok']
              : coreIn === 'deepseek' ? ['gpt4o','gemini','grok']
              : ['gpt4o','gemini','grok'];
  let up, core='mock';
  for (const c of order) {
    if (c==='gpt4o') { up = await callOpenAI(msgs, 400); if (up?.ok){ core='gpt4o'; break; } }
    if (c==='gemini') { up = await callGemini(msgs, 400); if (up?.ok){ core='gemini'; break; } }
    if (c==='grok')   { up = await callGrok(msgs, 400);   if (up?.ok){ core='grok'; break; } }
  }

  const estimate_usd = estUSD(core, intent.length + history.reduce((s,m)=>s+(m.content||'').length,0), (up?.content||'').length, up?.model);
  const level = levelBy(estimate_usd);

  // best-effort writes
  await sbInsert('messages', { sid, role:'user', content:intent }).catch(()=>{});
  if (up?.ok) await sbInsert('messages', { sid, role:'assistant', content: up.content }).catch(()=>{});
  await sbInsert('routing_events', { sid, core, estimate_usd, level }).catch(()=>{});

  if (!up || !up.ok) {
    const body = { ok:true, route:'mock', answer:'[模擬] 上游失敗：' + (up?.why || 'unknown'), estimate_usd, level };
    return J(200, body, setCookie ? { 'set-cookie': setCookie } : undefined);
  }

  return J(200, { ok:true, route:core, model: up.model, answer: up.content, estimate_usd, level },
            setCookie ? { 'set-cookie': setCookie } : undefined);
}
