'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: Role;
  content: string;
}

interface ChatResponse {
  id?: string;
  choices?: Array<{
    index?: number;
    message?: { role: Role; content: string };
    delta?: { content?: string };
    text?: string;
  }>;
  text?: string;
  model?: string;
  created?: number;
}

function makeSessionId() {
  return `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickTextFromResponse(json: ChatResponse): string {
  const a = json?.choices?.[0]?.message?.content;
  if (a) return a;
  const b = (json?.choices?.[0] as any)?.text as string | undefined;
  if (b) return b;
  if (json?.text) return json.text;
  try { return JSON.stringify(json); } catch { return String(json ?? ''); }
}

const SESSION_KEY = 'wc.sessionId';
const STORE_PREFIX = 'wc.chat.';

export default function ChatPage() {
  const [sessionId, setSessionId] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY) || '';
    if (!sid) { sid = makeSessionId(); localStorage.setItem(SESSION_KEY, sid); }
    setSessionId(sid);
    const raw = localStorage.getItem(STORE_PREFIX + sid);
    if (raw) try { setMessages(JSON.parse(raw)); } catch {}
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(STORE_PREFIX + sessionId, JSON.stringify(messages));
  }, [messages, sessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const newChat = () => {
    const sid = makeSessionId();
    localStorage.setItem(SESSION_KEY, sid);
    setSessionId(sid);
    setMessages([]);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setError('');
    setBusy(true);
    const next = [...messages, { role: 'user', content: text } as ChatMessage];
    setMessages(next);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, sessionId, messages: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${await res.text()}`);
      const json = (await res.json()) as ChatResponse;
      const answer = pickTextFromResponse(json);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '發送失敗，請稍後再試');
      setMessages((prev) => [...prev, { role: 'assistant', content: '（系統）抱歉，我暫時無法回應。' }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const header = useMemo(() => (
    <div style={styles.header}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <a href="/" style={styles.brand}>wentian-clean</a>
        <span style={{ fontSize: 12, opacity: 0.7 }}>• Chat</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={styles.label}>模型</label>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={styles.select}>
          <option value="gpt-4o">gpt-4o</option>
        </select>
        <button onClick={newChat} style={styles.ghostBtn} title="開始新對話">新對話</button>
        <a href="/api/llm/health" target="_blank" style={styles.ghostLink}>健康檢查</a>
        <a href="/api/version/info" target="_blank" style={styles.ghostLink}>版本資訊</a>
      </div>
    </div>
  ), [model]);

  return (
    <div style={styles.page}>
      {header}
      <div style={styles.chatWrap}>
        <div ref={listRef} style={styles.list}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>嗨 👋</div>
              <div style={{ opacity: 0.7 }}>輸入訊息開始與模型對話吧！</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ ...styles.msg, ...(m.role === 'user' ? styles.userMsg : styles.assistantMsg) }}>
              <div style={styles.msgRole}>{m.role === 'user' ? '你' : m.role === 'assistant' ? 'AI' : '系統'}</div>
              <div style={styles.msgText}>{m.content}</div>
            </div>
          ))}
          {busy && (
            <div style={{ ...styles.msg, ...styles.assistantMsg }}>
              <div style={styles.msgRole}>AI</div>
              <div style={styles.msgText}>思考中…</div>
            </div>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.inputBar}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行）"
            rows={3}
            style={styles.textarea}
          />
          <button onClick={send} disabled={busy || !input.trim()} style={styles.sendBtn}>送出</button>
        </div>

        <div style={styles.footer}>
          <div>Session: <code>{sessionId || '(init...)'}</code></div>
          <div style={{ opacity: 0.6 }}>• 訊息會暫存在本機（localStorage），新對話會產生新的 Session。</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b0c10', color: '#e6edf3',
    fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji' },
  header: { height: 56, padding: '0 16px', borderBottom: '1px solid #1f2329', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', background: '#0b0c10', position: 'sticky', top: 0, zIndex: 10 },
  brand: { textDecoration: 'none', color: '#e6edf3', fontWeight: 700, letterSpacing: 0.2 },
  label: { fontSize: 12, opacity: 0.7 },
  select: { background: '#0f1115', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8, padding: '6px 8px', fontSize: 13 },
  ghostBtn: { background: 'transparent', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' },
  ghostLink:{ color:'#9fb3c8', textDecoration:'none', border:'1px solid #30363d', borderRadius:8, padding:'6px 10px', fontSize:13 },
  chatWrap:{ flex:1, margin:'0 auto', width:'min(900px, 100%)', display:'flex', flexDirection:'column', gap:8 },
  list:{ flex:1, overflowY:'auto', padding:'12px 16px' },
  empty:{ marginTop:32, textAlign:'center', opacity:0.8 },
  msg:{ display:'grid', gridTemplateColumns:'56px 1fr', gap:8, padding:'10px 12px', borderRadius:10, marginBottom:10 },
  userMsg:{ background:'#11141a', border:'1px solid #2a2f36' },
  assistantMsg:{ background:'#0f1318', border:'1px solid #26303a' },
  msgRole:{ fontSize:12, opacity:0.7, paddingTop:2 },
  msgText:{ whiteSpace:'pre-wrap', lineHeight:1.6 },
  inputBar:{ padding:12, borderTop:'1px solid #1f2329', display:'grid', gridTemplateColumns:'1fr 98px', gap:8, background:'#0b0c10' },
  textarea:{ resize:'vertical', minHeight:56, maxHeight:180, width:'100%', borderRadius:10, border:'1px solid #30363d',
    background:'#0f1115', color:'#e6edf3', padding:10, outline:'none' },
  sendBtn:{ borderRadius:10, border:'1px solid #2b6cb0', background:'#1e3a5f', color:'#e6edf3', fontWeight:600, cursor:'pointer' },
  error:{ color:'#ff8a8a', fontSize:13, paddingLeft:16 },
  footer:{ padding:'0 16px 12px 16px', fontSize:12, display:'flex', gap:12, color:'#9fb3c8' },
};
