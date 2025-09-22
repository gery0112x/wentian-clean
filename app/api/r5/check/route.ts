// app/api/r5/check/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const html = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>R5 一鍵檢查 / 任務台</title>
<style>
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:860px;margin:24px auto;padding:0 16px}
  section{border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  input,button{padding:8px 10px;border:1px solid #ccc;border-radius:8px}
  button{cursor:pointer;background:#fafafa}
  .ok{color:#15803d}.bad{color:#b91c1c}.mono{font-family:ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap}
  code{background:#f6f6f6;padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
  <h1>R5 一鍵檢查 / 任務台（API 版）</h1>

  <section>
    <div class="row" style="justify-content:space-between;align-items:center">
      <h3>A1｜基準檢查</h3>
      <button id="btn-recheck">重新檢查</button>
    </div>
    <div id="a1-log" style="font-size:14px;line-height:1.7"></div>
    <div id="a1-gate" class="mono" style="font-size:13px;background:#fafafa;border-radius:8px;padding:8px;margin-top:8px"></div>
  </section>

  <section>
    <h3>A2/A3｜發任務與追蹤</h3>
    <div class="row">
      <label>workflow_id<br/><input id="wf" placeholder="r5.yml" value="r5.yml"/></label>
      <label>ref<br/><input id="ref" placeholder="main" value="main"/></label>
      <label>goal<br/><input id="goal" placeholder="deploy main" value="deploy main" style="min-width:240px"/></label>
    </div>
    <div class="row" style="margin-top:8px">
      <button id="btn-gh">Start（GitHub）</button>
      <button id="btn-vercel">Start（Vercel Hook）</button>
    </div>
    <div id="a23-log" style="margin-top:10px;font-size:14px"></div>
    <div id="a23-debug" class="mono" style="font-size:13px;background:#fafafa;border-radius:8px;padding:8px;margin-top:8px"></div>
  </section>

  <section>
    <h3>A4｜備援（Vercel Deploy Hook）</h3>
    <div style="font-size:14px;color:#555">若 GitHub 有問題，可用上面的「Start（Vercel Hook）」快速驗證。</div>
  </section>

<script>
async function j(url, init){ try{ const r=await fetch(url,{...init,cache:"no-store"}); const js=await r.json().catch(()=>({})); return {http:r.status, ok:r.ok, js}; }catch(e){ return {http:0, ok:false, js:{error:String(e)}}; } }
function el(id){return document.getElementById(id)}
function line(k,v,good){ return '<div>'+k+'：<b class="'+(good?'ok':'bad')+'">'+v+'</b></div>' }

async function checkAll(){
  const log = el('a1-log'); const gate = el('a1-gate');
  log.innerHTML='檢查中…'; gate.textContent='(loading gate view…)';

  // Verify 視角（純檢查）
  const b = await j('/api/r5/baseline/verify');
  const p = await j('/api/r5/ping');
  const h = await j('/api/r5/health');

  let html='';
  html += line('baseline.ok', String(b?.js?.ok ?? false), !!b?.js?.ok);
  const d = b?.js?.data;
  if(d){
    html += '<div>enforced='+(d.enforced?'true':'false')+'</div>';
    html += '<div>repo='+ (d?.repo?.owner||'?') +'/'+ (d?.repo?.repo||'?') + '（來源：'+JSON.stringify(d?.sources||{})+'）</div>';
    html += '<div>spec '+(d?.spec?.present?'✅':'❌')+' v'+(d?.spec?.version||'-')+'</div>';
    html += '<div>pipeline.json '+(d?.pipeline?.present_json?'✅':'❌')+'；pipeline.mmd '+(d?.pipeline?.present_mmd?'✅':'❌')+' v'+(d?.pipeline?.version||'-')+'</div>';
    html += '<div>errors: path='+(d?.errors?.latest_path||'-')+'；open='+d?.errors?.open_count+'；blockers='+d?.errors?.open_blockers+'</div>';
  }
  html += line('/api/r5/ping', String(p?.ok), !!p?.ok);
  html += line('/api/r5/health', String(h?.ok), !!h?.ok);
  if(!(b?.js?.ok && p?.ok && h?.ok)){
    html += '<div style="color:#92400e;margin-top:6px">⚠️ 尚未通過。請修復 <code>errors.jsonl</code> 的阻斷（或設置 GH_TOKEN / VERCEL_DEPLOY_HOOK），再重試。</div>';
  }
  log.innerHTML = html;

  // Gate 視角（和 /api/r5/start 同一守門）
  const g = await j('/api/r5/baseline/ensure');
  gate.textContent = JSON.stringify(g, null, 2);
}

async function start(op){
  const wf = el('wf').value.trim();
  const ref= el('ref').value.trim();
  const goal=el('goal').value.trim();
  const body = op==='gh_dispatch' ? {op,workflow_id:wf,ref,goal} : {op,goal};

  el('a23-log').innerHTML='發起中…';
  el('a23-debug').textContent='';
  const r = await j('/api/r5/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok || !r.js?.ok){
    el('a23-log').innerHTML='失敗：'+(r.js?.error||('HTTP '+r.http));
    el('a23-debug').textContent = JSON.stringify(r.js||{}, null, 2); // 顯示 details
    return;
  }
  const id = r.js.id; el('a23-log').innerHTML='已建立 run：<code>'+id+'</code>，追蹤中…';

  async function poll(){
    const s = await j('/api/r5/runs/'+id);
    if(!s.ok){ el('a23-log').innerHTML+='\\n讀取失敗'; el('a23-debug').textContent=JSON.stringify(s.js||{},null,2); return; }
    const d = s.js?.data||{};
    el('a23-log').innerHTML = 'run：<code>'+id+'</code>｜狀態：<b>'+d.status+'</b>｜step '+d.step_index+'/'+(d.total_steps??'?')+'｜'+d.progress_percent+'%';
    if(['completed','failed','cancelled'].includes(String(d.status))) return;
    setTimeout(poll, 1500);
  }
  poll();
}

document.getElementById('btn-recheck').onclick=checkAll;
document.getElementById('btn-gh').onclick=()=>start('gh_dispatch');
document.getElementById('btn-vercel').onclick=()=>start('vercel_deploy');
checkAll();
</script>
</body></html>`;

export async function GET() {
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }});
}
