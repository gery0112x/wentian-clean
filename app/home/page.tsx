'use client';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const R5_BASE  = process.env.NEXT_PUBLIC_R5_BASE || '/_r5';
const MODELS   = process.env.NEXT_PUBLIC_MODELS_BASE || '/_models';

export default function Home() {
  const log = (m: string, o?: any) => {
    console.log('[PWA]', m, o ?? '');
    const el = document.getElementById('dbg');
    if (el) el.textContent = `[${new Date().toISOString()}] ${m}\n${o?JSON.stringify(o,null,2):''}`;
  };

  const ping = async () => {
    try {
      const r = await fetch(`${MODELS}/openai/chat?q=ping`, { cache: 'no-store' });
      const j = await r.json().catch(()=>({}));
      log(`/_models ping => ${r.status}`, j);
      alert(`/_models ping: ${r.status} ${(j.reply||'')}`);
    } catch (e:any) {
      log('ping error', { message: e?.message });
      alert('ping error');
    }
  };

  const signin = async () => {
    if (!SUPA_URL) { log('MISSING NEXT_PUBLIC_SUPABASE_URL'); alert('缺 SUPABASE_URL'); return; }
    const redirect = window.location.origin; // 已納入 allowlist
    const url = `${SUPA_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
    log('redirect to Google', { url });
    window.location.href = url;
  };

  const envCheck = () => {
    const ok = !!SUPA_URL && !!MODELS;
    log('env check', { SUPA_URL, MODELS, R5_BASE, ok });
    alert(ok ? 'ENV OK' : 'ENV 缺值，詳見畫面 DEBUG');
  };

  return (
    <main style={{ padding: 16, fontFamily: 'ui-sans-serif' }}>
      <h1>無極入口（最小 PWA 殼）</h1>
      <p>只打自家路由：{MODELS} / {R5_BASE}</p>
      <div style={{ display:'flex', gap:8, margin:'12px 0' }}>
        <button onClick={envCheck}>環境自檢</button>
        <button onClick={ping}>/_models ping</button>
        <button onClick={signin}>Google 登入</button>
      </div>
      <pre id="dbg" style={{whiteSpace:'pre-wrap', background:'#f6f7f9', padding:12, borderRadius:8}} />
      <small>除錯：開發者工具→Application→Cookies 應看到 sb-*（登入後）</small>
    </main>
  );
}
