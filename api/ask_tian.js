export const config = { runtime: 'edge' };

function j(status, data) {
  return new Response(JSON.stringify(data), { status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'} });
}

async function callUpstream({model, messages, max_tokens}) {
  const key = (model === 'gemini') ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
  const baseUrl = (model === 'gemini') ? (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com')
                                       : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
  const useModel = (model === 'gemini') ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash')
                                       : (process.env.OPENAI_MODEL || 'gpt-4o');
  if (!key) return { ok:true, model:'mock', content:'[模擬回覆：尚未配置金鑰]' };
  if (model === 'gemini') {
    const url = `${baseUrl}/v1beta/models/${useModel}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: messages.map(m=>m.content).join("\n") }]}], generationConfig:{ maxOutputTokens: max_tokens || 400 } })
    });
    if (!r.ok) return { ok:false, status:r.status, detail: await r.text().catch(()=> '') };
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("") ?? "";
    return { ok:true, model: useModel, content: text };
  }
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method:'POST', headers:{ 'content-type':'application/json', 'authorization': `Bearer ${key}`},
    body: JSON.stringify({ model: useModel, messages, max_tokens: max_tokens || 400, temperature: 0.2 })
  });
  if (!r.ok) return { ok:false, status:r.status, detail: await r.text().catch(()=> '') };
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  return { ok:true, model: useModel, content: text };
}

export default async function handler(req) {
  if (req.method === 'GET') return j(200, { ok:true, name:'ask_tian', message:'WenTian alive' });
  if (req.method !== 'POST') return j(405, { error:'Method Not Allowed' });

  let p = {}; try { p = await req.json(); } catch {}
  const intent = p.intent || '';
  const sys = (p.voice === '掌門令') ? "你是冷靜斷語的決策助手，回答要短、條列化、少婉轉，不用Emoji。" : "你是務實的助手，回答清楚、條列化。";
  const messages = [ { role:'system', content: sys }, { role:'user', content: intent } ];
  const upstream = await callUpstream({ model: 'gemini', messages, max_tokens: 400 });
  if (!upstream.ok) return j(502, { error:'upstream_error', detail: upstream.detail });
  return j(200, { ok:true, route: 'gemini', answer: upstream.content });
}
