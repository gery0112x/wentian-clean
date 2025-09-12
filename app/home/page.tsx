'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: 'pkce' } } // PKCE 流程
);

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const log = (m: string, o?: any) => {
    console.log('[PWA]', m, o ?? '');
    const el = document.getElementById('dbg');
    if (el) el.textContent =
      `[${new Date().toISOString()}] ${m}\n${o ? JSON.stringify(o, null, 2) : ''}`;
  };

  // 首次載入：若 URL 有 code，就交換成 session（PKCE）
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    (async () => {
      try {
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          // 官方：exchangeCodeForSession（用 PKCE 換取 session）。:contentReference[oaicite:1]{index=1}
          if (error) throw error;
          setEmail(data.session?.user?.email ?? null);
          log('exchange ok', { user: data.session?.user });
          // 去掉 URL 上的 code/state
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, document.title, url.pathname);
        } else {
          const { data } = await supabase.auth.getSession();
          setEmail(data.session?.user?.email ?? null);
        }
      } catch (e: any) {
        log('exchange error', { message: e?.message });
      }
    })();
  }, []);

  const envCheck = async () => {
    const ok = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    log('env check', {
      SUPA_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      ok,
    });
    alert(ok ? 'ENV OK' : 'ENV 缺值，詳見 DEBUG 區');
  };

  const ping = async () => {
    try {
      const r = await fetch('/_models/openai/chat?q=ping', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      log(`/_models ping => ${r.status}`, j);
      alert(`/_models ping: ${r.status} ${(j.reply || '')}`);
    } catch (e: any) {
      log('ping error', { message: e?.message });
    }
  };

  const signin = async () => {
    // 用官方方法觸發 OAuth，會自動保存 PKCE code_verifier，供回站交換使用。:contentReference[oaicite:2]{index=2}
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin } // 你已加入 allowlist
    });
    if (error) log('signin error', { message: error.message });
  };

  const signout = async () => {
    await supabase.auth.signOut();
    setEmail(null);
    log('signed out');
  };

  return (
    <main style={{ padding: 16, fontFamily: 'ui-sans-serif' }}>
      <h1>無極入口（最小 PWA 殼）</h1>
      <p>只打自家路由：/_models / _r5</p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={envCheck}>環境自檢</button>
        <button onClick={ping}>/_models ping</button>
        <button onClick={signin}>Google 登入</button>
        <button onClick={signout}>登出</button>
      </div>

      <div>當前使用者：{email ?? '未登入'}</div>
      <pre id="dbg" style={{ whiteSpace: 'pre-wrap', background: '#f6f7f9', padding: 12, borderRadius: 8 }} />
      <small>除錯提示：Supabase 默認把 session 存在 Local Storage（非 Cookie）。:contentReference[oaicite:3]{index=3}</small>
    </main>
  );
}
