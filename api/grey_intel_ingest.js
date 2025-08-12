export const config = { runtime: 'edge' };
function J(s,d){ return new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json'}}); }
export default async function handler(req) {
  if (req.method !== 'POST') return J(405,{error:'Method Not Allowed'});
  const p = await req.json().catch(()=>({}));
  const raw = p.text || '';
  const cleaned = raw.replace(/\b(\d{3})[- ]?(\d{3,4})[- ]?(\d{3,4})\b/g, '***-****-****');
  const fp = 'fp_'+(Math.abs(Array.from(cleaned).reduce((h,c)=>Math.imul(31,h)+c.charCodeAt(0)|0,0))>>>0).toString(16);
  return J(200, { ok:true, card:{ id:fp, kind:p.kind||'Fact', content:cleaned, source_hash:fp, ttl:604800 } });
}
