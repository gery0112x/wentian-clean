// @ts-nocheck
'use client';
import React, { useEffect, useState } from 'react';
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
  const [bipEvt, setBipEvt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [mode, setMode] = useState<'standalone' | 'browser'>('browser');

  const log = (m: string, o?: any) => {
    const line = `[${new Date().toISOString()}] ${m}\n${o ? JSON.stringify(o, null, 2) : ''}`;
    console.log('[PWA]', m, o ?? '');
    const el = document.getElementById('dbg');
    if (el) el.textContent = line + '\n' + el.textContent;
  };

  // Session + URL 清理
  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      const { data: s1 } = await supabase.auth.getSession();
      if (s1.session) {
        setEmail(s1.session.user.email ?? null);
        setNotice('✅ 已登入（沿用既有 session）');
        if (code) { url.searchParams.delete('code'); url.searchParams.delete('state'); window.history.replaceState({}, '', url.pathname); }
        return;
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          log('exchange error', { message: error.message, ls: dumpLS() });
          setNotice('⚠️ 交換失敗，但可用 LocalStorage 會話：按「輸出 LocalStorage」存證');
        } else {
          setEmail(data.session?.user?.email ?? null);
          setNotice('✅ 登入成功（PKCE）');
        }
        url.searchParams.delete('code'); url.searchParams.delete('state');
        window.history.replaceState({}, '', url.pathname);
      }
    })();
  }, []);

  // A2HS
  useEffect(() => {
    const onBIP = (e: any) => { e.preventDefault(); setBipEvt(e); setCanInstall(true); log('beforeinstallprompt'); };
    const onInstalled = () => { setInstalled(true); setNotice('✅ 已安裝（appinstalled）'); log('appinstalled'); };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    const check = () => setMode(window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
    check(); window.matchMedia('(display-mode: standalone)').addEventListener?.('change', check);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!bipEvt) { setNotice('尚未可安裝（等待 beforeinstallprompt）'); return; }
    bipEvt.prompt();
    const choice = await bipEvt.userChoice;
    setNotice(`A2HS：${choice.outcome}`);
    setBipEvt(null); setCanInstall(false);
    log('userChoice', choice);
  };

  const ping = async () => {
    const r = await fetch('/_models/openai/chat?q=ping', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    log(`/_models ping => ${r.status}`, j);
    alert(`/_models ping: ${r.status} ${(j.reply || '')}`);
  };
  const signin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) log('signin error', { message: error.message });
  };
  const signout = async () => { await supabase.auth.signOut(); setEmail(null); setNotice('已登出'); };
  const dumpStorage = () => { log('localStorage dump', dumpLS()); alert('已輸出到下方 DEBUG 區'); };

  return (
    <main style={{ padding: 16, fontFamily: 'ui-sans-serif' }}>
      <h1>無極入口（最小 PWA 殼）</h1>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
        <button onClick={ping}>/_models ping</button>
        <button onClick={signin}>Google 登入</button>
        <button onClick={signout}>登出</button>
        <button onClick={dumpStorage}>輸出 LocalStorage</button>
        <button onClick={install} disabled={!canInstall}>安裝 App</button>
        <span style={{alignSelf:'center'}}>顯示模式：<b>{mode}</b>　已安裝：<b>{installed ? '是' : '否'}</b></span>
      </div>
      {notice && <div style={{padding:12,background:'#ECFDF5',border:'1px solid #10B981',borderRadius:8,marginBottom:12}}>{notice}</div>}
      <div>當前使用者：{email ?? '未登入'}</div>
      <pre id="dbg" style={{whiteSpace:'pre-wrap',background:'#f6f7f9',padding:12,borderRadius:8,minHeight:120}} />
    </main>
  );
}
