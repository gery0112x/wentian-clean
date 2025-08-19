import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\\s+/i, '')
  if (token !== process.env.UPGRADER_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { jobId, status = 'done', progress = 100 } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  await sb.from('upgrade_jobs').update({ status, progress, log: ['notified_done'] }).eq('id', jobId)
  return NextResponse.json({ ok: true })
}
