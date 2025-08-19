import { NextRequest, NextResponse } from 'next/server'

const MAP: Record<string,{jobType:string, est:number, reply:string}> = {
  '富策體': { jobType:'fuceti_init', est:5, reply:'已讀取「富策體」規劃，預計約 {est} 分鐘完成，請按一鍵升級。' },
  '監察':   { jobType:'monitor_init', est:3, reply:'將建立監察最小可用版（延遲/錯誤/成本儀表）。約 {est} 分鐘。' },
  '日記':   { jobType:'journal_init', est:3, reply:'將建立日記首頁，後續可接 18:00 摘要。約 {est} 分鐘。' },
  '出版':   { jobType:'publish_init', est:2, reply:'將建立出版資訊模組骨架。約 {est} 分鐘。' },
  '版本':   { jobType:'changelog_init', est:1, reply:'將建立版本資訊頁（讀 CHANGELOG）。約 {est} 分鐘。' },
}

export async function POST(req: NextRequest){
  const { text='' } = await req.json().catch(()=>({}))
  const hit = Object.keys(MAP).find(k => text.includes(k))
  if(!hit) return NextResponse.json({ reply:'我看不出要啟動哪個模組，請告訴我：富策體 / 監察 / 日記 / 出版 / 版本。' })
  const m = MAP[hit]
  return NextResponse.json({ intent:'upgrade', jobType:m.jobType, estimate:m.est, reply:m.reply.replace('{est}', String(m.est)) })
}
