'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Provider = 'openai' | 'deepseek' | 'grok' | 'gemini'

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

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

export default function Chat() {
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState<string>(DEFAULTS.openai)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'system', content: '你是無極入口的助理，回覆簡潔、直觀、中文白話。' }
  ])
  const [streaming, setStreaming] = useState(false)
  const [pingOk, setPingOk] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [envWarn, setEnvWarn] = useState<string | null>(null)
  const [debug, setDebug] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const appendDebug = useCallback((line: string) => {
    setDebug(prev => [...prev.slice(-199), `[${new Date().toISOString()}] ${line}`])
    console.log('[SDK5-UI]', line)
  }, [])

  const postUrl = useMemo(() => `${MODELS_BASE}/${provider}/chat`, [provider])

  const doPing = useCallback(async () => {
    try {
      appendDebug(`PING ${postUrl}?q=ping`)
      const res = await fetch(`${postUrl}?q=ping`, { method: 'GET', cache: 'no-store' })
      appendDebug(`PING status=${res.status}`)
      setPingOk(res.ok ? 'ok' : 'fail')
      return res.ok
    } catch (e: any) {
      appendDebug(`PING error=${e?.message || e}`)
      setPingOk('fail')
      return false
    }
  }, [postUrl, appendDebug])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_MODELS_BASE) {
      setEnvWarn('NEXT_PUBLIC_MODELS_BASE 未設，已使用預設 /_models')
      appendDebug('ENV WARN: NEXT_PUBLIC_MODELS_BASE missing → fallback "/_models"')
    }
    if (!process.env.NEXT_PUBLIC_R5_BASE) {
      appendDebug('ENV INFO: NEXT_PUBLIC_R5_BASE missing → fallback "/_r5"')
    }
    doPing()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const tryOnce = async (tryStream: boolean) => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const signal = abortRef.current.signal

      const body = JSON.stringify({
        model,
        stream: tryStream,
        messages: messages.concat(userMsg).map(m => ({ role: m.role, content: m.content }))
      })

      appendDebug(`POST ${postUrl} stream=${tryStream} model=${model}`)
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal
      })
      appendDebug(`POST status=${res.status} ct=${res.headers.get('content-type') || ''}`)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const ct = res.headers.get('content-type') || ''
      if (tryStream && /text\/event-stream/i.test(ct)) {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder('utf-8')
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (!data || data === '[DONE]') continue
            setMessages(prev => {
              const last = prev[prev.length - 1]
              const head = prev.slice(0, -1)
              return [...head, { ...last, content: (last.content || '') + data }]
            })
          }
        }
        return
      }

      const json = await res.json().catch(() => ({} as any))
      appendDebug(`JSON keys=${Object.keys(json).join(',')}`)
      const candidate =
        json.reply ??
        json.output ??
        json.content ??
        json.text ??
        json.choices?.[0]?.message?.content ??
        ''
      setMessages(prev => {
        const last = prev[prev.length - 1]
        const head = prev.slice(0, -1)
        return [...head, { ...last, content: candidate || '[空回覆]' }]
      })
    }

    try {
      await tryOnce(true)     // A: 串流
    } catch (eA) {
      appendDebug(`STREAM FAIL → fallback JSON (${(eA as any)?.message || eA})`)
      try {
        await tryOnce(false)  // B: 非串流
      } catch (eB) {
        if (provider === 'openai' && model !== FALLBACKS.openai) {
          appendDebug(`MODEL FALLBACK openai: ${model} → ${FALLBACKS.openai}`)
          setModel(FALLBACKS.openai)
          try { await tryOnce(false) } catch (eC) {
            appendDebug(`ALL FAIL: ${(eC as any)?.message || eC}`)
            setMessages(prev => {
              const last = prev[prev.length - 1]
              const head = prev.slice(0, -1)
              return [...head, { ...last, content: `【錯誤】${(eC as any)?.message || eC}` }]
            })
          }
        } else {
          appendDebug(`ALL FAIL: ${(eB as any)?.message || eB}`)
          setMessages(prev => {
            const last = prev[prev.length - 1]
            const head = prev.slice(0, -1)
            return [...head, { ...last, content: `【錯誤】${(eB as any)?.message || eB}` }]
          })
        }
      }
    } finally {
      setStreaming(false)
    }
  }, [appendDebug, messages, model, postUrl, provider, streaming, input])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold">無極入口 · SDK5 殼</div>
          <div className="text-xs text-neutral-500">MODELS_BASE={MODELS_BASE} · R5_BASE={R5_BASE}</div>
        </div>
      </header>

      {envWarn && (
        <div className="mx-auto max-w-3xl w-full px-4 py-2 bg-amber-50 text-amber-800 text-sm">{envWarn}</div>
      )}

      <section className="mx-auto max-w-3xl w-full px-4 py-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block mb-1 text-neutral-600">供應商</span>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={provider}
            onChange={(e) => {
              const p = e.target.value as Provider
              setProvider(p)
              setModel(DEFAULTS[p])
            }}
          >
            <option value="openai">openai</option>
            <option value="deepseek">deepseek</option>
            <option value="grok">grok</option>
            <option value="gemini">gemini</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block mb-1 text-neutral-600">模型</span>
          <input
            className="w-full border rounded-md px-3 py-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULTS[provider]}
          />
        </label>
      </section>

      <main className="mx-auto max-w-3xl w-full px-4 flex-1 pb-28">
        <ul className="space-y-3">
          {messages.filter(m => m.role !== 'system').map((m, i) => (
            <li key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-200 text-neutral-900'
              }`}>
                {m.content}
              </div>
            </li>
          ))}
        </ul>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex gap-2">
          <button
            onClick={doPing}
            className="px-3 py-2 text-xs rounded-md border bg-neutral-50 hover:bg-neutral-100"
            title="健康檢查：GET /_models/<provider>/chat?q=ping"
          >
            健康檢查 {pingOk === 'ok' ? '✅' : pingOk === 'fail' ? '❌' : '…'}
          </button>
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="輸入訊息…（中文白話）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            送出
          </button>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <details className="text-xs text-neutral-500">
            <summary>除錯紀錄 / Debug logs</summary>
            <pre className="whitespace-pre-wrap break-words max-h-40 overflow-auto border rounded-md p-2 bg-neutral-50">
{debug.join('\n')}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}
