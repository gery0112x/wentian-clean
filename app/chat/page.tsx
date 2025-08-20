'use client';

import React, { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

export default function ChatPage() {
  const [idn, setIdn] = useState<{ platform: string; realm: string; operator: string; banner: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'system', content: '你是白話提案模組與聊天助理的總管。' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 讀取身份（無極.元始境 00-00 / 柯老）
    fetch('/api/ops/trigger', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setIdn({ platform: d.platform, realm: d.realm, operator: d.operator, banner: d.banner }))
      .catch(() => void 0);
  }, []);

  useEffect(() => {
    scRef.current?.scrollTo({ top: scRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function callOpsTrigger(text: string) {
    const r = await fetch('/api/ops/trigger', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return r.json();
  }

  async function callChatAPI(text: string) {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          ...messages.filter(m => m.role !== 'system'),
          { role: 'user', content: text },
        ],
      }),
    });
    return r.json();
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');

    try {
      // 先走後台「白話提案模組」總管
      const gate = await callOpsTrigger(text);

      if (gate?.ok && gate?.handled) {
        // 後台已處理（走 proposal / upgrade ... ）
        const pretty = JSON.stringify(
          { intent: gate.intent, result: gate.result ?? gate.error ?? null },
          null,
          2,
        );
        setMessages(m => [
          ...m,
          { role: 'assistant', content: `【後台：${gate.banner ?? '無極'}】\n${pretty}` },
        ]);
      } else {
        // 後台未接手 → 回到一般聊天
        const data = await callChatAPI(text);
        const content =
          data?.choices?.[0]?.message?.content ??
          data?.content ??
          JSON.stringify(data, null, 2);
        setMessages(m => [...m, { role: 'assistant', content }]);
      }
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', content: `發生錯誤：${String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 rounded-xl border p-4 text-sm">
        <div className="font-semibold">/chat</div>
        <div className="opacity-80">
          {idn ? `${idn.platform}.${idn.realm} — 操作者：${idn.operator}` : '讀取身份中…'}
        </div>
        <div className="opacity-60">先由後台（白話提案模組）判斷是否接手；未接手再走一般聊天。</div>
      </header>

      <div
        ref={scRef}
        className="flex-1 overflow-y-auto rounded-xl border p-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.map((m, i) => (
          <div key={i} className="mb-3 whitespace-pre-wrap">
            <span className="mr-2 inline-block rounded px-2 py-0.5 text-xs opacity-70"
              style={{ background: m.role === 'user' ? '#e6f4ff' : m.role === 'assistant' ? '#f1f8e9' : '#eee' }}>
              {m.role}
            </span>
            {m.content}
          </div>
        ))}
        {busy && <div className="opacity-60">思考中…</div>}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2"
          placeholder="直接用白話說（例如：新增新版區，權限 admin/editor；或是：回滾上一版；查進度）"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? '送出中…' : '送出'}
        </button>
      </form>
    </div>
  );
}
