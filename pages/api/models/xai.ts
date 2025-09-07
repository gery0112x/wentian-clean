import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: '只允許 POST' })
  const model = (req.body?.model || 'grok-beta')
  await supa.from('ops.io_gate_logs').insert({
    route: '/models/xai',
    provider: 'XAI',
    model,
    status: 'error',
    meta: { note: '尚未啟用供應商串接' }
  })
  return res.status(501).json({ ok: false, error: 'XAI(Grok) 尚未啟用，之後補上實作' })
}
