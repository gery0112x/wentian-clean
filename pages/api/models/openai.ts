import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

/** 中文：環境變數（英文名附中文）
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY：Supabase 服務端連線金鑰（只有後端用）
 * OPENAI_API_KEY：OpenAI 金鑰
 * WUJI_FX_USD_TWD：美元→台幣匯率（預設 32）
 * WUJI_CURRENCY：幣別（預設 NTD）
 */
const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 估價（中文）：非常粗略，只供展示
function estimateCostUSD(tokensIn = 0, tokensOut = 0, model = 'gpt-4o-mini') {
  // 單價（USD / 百萬 token）
  const priceTable: Record<string, { in: number; out: number }> = {
    'gpt-4o-mini': { in: 0.15, out: 0.60 },
  }
  const p = priceTable[model] || priceTable['gpt-4o-mini']
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: '只允許 POST' })

  const currency = (process.env.WUJI_CURRENCY || 'NTD').toUpperCase()
  const fx = Number(process.env.WUJI_FX_USD_TWD || 32)

  try {
    const { messages = [], model = 'gpt-4o-mini' } = req.body || {}
    if (!Array.isArray(messages)) return res.status(400).json({ ok: false, error: 'messages 需要陣列' })
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: '缺 OPENAI_API_KEY' })

    const start = Date.now()
    const completion = await openai.chat.completions.create({
      model,
      messages,
    })
    const reply = completion.choices?.[0]?.message?.content || ''
    // OpenAI 使用量（有些模型不回 tokens，這裡做保底）
    const usage = {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? Math.max(20, Math.ceil(reply.length / 3)),
      total_tokens: completion.usage?.total_tokens ?? 0,
      ms: Date.now() - start,
    }
    const usd = estimateCostUSD(usage.input_tokens, usage.output_tokens, model)
    const cost_local = Math.round(usd * fx * 100) / 100

    // 寫入審計（ops.io_gate_logs）
    const request_id = completion.id || `openai_${Date.now()}`
    await supa.from('ops.io_gate_logs').insert({
      route: '/models/openai',
      provider: 'OPENAI',
      model,
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      usd_cost: usd,
      currency,
      cost_local,
      status: 'ok',
      request_id,
      meta: { ms: usage.ms }
    })

    return res.status(200).json({
      ok: true,
      provider: 'OPENAI',
      model,
      reply,
      usage,
      currency,
      cost_local,
      request_id,
    })
  } catch (e: any) {
    const msg = String(e?.message || e)
    await supa.from('ops.io_gate_logs').insert({
      route: '/models/openai',
      provider: 'OPENAI',
      model: req.body?.model || 'gpt-4o-mini',
      status: 'error',
      currency: (process.env.WUJI_CURRENCY || 'NTD').toUpperCase(),
      meta: { err: msg }
    })
    return res.status(500).json({ ok: false, error: msg })
  }
}
