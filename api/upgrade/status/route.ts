import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  const { data: job, error } = await sb.from('upgrade_jobs').select('*').eq('id', jobId).single()
  if (error || !job) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ status: job.status, progress: job.progress, log: job.log })
}
