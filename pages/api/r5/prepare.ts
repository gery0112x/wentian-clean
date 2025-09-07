import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: '只允許 POST' })
  try {
    const job_id = randomUUID()
    const { route = '/r5/prepare', source = 'ui', provider = null, model = null, meta = {} } = req.body || {}
    await supa.from('ops.io_requests').insert({
      job_id, source, route, provider, model, status: 'queued', meta
    })
    return res.status(200).json({ ok: true, job_id, status: 'queued' })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
