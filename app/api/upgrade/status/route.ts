import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest){
  const id = new URL(req.url).searchParams.get('jobId')
  if(!id) return NextResponse.json({ error:'jobId required' }, { status:400 })
  const { data } = await sb.from('upgrade_jobs').select('*').eq('id', id).single()
  if(!data) return NextResponse.json({ error:'not found' }, { status:404 })
  return NextResponse.json({ status:data.status, progress:data.progress, log:data.log })
}
