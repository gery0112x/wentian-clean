import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest){
  const { jobType = 'fuceti_init', plan = {} } = await req.json().catch(()=>({}))
  // 建 job
  const { data: job, error } = await sb.from('upgrade_jobs').insert({
    job_type: jobType, plan, status: 'queued', progress: 0, log: ['queued']
  }).select().single()
  if(error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 觸發 GitHub Workflow
  const repo = process.env.GITHUB_REPO!
  const token = process.env.GITHUB_TOKEN!
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/upgrader.yml/dispatches`,{
    method:'POST',
    headers:{ 'Authorization':`Bearer ${token}`, 'Accept':'application/vnd.github+json' },
    body: JSON.stringify({ ref: process.env.GITHUB_BRANCH || 'main', inputs: { jobType, plan: JSON.stringify(plan) } })
  })

  // 更新狀態（先標 running，前端就能顯示進度條）
  await sb.from('upgrade_jobs').update({ status:'running', progress:10, log:[...job.log,'workflow_dispatched'] }).eq('id', job.id)
  return NextResponse.json({ jobId: job.id })
}
