'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } }
);

function readLocalSessionEmail(): string | null {
  try {
    const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
    if (!k) return null;
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j.user?.email ?? j?.user?.user_metadata?.email ?? null;
  } catch { return null; }
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
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');

    (async () => {
      try {
        if (code) {
          // 1) 嘗試 PKCE 交換
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            log('exchange error', { message: error.message });
            // 2) 失敗時：回讀 localStorage 中已存在的 session（你目前就屬於這種情況）
            const e = readLocalSessionEmail();
            if (e) {
              setEmail(e);
              setNotice('✅ 已從 localStorage 回讀登入（PKCE 交換失敗，但會話有效）');
            } else {
              setNotice('❌ 登入失敗：' + error.message);
            }
          } else {
            setEmail(data.session?.user?.email ?? null);
            setNotice('✅ 登入成功（PKCE）');
          }
          // 清 URL 參數
          url.searchParams.delete('code'); url.searchParams.delete('state');
          window.history.replaceState({}, document.title, url.pathname);
        } else {
          // 首頁直進：讀現有 session
          const { data } = await supabase.auth.getSession();
          setEmail(data.session?.user?.email ?? readLocalSessionEmail());
        }
      } catch (e: any) {
        setNotice('❌ 例外：' + (e?.message || 'unknown'));
        log('exception', { message: e?.message });
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
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
    const dump = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
    log('localStorage dump', dump);
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
      <small>提示：前端 SDK 會把 session 存在 LocalStorage（鍵名多為 sb-*）。</small>
    </main>
  );
}
