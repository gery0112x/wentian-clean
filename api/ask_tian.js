export const config = { runtime: 'edge' };

function R(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function callOpenAI(messages, max_tokens) {
  const key   = process.env.OPENAI_API_KEY;
  const base  = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!key) return { ok:false, why:'no_openai_key' };
  const res = await fetch(`${base}/chat/completions`, {
    method:'POST',
    headers:{ 'content-type':'application/json', 'authorization': `Bearer ${key}`},
    body: JSON.stringify({ model, messages, max_tokens: max_tokens || 400, temperature:0.2 })
  });
  if (!res.ok) return { ok:false, why:'openai_http', status: res.status, detail: await res.text().catch(()=> '') };
  const data = await res.json();
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
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ contents:[{ role:'user', parts:[{ text }] }], generationConfig:{ maxOutputTokens: max_tokens || 400 } })
  });
  if (!res.ok) return { ok:false, why:'gemini_http', status: res.status, detail: await res.text().catch(()=> '') };
  const data = await res.json();
  const out  = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') ?? '';
  return { ok:true, model, content: out };
}

// Grok（先占位，後續可接）
async function callGrok(messages, max_tokens) {
  const key   = process.env.GROK_API_KEY;
  const model = process.env.GROK_MODEL || 'grok-2';
  if (!key) return { ok:false, why:'no_grok_key' };
  const text = messages.map(m=>m.content).join("\n");
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages:[{role:'user', content:text}], max_tokens: max_tokens || 400, temperature:0.2 })
  });
  if (!res.ok) return { ok:false, why:'grok_http', status: res.status, detail: await res.text().catch(()=> '') };
  const data = await res.json();
  const out  = data?.choices?.[0]?.message?.content ?? '';
  return { ok:true, model, content: out };
}

export default async function handler(req) {
  if (req.method === 'GET') return R(200, { ok:true, name:'ask_tian', message:'WenTian alive' });
  if (req.method !== 'POST') return R(405, { error:'Method Not Allowed' });

  let p = {}; try { p = await req.json(); } catch {}
  const intent = p.intent || '';
  const sys = (p.voice === '掌門令')
    ? '你是冷靜斷語的決策助手，回答要短、條列化、少婉轉，不用Emoji。'
    : '你是務實的助手，回答清楚、條列化。';
  const messages = [{ role:'system', content: sys }, { role:'user', content: intent }];

  // 依前端分頁決定核心；缺金鑰時自動降級
  let core = String(p.core || '').toLowerCase();
  let up;
  const order = core === 'gpt4o' ? ['gpt4o','gemini','grok']
              : core === 'gemini' ? ['gemini','gpt4o','grok']
              : core === 'deepseek' ? ['gpt4o','gemini','grok']  // deepseek 先共用 openai 路徑
              : ['gpt4o','gemini','grok'];

  for (const c of order) {
    if (c === 'gpt4o') { up = await callOpenAI(messages, 400); if (up?.ok) { core='gpt4o'; break; } }
    if (c === 'gemini') { up = await callGemini(messages, 400); if (up?.ok) { core='gemini'; break; } }
    if (c === 'grok')   { up = await callGrok(messages, 400);   if (up?.ok) { core='grok';   break; } }
  }

  if (!up || !up.ok) {
    return R(200, { ok:true, route:'mock', answer:`[模擬回覆] 上游失敗：${up?.why || 'unknown'} ${up?.status || ''} ${up?.detail || ''}`.trim() });
  }
  return R(200, { ok:true, route:core, answer:up.content });
}
