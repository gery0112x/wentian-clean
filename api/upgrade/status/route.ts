import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if(!jobId) return NextResponse.json({ error:'jobId required' }, { status:400 })

  const { data: job } = await sb.from('upgrade_jobs').select('*').eq('id', jobId).single()
  if(!job) return NextResponse.json({ error:'not found' }, { status:404 })

  // 簡易：先用時間推進；等 GitHub Action 合併後，直接把狀態改成 done
  // 你也可以補一支 /api/upgrade/sync 去問 GitHub run 狀態，這裡先用最簡版。
  return NextResponse.json({ status: job.status, progress: job.progress, log: job.log })
}
