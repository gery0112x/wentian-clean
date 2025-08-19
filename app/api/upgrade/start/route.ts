import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest){
  const { jobType='fuceti_init', plan={} } = await req.json().catch(()=>({}))
  const { data: job, error } = await sb.from('upgrade_jobs').insert({
    job_type: jobType, plan, status:'running', progress:10, log:['start']
  }).select().single()
  if(error) return NextResponse.json({ error: error.message }, { status: 500 })

  const payload = {
    ref: process.env.GITHUB_BRANCH || 'main',
    inputs: {
      jobType, plan: JSON.stringify(plan),
      jobId: job.id, notifyURL: `${new URL(req.url).origin}/api/upgrade/notify`,
      notifyToken: process.env.UPGRADER_WEBHOOK_TOKEN!, branch: process.env.GITHUB_BRANCH || 'main'
    }
  }
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/upgrader.yml/dispatches`,{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept':'application/vnd.github+json'
    },
    body: JSON.stringify(payload)
  })
  if(!r.ok){
    await sb.from('upgrade_jobs').update({ status:'failed', log:['dispatch_failed'] }).eq('id', job.id)
    return NextResponse.json({ error:'workflow dispatch failed' }, { status:500 })
  }
  return NextResponse.json({ jobId: job.id })
}
