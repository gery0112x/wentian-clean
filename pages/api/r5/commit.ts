import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** 中文：
 * 把結果寫入 io_results；並把 io_requests.status 更新為 done/failed
 * 請求格式：
 * { job_id, ok:true/false, output_tokens?, usd_cost?, cost_local?, currency?, reply_json?, meta? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: '只允許 POST' })
  try {
    const { job_id, ok = true, output_tokens = 0, usd_cost = 0, cost_local = 0, currency = 'NTD', reply_json = {}, meta = {} } = req.body || {}
    if (!job_id) return res.status(400).json({ ok: false, error: '缺 job_id' })

    const status = ok ? 'ok' : 'error'
    await supa.from('ops.io_results').insert({
      job_id, output_tokens, usd_cost, cost_local, currency, status, reply_json, meta
    })
    await supa.from('ops.io_requests').update({ status: ok ? 'done' : 'failed' }).eq('job_id', job_id)

    return res.status(200).json({ ok: true, job_id, status: ok ? 'done' : 'failed' })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
