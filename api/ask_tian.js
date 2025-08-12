// api/ask_tian.js
// Edge-friendly, no top-level await/return, includes:
// - "一鍵升級(元始開工)" checklist + auto seed default blueprint
// - short memory (last 8 turns)
// - routing with fallbacks (gpt4o -> gemini -> grok)
// - cost estimation + lifeline + supabase writes

export const config = { runtime: 'edge' };

// ---------- small utilities ----------
function J(status, data, extraHeaders) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(data), { status, headers });
}
function getCookie(req, key) {
  const raw = req.headers.get('cookie') || '';
  const parts = raw.split(';').map(s => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf('=');
    const k = i >= 0 ? p.slice(0, i) : p;
    const v = i >= 0 ? p.slice(i + 1) : '';
    if (k === key) return decodeURIComponent(v);
  }
  return null;
}
function newSID() { return Math.random().toString(36).slice(2, 12); }

// ---------- Supabase helpers ----------
async function sbFetch(path, opts = {}) {
  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE || '';
  if (!base || !key) return new Response('no supabase', { status: 500 });
  return fetch(`${base}/rest/v1${path}`, {
    method: opts.method || 'GET',
    headers: Object.assign({
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=representation'
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
}
async function sbGetMessages(sid, limit) {
  try {
    const r = await sbFetch(`/messages?sid=eq.${encodeURIComponent(sid)}&select=role,content,created_at&order=created_at.asc&limit=${limit||8}`);
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
async function sbInsert(table, row) {
  try {
    const r = await sbFetch(`/${table}`, { method: 'POST', body: row });
    if (!r.ok) return { ok: false, status: r.status, detail: await r.text().catch(()=> '') };
    const data = await r.json().catch(()=> ({}));
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e) }; }
}
// upsert to config_kv
async function sbPutKV(key, value) {
  await sbFetch(`/config_kv?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(()=>{});
  return sbInsert('config_kv', { key, value });
}

// ---------- cost / lifeline ----------
function priceSheet() {
  const g = (k, v) => (process.env[k] ? parseFloat(process.env[k]) : v);
  return {
    gpt4o_in:       g('PRICE_GPT4O_IN',        5.00),
    gpt4o_out:      g('PRICE_GPT4O_OUT',      15.00),
    gpt4omini_in:   g('PRICE_GPT4OMINI_IN',    0.15),
    gpt4omini_out:  g('PRICE_GPT4OMINI_OUT',   0.60),
    deepseek_in:    g('PRICE_DEEPSEEK_IN',     0.27),
    deepseek_out:   g('PRICE_DEEPSEEK_OUT',    1.10),
    gemini_in:      g('PRICE_GEMINI_IN',       1.25),
    gemini_out:     g('PRICE_GEMINI_OUT',      5.00),
    grok_in:        g('PRICE_GROK_IN',         5.00),
    grok_out:       g('PRICE_GROK_OUT',       15.00),
  };
}
function estUSD(core, inChars, outChars, model) {
  const toTok = ch => Math.max(1, Math.round((ch||0)/3.5));
  const u = toTok(inChars), o = toTok(outChars||250);
  const P = priceSheet();
  let In=0, Out=0;
  if (core==='gpt4o' || /^gpt-4o/.test(model||'')) { In=P.gpt4o_in; Out=P.gpt4o_out; }
  else if (core==='deepseek' || /deepseek/.test(model||'')) { In=P.deepseek_in; Out=P.deepseek_out; }
  else if (core==='gemini') { In=P.gemini_in; Out=P.gemini_out; }
  else if (core==='grok') { In=P.grok_in; Out=P.grok_out; }
  else { In=P.gpt4omini_in; Out=P.gpt4omini_out; }
  return Number(((u/1000)*In + (o/1000)*Out).toFixed(4));
}
function levelBy(usd) {
  const B = Math.max(0.01, parseFloat(process.env.DAILY_BUDGET_USD || '2'));
  const r = usd / B;
  if (r < 0.02) return 'L1';
  if (r < 0.05) return 'L2';
  if (r < 0.10) return 'L3';
  if (r < 0.20) return 'L4';
  return 'L5';
}

// ---------- upstream callers ----------
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
  const text = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
  return { ok:true, model, content:text };
}
async function callGemini(messages, max_tokens) {
  const key   = process.env.GEMINI_API_KEY;
  const base  = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (!key) return { ok:false, why:'no_gemini_key' };
  const url = `${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const text = messages.map(m=>m.content).join('\n');
  const r = await fetch(url, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ contents:[{ role:'user', parts:[{ text }] }], generationConfig:{ maxOutputTokens:max_tokens||400 } })
  });
  if (!r.ok) return { ok:false, why:'gemini_http', status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json();
  const out  = data && data.candidates && data.candidates[0] && data.candidates[0].content
             ? (data.candidates[0].content.parts||[]).map(p=>p.text||'').join('')
             : '';
  return { ok:true, model, content: out };
}
async function callGrok(messages, max_tokens) {
  const key   = process.env.GROK_API_KEY;
  const model = process.env.GROK_MODEL || 'grok-2';
  if (!key) return { ok:false, why:'no_grok_key' };
  const text = messages.map(m=>m.content).join('\n');
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages:[{role:'user', content:text}], max_tokens:max_tokens||400, temperature:0.2 })
  });
  if (!r.ok) return { ok:false, why:'grok_http', status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json();
  const out  = data && data.choices && data.choices[0] && data.choices[0].message
             ? data.choices[0].message.content : '';
  return { ok:true, model, content: out };
}

// ---------- default blueprint + checklist ----------
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
    { code:'entry', name:'入口·問天', endpoint:'/index.html',            enabled:true  },
    { code:'audit', name:'監察院',     endpoint:'/api/metrics_summary',   enabled:true  },
    { code:'grey',  name:'灰情報',     endpoint:'/api/grey_intel_ingest', enabled:true  },
    { code:'legal', name:'法務組',     endpoint:'/api/legal',             enabled:false },
    { code:'proj',  name:'專案模組',   endpoint:'/api/projects',          enabled:false },
    { code:'rich',  name:'富策體',     endpoint:'/api/rich_core',         enabled:false }
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
    { code:'speed', name:'回應速度', formula:'p95_latency_ms',       phase:'全域' },
    { code:'cpa',   name:'每答成本', formula:'estimate_usd/answers', phase:'全域' },
    { code:'fixr',  name:'拉歪修正率', formula:'corrective/total',   phase:'監察' }
  ]
};

async function seedBlueprintIfEmpty() {
  const ping = await sbFetch('
