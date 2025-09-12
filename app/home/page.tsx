'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: 'pkce' } } // PKCE
);

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [hasCode, setHasCode] = useState<boolean>(false);

  const log = (m: string, o?: any) => {
    const line = `[${new Date().toISOString()}] ${m}\n${o ? JSON.stringify(o, null, 2) : ''}`;
    console.log('[PWA]', m, o ?? '');
    const el = document.getElementById('dbg');
    if (el) el.textContent = line + '\n' + el.textContent;
    localStorage.setItem('wuji_dbg_last', line);
  };

  const clearUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.pathname);
    setHasCode(false);
    setNotice('已清除網址參數');
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) setHasCode(true);

    (async () => {
      try {
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setEmail(data.session?.user?.email ?? null);
          setNotice('✅ 登入成功｜請先截圖此畫面；再按「清除網址參數」');
          log('exchange ok', { user: data.session?.user });
        } else {
          const { data } = await supabase.auth.getSession();
          setEmail(data.session?.user?.email ?? null);
        }
      } catch (e: any) {
        setNotice('❌ 登入失敗：' + (e?.message || 'unknown'));
        log('exchange error', { message: e?.message });
      }
    })();
  }, []);

  const envCheck = () => {
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
    log('signed out');
  };

  const dumpStorage = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.includes('supabase'));
    const dump = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
    log('localStorage dump', dump);
    alert('已輸出至下方 DEBUG 區，請截圖');
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
        <button onClick={dumpStorage}>輸出 LocalStorage</button>
        {hasCode && <button onClick={clearUrlParams}>清除網址參數</button>}
      </div>

      {notice && (
        <div style={{ padding: 12, background: '#ECFDF5', border: '1px solid #10B981', borderRadius: 8, marginBottom: 12 }}>
          {notice}
        </div>
      )}

      <div>當前使用者：{email ?? '未登入'}</div>
      <pre id="dbg" style={{ whiteSpace: 'pre-wrap', background: '#f6f7f9', padding: 12, borderRadius: 8, minHeight: 120 }} />
      <small>提示：Supabase 前端 SDK 會把 session 存在 LocalStorage（鍵名多為 sb-* 或 supabase.*）。</small>
    </main>
  );
}
