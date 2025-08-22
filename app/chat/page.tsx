// app/chat/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        '讀取身份中…\n先由後台（白話提案模組）判斷是否接手；未接手再走一般聊天。',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // 捲到最底
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((s) => [...s, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.filter(m => m.role !== 'assistant' || !m.content.startsWith('讀取身份中')), { role: 'user', content: text }],
        }),
      });

      const data = await r.json();
      const content: string =
        data?.message?.content ??
        data?.data?.choices?.[0]?.message?.content ?? // 兼容舊格式
        '（無內容）';

      setMessages((s) => [...s, { role: 'assistant', content }]);
    } catch (err: any) {
      setMessages((s) => [
        ...s,
        { role: 'assistant', content: `發生錯誤：${String(err?.message ?? err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="p-3 border-b text-sm">
        <b>/chat</b>　<span className="opacity-70">（白話提案模組優先，未接手則一般對話）</span>
      </header>

      <div ref={scroller} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap leading-6 ${m.role === 'user' ? 'text-blue-700' : 'text-zinc-900'}`}>
            <span className="font-semibold">{m.role === 'user' ? '你' : '助手'}</span>：{m.content}
          </div>
        ))}
        {loading && <div className="opacity-60">助手正在思考中…</div>}
      </div>

      <form onSubmit={onSubmit} className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="直接用白話說（例如：新增權限…）"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          送出
        </button>
      </form>
    </div>
  );
}
