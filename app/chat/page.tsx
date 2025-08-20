// app/chat/page.tsx
'use client';

import { useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: text }],
        }),
      });
      const d = await r.json();
      const reply =
        d?.choices?.[0]?.message?.content ?? d?.text ?? JSON.stringify(d);

      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: '（呼叫 /api/chat 失敗）' },
      ]);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 20,
        background: '#0b0c10',
        color: '#e6edf3',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22 }}>Chat</h1>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingRight: 4,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#1f6feb' : '#161b22',
              color: '#e6edf3',
              padding: '10px 12px',
              borderRadius: 10,
              maxWidth: 680,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="輸入訊息後按 Enter"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #30363d',
            background: '#0d1117',
            color: '#e6edf3',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 0,
            background: loading ? '#1f6feb99' : '#1f6feb',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '…' : '送出'}
        </button>
      </div>
    </main>
  );
}
