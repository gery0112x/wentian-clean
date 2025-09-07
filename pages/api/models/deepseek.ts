import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** 中文：
 * 先上線空殼（會寫審計、回 501 尚未啟用）
 * 真正串接時，再補供應商 SDK 與呼叫
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: '只允許 POST' })
  const model = (req.body?.model || 'deepseek-chat')
  await supa.from('ops.io_gate_logs').insert({
    route: '/models/deepseek',
    provider: 'DEEPSEEK',
    model,
    status: 'error',
    meta: { note: '尚未啟用供應商串接' }
  })
  return res.status(501).json({ ok: false, error: 'DEEPSEEK 尚未啟用，之後補上實作' })
}
