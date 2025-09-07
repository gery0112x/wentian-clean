// pages/api/models/openai.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const WUJI_CURRENCY = (process.env.WUJI_CURRENCY || 'NTD').toUpperCase()
const FX = Number(process.env.WUJI_FX_USD_TWD || 32)

const supa = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

function estimateCostUSD(tokensIn = 0, tokensOut = 0, model = 'gpt-4o-mini') {
  const price: Record<string, { in: number; out: number }> = {
    'gpt-4o-mini': { in: 0.15, out: 0.60 },
  }
  const p = price[model] || price['gpt-4o-mini']
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out
}

async function safeLog(meta: any) {
  try {
    if (!supa) return
    await supa.from('ops.io_gate_logs').insert({
      route: '/models/openai',
      provider: 'OPENAI',
      model: meta?.model || 'gpt-4o-mini',
      tokens_in: meta?.usage?.input_tokens || 0,
      tokens_out: meta?.usage?.output_tokens || 0,
      usd_cost: meta?.usd_cost || 0,
      currency: WUJI_CURRENCY,
      cost_local: meta?.cost_local || 0,
      status: meta?.status || 'ok',
      request_id: meta?.request_id || null,
      meta
    })
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 允許用 GET 做診斷（你用瀏覽器就能看）
  if (req.method === 'GET') {
    const diag = {
      ok: true,
      mode: 'diagnostic',
      env: {
        SUPABASE_URL: !!SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
        OPENAI_API_KEY: !!OPENAI_API_KEY,
        WUJI_CURRENCY,
        FX
      }
    }
    return res.status(200).json(diag)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '只允許 POST（GET 為診斷模式）' })
  }

  // 環境檢查（缺什麼就明講）
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY')
  if (missing.length) {
    await safeLog({ status: 'error', why: 'env_missing', missing })
    return res.status(200).json({ ok: false, error: '環境變數缺少', missing })
  }

  try {
    const { messages = [], model = 'gpt-4o-mini' } = req.body || {}
    if (!Array.isArray(messages)) {
      return res.status(200).json({ ok: false, error: 'messages 需要陣列' })
    }

    const t0 = Date.now()
    const completion = await openai!.chat.completions.create({ model, messages })
    const reply = completion.choices?.[0]?.message?.content || ''
    const usage = {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? Math.max(20, Math.ceil(reply.length / 3)),
      total_tokens: completion.usage?.total_tokens ?? 0,
      ms: Date.now() - t0,
    }
    const usd_cost = estimateCostUSD(usage.input_tokens, usage.output_tokens, model)
    const cost_local = Math.round(usd_cost * FX * 100) / 100
    const request_id = completion.id || `openai_${Date.now()}`

    await safeLog({ status: 'ok', model, usage, usd_cost, cost_local, request_id })

    return res.status(200).json({
      ok: true,
      provider: 'OPENAI',
      model,
      reply,
      usage,
      currency: WUJI_CURRENCY,
      cost_local,
      request_id
    })
  } catch (e: any) {
    const msg = String(e?.message || e)
    await safeLog({ status: 'error', err: msg, model: req.body?.model })
    return res.status(200).json({ ok: false, error: msg })
  }
}
