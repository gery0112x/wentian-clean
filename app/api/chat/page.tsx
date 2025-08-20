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
    // 一些供相容的欄位
    delta?: { content?: string };
    text?: string;
  }>;
  text?: string;
  model?: string;
  created?: number;
  // 其他後端回傳欄位不強制定義
}

/** 產生簡單 sid */
function makeSessionId() {
  return `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 從回應中取文字（相容不同格式） */
function pickTextFromResponse(json: ChatResponse): string {
  // openai-like: choices[0].message.content
  const a = json?.choices?.[0]?.message?.content;
  if (a) return a;

  // 非標準：choices[0].text
  const b = (json?.choices?.[0] as any)?.text as string | undefined;
  if (b) return b;

  // 直接 text
  if (json?.text) return json.text;

  // 嘗試展開物件看看
  try {
    return JSON.stringify(json);
  } catch {
    return String(json ?? '');
  }
}

/** 本地儲存 key */
const SESSION_KEY = 'wc.sessionId';
const STORE_PREFIX = 'wc.chat.';

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-4o');
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 初始：載入或建立 sessionId、載入歷史訊息
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY) || '';
    if (!sid) {
      sid = makeSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);

    const raw = localStorage.getItem(STORE_PREFIX + sid);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ChatMessage[];
        setMessages(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  // 每次訊息有變更就保存
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(STORE_PREFIX + sessionId, JSON.stringify(messages));
  }, [messages, sessionId]);

  // 捲到最底
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // 新對話：換一個 sessionId
  const newChat = () => {
    const sid = makeSessionId();
    localStorage.setItem(SESSION_KEY, sid);
    setSessionId(sid);
    setMessages([]);
    setError('');
    // 清空輸入並 focus
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setError('');
    setBusy(true);

    // 先加使用者訊息到畫面
    const next = [...messages, { role: 'user', content: text } as ChatMessage];
    setMessages(next);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          sessionId, // 後端未用也沒關係，之後接「雙層記憶」時可直接沿用
          messages: next,
        }),
      });

      if (!res.ok) {
        const raw = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${raw}`);
      }

      const json = (await res.json()) as ChatResponse;
      const answer = pickTextFromResponse(json);

      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '發送失敗，請稍後再試');
      // 失敗時不移除用戶訊息，但可以加一則錯誤提示訊息
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '（系統）抱歉，我暫時無法回應。' },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const header = useMemo(
    () => (
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <a href="/" style={styles.brand}>
            wentian-clean
          </a>
          <span style={{ fontSize: 12, opacity: 0.7 }}>• Chat</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={styles.label}>模型</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={styles.select}
          >
            <option value="gpt-4o">gpt-4o</option>
            {/* 你也可以開放其他： */}
            {/* <option value="grok-2">grok-2</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option> */}
          </select>

          <button onClick={newChat} style={styles.ghostBtn} title="開始新對話">
            新對話
          </button>
          <a href="/api/llm/health" target="_blank" style={styles.ghostLink}>
            健康檢查
          </a>
          <a href="/api/version/info" target="_blank" style={styles.ghostLink}>
            版本資訊
          </a>
        </div>
      </div>
    ),
    [model]
  );

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
            <div
              key={i}
              style={{
                ...styles.msg,
                ...(m.role === 'user' ? styles.userMsg : styles.assistantMsg),
              }}
            >
              <div style={styles.msgRole}>
                {m.role === 'user' ? '你' : m.role === 'assistant' ? 'AI' : '系統'}
              </div>
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
          <button onClick={send} disabled={busy || !input.trim()} style={styles.sendBtn}>
            送出
          </button>
        </div>

        <div style={styles.footer}>
          <div>Session: <code>{sessionId || '(init...)'}</code></div>
          <div style={{ opacity: 0.6 }}>
            • 訊息會暫存在本機（localStorage），新對話會產生新的 Session。
          </div>
        </div>
      </div>
    </div>
  );
}

/* 簡易樣式（避免依賴 Tailwind） */
const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0b0c10',
    color: '#e6edf3',
    fontFamily:
      '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji',
  },
  header: {
    height: 56,
    padding: '0 16px',
    borderBottom: '1px solid #1f2329',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#0b0c10',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  brand: {
    textDecoration: 'none',
    color: '#e6edf3',
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  label: { fontSize: 12, opacity: 0.7 },
  select: {
    background: '#0f1115',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 13,
  },
  ghostBtn: {
    background: 'transparent',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    cursor: 'pointer',
  },
  ghostLink: {
    color: '#9fb3c8',
    textDecoration: 'none',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
  },
  chatWrap: {
    flex: 1,
    margin: '0 auto',
    width: 'min(900px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    opacity: 0.8,
  },
  msg: {
    display: 'grid',
    gridTemplateColumns: '56px 1fr',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    marginBottom: 10,
  },
  userMsg: {
    background: '#11141a',
    border: '1px solid #2a2f36',
  },
  assistantMsg: {
    background: '#0f1318',
    border: '1px solid #26303a',
  },
  msgRole: {
    fontSize: 12,
    opacity: 0.7,
    paddingTop: 2,
  },
  msgText: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  inputBar: {
    padding: 12,
    borderTop: '1px solid #1f2329',
    display: 'grid',
    gridTemplateColumns: '1fr 98px',
    gap: 8,
    background: '#0b0c10',
  },
  textarea: {
    resize: 'vertical',
    minHeight: 56,
    maxHeight: 180,
    width: '100%',
    borderRadius: 10,
    border: '1px solid #30363d',
    background: '#0f1115',
    color: '#e6edf3',
    padding: 10,
    outline: 'none',
  },
  sendBtn: {
    borderRadius: 10,
    border: '1px solid #2b6cb0',
    background: '#1e3a5f',
    color: '#e6edf3',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#ff8a8a',
    fontSize: 13,
    paddingLeft: 16,
  },
  footer: {
    padding: '0 16px 12px 16px',
    fontSize: 12,
    display: 'flex',
    gap: 12,
    color: '#9fb3c8',
  },
};
