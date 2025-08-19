'use client'
import { useEffect, useMemo, useState } from 'react'

type UISettings = {
  cid: string
  model: 'deepseek-12b'|'deepseek-30b'|'gpt-4o'|'gemini'|'grok'
  style: 'gu-tech'|'plain'|'掌門令'|'工務札記'|'溫柔說'
  theme: 'dark'|'light'
  tone: 'neutral'|'brief'|'playful'|'strict'
  upgraded: boolean
  updated_at?: string
}

const ACCENT = '#00A3C4'
const DEFAULTS: UISettings = {
  cid: '', model: 'deepseek-30b', style: 'gu-tech', theme: 'dark', tone: 'neutral', upgraded: false
}

function uid(){ return crypto.randomUUID() }
function readLocal(): UISettings {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('wj_ui')||'{}')) } }
  catch { return DEFAULTS }
}
function writeLocal(s: UISettings){ localStorage.setItem('wj_ui', JSON.stringify(s)) }

export default function Entry(){
  const [ui, setUI] = useState<UISettings>(DEFAULTS)
  const [cloud, setCloud] = useState<'idle'|'sync'|'ok'|'err'>('idle')
  const [now, setNow] = useState('--:--')

  // 啟動：本地讀 → 取/合併雲端
  useEffect(()=>{
    const base = readLocal()
    const cid = base.cid || uid()
    const merged = { ...base, cid }
    writeLocal(merged); setUI(merged)

    fetch(`/api/ui-settings?cid=${cid}`).then(async r=>{
      if(!r.ok) throw new Error()
      const remote = await r.json()
      if(remote?.updated_at){
        const localNewer = merged.updated_at && new Date(merged.updated_at) > new Date(remote.updated_at)
        const winner = localNewer ? merged : { ...merged, ...remote }
        setUI(winner); writeLocal(winner)
      }
      setCloud('ok')
    }).catch(()=>setCloud('err'))
  },[])

  // 時鐘
  useEffect(()=>{
    const id = setInterval(()=>{
      const d = new Date()
      const hh = String(d.getHours()).padStart(2,'0')
      const mm = String(d.getMinutes()).padStart(2,'0')
      setNow(`${hh}:${mm}`)
    }, 1000)
    return ()=>clearInterval(id)
  },[])

  // 即時保存：先本地，0.8 秒後寫雲
  function update(p: Partial<UISettings>){
    const next = { ...ui, ...p, updated_at: new Date().toISOString() }
    setUI(next); writeLocal(next); setCloud('sync')
    clearTimeout((window as any).__wj__)
    ;(window as any).__wj__ = setTimeout(async()=>{
      try{
        const r = await fetch('/api/ui-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(next) })
        if(!r.ok) throw new Error()
        setCloud('ok')
      }catch{ setCloud('err') }
    }, 800)
  }

  const badge = useMemo(()=>{
    if(cloud==='sync') return 'Local ✓  Cloud …'
    if(cloud==='ok')   return 'Local ✓  Cloud ✓'
    if(cloud==='err')  return 'Local ✓  Cloud ×'
    return '記憶初始化…'
  },[cloud])

  return (
    <div className={`min-h-screen ${ui.theme==='dark'?'bg-zinc-950 text-zinc-200':'bg-zinc-50 text-zinc-900'}`} style={{ ['--accent' as any]: ACCENT }}>
      {/* 頂欄 */}
      <div className="w-full px-4 py-2 flex items-center justify-between border-b border-zinc-800/60 sticky top-0">
        <div className="font-semibold">無極•元始 00-01</div>
        <div className="text-sm opacity-80">{now} · {badge}</div>
        <div className="flex items-center gap-2">
          <button onClick={()=>update({ upgraded: !ui.upgraded })} className="px-3 py-1 rounded-xl border border-zinc-700 hover:border-[var(--accent)]">
            一鍵升級 {ui.upgraded?'ON':'OFF'}
          </button>
          <button className="px-3 py-1 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]">保存</button>
        </div>
      </div>

      {/* 版面：左側快速、右側對話 */}
      <div className="grid grid-cols-12 gap-4 p-4">
        <aside className="col-span-12 md:col-span-3 space-y-3 order-2 md:order-1">
          <Section title="快捷切換">
            <Row label="模型">
              <Select value={ui.model} onChange={e=>update({model: e.target.value as UISettings['model']})}
                options={[['deepseek-12b','12B'],['deepseek-30b','30B'],['gpt-4o','4o'],['gemini','Gemini'],['grok','Grok']]} />
            </Row>
            <Row label="語風">
              <Select value={ui.tone} onChange={e=>update({tone: e.target.value as UISettings['tone']})}
                options={[['neutral','一般'],['brief','精簡'],['playful','親切'],['strict','嚴謹']]} />
            </Row>
            <Row label="風格">
              <Select value={ui.style} onChange={e=>update({style: e.target.value as UISettings['style']})}
                options={[['gu-tech','gu-tech'],['plain','plain'],['掌門令','掌門令'],['工務札記','工務札記'],['溫柔說','溫柔說']]} />
            </Row>
            <Row label="主題">
              <Select value={ui.theme} onChange={e=>update({theme: e.target.value as UISettings['theme']})}
                options={[['dark','深色'],['light','淺色']]} />
            </Row>
          </Section>

          <Section title="功能">
            <ul className="text-sm leading-7 opacity-90">
              <li>專案管理</li><li>富策體</li><li>監察</li><li>出版資訊</li><li>平台設定</li>
            </ul>
          </Section>
        </aside>

        <main className="col-span-12 md:col-span-9 space-y-4 order-1 md:order-2">
          <div className="rounded-2xl border border-zinc-800/60 p-4">
            <div className="text-sm mb-2 opacity-80">模型：{ui.model} ｜ 語風：{ui.tone} ｜ 風格：{ui.style}</div>
            <textarea className="w-full h-32 rounded-xl bg-transparent border border-zinc-800/60 p-3 outline-none focus:border-[var(--accent)]" placeholder="在這裡開始對話…" />
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-[var(--accent)]">清除</button>
              <button className="px-4 py-2 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]">送出</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function Section({title, children}:{title:string, children:any}){
  return <div className="rounded-2xl border border-zinc-800/60 p-3">
    <div className="text-xs uppercase tracking-widest mb-2 opacity-70">{title}</div>{children}
  </div>
}
function Row({label, children}:{label:string, children:any}){
  return <div className="flex items-center gap-3 my-2">
    <div className="w-14 text-sm opacity-80">{label}</div><div className="flex-1">{children}</div>
  </div>
}
function Select({value,onChange,options}:{value:string,onChange:any,options:[string,string][]}){
  return <select value={value} onChange={onChange}
    className="w-full bg-transparent border border-zinc-800/60 rounded-xl px-3 py-2 outline-none focus:border-[var(--accent)]">
    {options.map(([v,l])=> <option key={v} value={v} className="bg-zinc-900">{l}</option>)}
  </select>
}
