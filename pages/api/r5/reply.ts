import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const job_id = (req.query.job_id || req.body?.job_id) as string
  if (!job_id) return res.status(400).json({ ok: false, error: '缺 job_id' })
  const { data, error } = await supa.from('ops.io_results').select('*').eq('job_id', job_id).maybeSingle()
  if (error) return res.status(500).json({ ok: false, error: error.message })
  if (!data) return res.status(404).json({ ok: false, error: '尚無結果' })
  return res.status(200).json({ ok: true, job_id, result: data })
}
