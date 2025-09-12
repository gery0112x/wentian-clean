'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } }
);

function dumpLS() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.includes('supabase'));
  return Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
}

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');

  const log = (m: string, o?: any) => {
    const line = `[${new Date().toISOString()}] ${m}\n${o ? JSON.stringify(o, null, 2) : ''}`;
    console.log('[PWA]', m, o ?? '');
    const el = document.getElementById('dbg');
    if (el) el.textContent = line + '\n' + el.textContent;
  };

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      // ❶ 先讀現有 session（若已登入就跳過 exchange）
      const { data: s1 } = await supabase.auth.getSession();
      if (s1.session) {
        setEmail(s1.session.user.email ?? null);
        setNotice('✅ 已登入（沿用既有 session）');
        if (code) {
          url.searchParams.delete('code'); url.searchParams.delete('state');
          window.history.replaceState({}, document.title, url.pathname);
        }
        return;
      }

      // ❷ 沒有 session 才嘗試 PKCE exchange
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          log('exchange error', { message: error.message, ls: dumpLS() });
          setNotice('⚠️ 交換失敗，但可用 LocalStorage 會話：請按「輸出 LocalStorage」存證');
        } else {
          setEmail(data.session?.user?.email ?? null);
          setNotice('✅ 登入成功（PKCE）');
        }
        url.searchParams.delete('code'); url.searchParams.delete('state');
        window.history.replaceState({}, document.title, url.pathname);
      }
    })();
  }, []);

  const ping = async () => {
    const r = await fetch('/_models/openai/chat?q=ping', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    log(`/_models ping => ${r.status}`, j);
    alert(`/_models ping: ${r.status} ${(j.reply || '')}`);
  };

  const signin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) log('signin error', { message: error.message });
  };

  const signout = async () => {
    await supabase.auth.signOut();
    setEmail(null);
    setNotice('已登出');
  };

  const dumpStorage = () => {
    log('localStorage dump', dumpLS());
    alert('已輸出到下方 DEBUG 區');
  };

  return (
    <main style={{ padding: 16, fontFamily: 'ui-sans-serif' }}>
      <h1>無極入口（最小 PWA 殼）</h1>
      <div style={{ display:'flex', gap:8, margin:'12px 0' }}>
        <button onClick={ping}>/_models ping</button>
        <button onClick={signin}>Google 登入</button>
        <button onClick={signout}>登出</button>
        <button onClick={dumpStorage}>輸出 LocalStorage</button>
      </div>

      {notice && <div style={{padding:12,background:'#ECFDF5',border:'1px solid #10B981',borderRadius:8,marginBottom:12}}>{notice}</div>}
      <div>當前使用者：{email ?? '未登入'}</div>
      <pre id="dbg" style={{whiteSpace:'pre-wrap',background:'#f6f7f9',padding:12,borderRadius:8,minHeight:120}} />
      <small>說明：前端 SDK 支援 OAuth（含 PKCE）與 `exchangeCodeForSession`；預設 session 存 LocalStorage。參考：signInWithOAuth、sessions、PKCE flow。</small>
    </main>
  );
}
