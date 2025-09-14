'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Provider = 'openai' | 'deepseek' | 'grok' | 'gemini'
type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

const MODELS_BASE = (process.env.NEXT_PUBLIC_MODELS_BASE || '/_models').replace(/\/+$/,'')
const R5_BASE     = (process.env.NEXT_PUBLIC_R5_BASE     || '/_r5').replace(/\/+$/,'')

const DEFAULTS: Record<Provider, string> = {
  openai: 'gpt-5',
  deepseek: 'deepseek-chat',
  grok: 'grok-beta',
  gemini: 'gemini-1.5-flash'
}
const FALLBACKS: Record<Provider, string> = {
  openai: 'gpt-4o-mini-2024-07-18',
  deepseek: 'deepseek-chat',
  grok: 'grok-beta',
  gemini: 'gemini-1.5-flash'
}
const SUPPORTS_STREAM: Record<Provider, boolean> = {
  openai: true, deepseek: false, grok: false, gemini: false,
}

export default function Chat() {
  const [provider, setProvider] = useState<Provider>('gemini') // 預設可用者
  const [model, setModel] = useState<string>(DEFAULTS.gemini)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'system', content: '你是無極入口的助理，回覆中文白話、簡潔直觀。' }
  ])
  const [streaming, setStreaming] = useState(false)
  const [pingOk, setPingOk] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [envWarn, setEnvWarn] = useState<string | null>(null)
  const [debug, setDebug] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const log = useCallback((s: string) => {
    const line = `[${new Date().toISOString()}] ${s}`
    setDebug(prev => [...prev.slice(-199), line])
    // eslint-disable-next-line no-console
    console.log('[SDK5-UI]', s)
  }, [])

  const postUrl = useMemo(() => `${MODELS_BASE}/${provider}/chat`, [provider])

  // ---- 健康檢查 ----
  const doPing = useCallback(async () => {
    try {
      log(`PING ${postUrl}?q=ping`)
      const res = await fetch(`${postUrl}?q=ping`, { method: 'GET', cache: 'no-store' })
      log(`PING status=${res.status}`)
      setPingOk(res.ok ? 'ok' : 'fail')
      return res.ok
    } catch (e: any) {
      log(`PING error=${e?.message || e}`)
      setPingOk('fail'); return false
    }
  }, [postUrl, log])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_MODELS_BASE) { setEnvWarn('NEXT_PUBLIC_MODELS_BASE 未設，已用 /_models'); log('ENV fallback MODELS=/ _models') }
    if (!process.env.NEXT_PUBLIC_R5_BASE) { log('ENV fallback R5=/ _r5') }
    doPing()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  // ---- 取字：容忍各家 JSON ----
  function pickText(json: any): string {
    if (!json || typeof json !== 'object') return ''
    for (const k of ['reply','content','text','output','answer']) {
      const v = json?.[k]; if (typeof v === 'string' && v.trim()) return v
    }
    const oai = json?.choices?.[0]
    if (oai?.message?.content && typeof oai.message.content === 'string') return oai.message.content
    if (oai?.delta?.content   && typeof oai.delta.content   === 'string') return oai.delta.content
    const parts = json?.candidates?.[0]?.content?.parts
    if (Array.isArray(parts)) {
      const t = parts.map((p:any)=>p?.text||'').join(''); if (t.trim()) return t
    }
    if (Array.isArray(json?.messages)) {
      const last = json.messages.at(-1); if (typeof last?.content === 'string') return last.content
    }
    return ''
  }
  function tokenFromSSE(data: string): string {
    try { const o = JSON.parse(data); return pickText(o) || (o?.choices?.[0]?.delta?.content ?? '') }
    catch { return data }
  }

  // ---- 發送：A messages → 若空/錯誤再 B q ----
  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }])
    setInput(''); setStreaming(true)

    const callOnce = async (mode:'messages'|'q', tryStream:boolean) => {
      abortRef.current?.abort(); abortRef.current = new AbortController()
      const signal = abortRef.current.signal
      const body = mode==='messages'
        ? { model, stream: tryStream, messages: messages.concat(userMsg).map(m=>({role:m.role, content:m.content})) }
        : { model, q: userMsg.content }

      log(`POST ${postUrl} mode=${mode} stream=${tryStream} model=${model}`)
      const res = await fetch(postUrl, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body), signal })
      const ct = res.headers.get('content-type') || ''
      log(`RESP status=${res.status} ct=${ct}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      if (tryStream && /text\/event-stream/i.test(ct) && res.body) {
        const reader = res.body.getReader(); const dec = new TextDecoder('utf-8'); let any=false
        while (true) {
          const {done,value}=await reader.read(); if (done) break
          const chunk = dec.decode(value,{stream:true})
          for (const line of chunk.split('\n')) {
            const s=line.trim(); if (!s.startsWith('data:')) continue
            const tok = tokenFromSSE(s.slice(5).trim()); if (!tok || tok==='[DONE]') continue
            any=true; setMessages(prev=>{ const last=prev.at(-1)!; return [...prev.slice(0,-1),{...last,content:(last.content||'')+tok}] })
          }
        }
        if (!any) log('STREAM no tokens'); return any?'ok':'empty'
      }
      if (/^text\/plain/i.test(ct)) {
        const t=(await res.text()).trim()
        setMessages(prev=>{ const last=prev.at(-1)!; return [...prev.slice(0,-1),{...last,content:t||'[空回覆]'}] })
        return t?'ok':'empty'
      }
      const json = await res.json().catch(()=>({}))
      const out = pickText(json); log(`JSON diag=${JSON.stringify({ok:json?.ok,status:json?.status,cap:json?.cap_notice})} len=${out?.length||0}`)
      if (!out) {
        const err = json?.error || json?.message || (json?.cap_notice ? `cap_notice=${json.cap_notice}` : '')
        setMessages(prev=>{ const last=prev.at(-1)!; return [...prev.slice(0,-1),{...last,content: err?`【空回覆｜診斷】${err}`:'[空回覆]'}] })
        return 'empty'
      }
      setMessages(prev=>{ const last=prev.at(-1)!; return [...prev.slice(0,-1),{...last,content:out}] })
      return 'ok'
    }

    try {
      const r1 = await callOnce('messages', SUPPORTS_STREAM[provider])
      if (r1==='ok') return
      log(`FALLBACK → mode=q (因 ${r1})`)
      await callOnce('q', false)
    } catch (e:any) {
      log(`ALL FAIL: ${e?.message||e}`)
      setMessages(prev=>{ const last=prev.at(-1)!; return [...prev.slice(0,-1),{...last,content:`【錯誤】${e?.message||e}`}] })
    } finally { setStreaming(false) }
  }, [input, streaming, messages, model, provider, postUrl, log])

  return (
    <div className="shell">
      <header className="head">
        <div className="title">無極入口 · SDK5 殼</div>
        <div className="meta">MODELS_BASE={MODELS_BASE} · R5_BASE={R5_BASE}</div>
      </header>

      {envWarn && <div className="warn">{envWarn}</div>}

      <section className="controls">
        <label>
          <span>供應商（Gemini預設，其它實驗中）</span>
          <select value={provider} onChange={e=>{ const p=e.target.value as Provider; setProvider(p); setModel(DEFAULTS[p]) }}>
            <option value="gemini">gemini</option>
            <option value="openai">openai（實驗）</option>
            <option value="deepseek">deepseek（實驗）</option>
            <option value="grok">grok（實驗）</option>
          </select>
        </label>
        <label className="model">
          <span>模型</span>
          <input value={model} onChange={e=>setModel(e.target.value)} placeholder={DEFAULTS[provider]} />
        </label>
        <button onClick={doPing} className="ping">健康檢查 {pingOk==='ok'?'✅':pingOk==='fail'?'❌':'…'}</button>
      </section>

      <main className="msgs">
        {messages.filter(m=>m.role!=='system').map((m,i)=>(
          <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
      </main>

      <footer className="composer">
        <input
          placeholder="輸入訊息…（中文白話）"
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if (e.key==='Enter' && !e.shiftKey) sendMessage() }}
        />
        <button onClick={sendMessage} disabled={streaming || !input.trim()}>送出</button>
      </footer>

      <details className="debug">
        <summary>除錯紀錄 / Debug logs</summary>
        <pre>{debug.join('\n')}</pre>
      </details>

      <style jsx>{`
        .shell{min-height:100vh;background:#0b1020;color:#eaeefb;display:flex;flex-direction:column}
        .head{position:sticky;top:0;z-index:10;background:linear-gradient(90deg,#0b1020,#182449);border-bottom:1px solid #22315e;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
        .title{font-weight:800}
        .meta{font-size:12px;opacity:.7}
        .warn{background:#fff3cd;color:#664d03;padding:8px 16px}
        .controls{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;padding:12px 16px}
        .controls span{display:block;font-size:12px;opacity:.8;margin-bottom:4px}
        select,input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #33406b;background:#111734;color:#eaeefb}
        .model{grid-column:2/3}
        .ping{padding:10px 12px;border-radius:10px;border:1px solid #33406b;background:#0e1640;color:#dbe5ff}
        .msgs{flex:1;padding:8px 16px 96px;display:flex;flex-direction:column;gap:10px}
        .bubble{max-width:85%;padding:10px 12px;border-radius:14px;line-height:1.5}
        .bubble.user{align-self:flex-end;background:#2e5cff;color:#fff}
        .bubble.assistant{align-self:flex-start;background:#1b2447;color:#dbe5ff;border:1px solid #2c3a6b}
        .composer{position:fixed;left:0;right:0;bottom:0;background:#0b1020;border-top:1px solid #22315e;display:flex;gap:8px;padding:10px 16px}
        .composer input{flex:1;padding:12px;border-radius:12px;border:1px solid #33406b;background:#111734;color:#eaeefb}
        .composer button{padding:12px 16px;border-radius:12px;border:1px solid #33406b;background:#2e5cff;color:#fff}
        .debug{padding:8px 16px 16px;color:#98a7e0}
        .debug pre{white-space:pre-wrap;word-break:break-word;border:1px solid #22315e;border-radius:10px;padding:8px;max-height:180px;overflow:auto;background:#0f1633}
        @media (max-width:640px){ .controls{grid-template-columns:1fr;}.model{grid-column:auto} }
      `}</style>
    </div>
  )
}
