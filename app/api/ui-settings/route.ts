import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url)
  const cid = searchParams.get('cid') || cookies().get('wj_cid')?.value
  if(!cid) return NextResponse.json({}, { status: 200 })
  const { data } = await supabase.from('ui_settings').select('*').eq('cid', cid).maybeSingle()
  return NextResponse.json(data || {})
}

export async function POST(req: NextRequest){
  const body = await req.json()
  const cid = body?.cid
  if(!cid) return NextResponse.json({ error:'cid required' }, { status: 400 })
  body.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('ui_settings')
    .upsert(body, { onConflict: 'cid' })
    .select()
    .maybeSingle()
  if(error) return NextResponse.json({ error: error.message }, { status: 500 })
  cookies().set('wj_cid', cid, { httpOnly: false, maxAge: 60*60*24*365*5 })
  return NextResponse.json(data)
}
