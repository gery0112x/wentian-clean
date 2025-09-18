// pages/r5-deploy.tsx
import * as React from 'react'

export default function R5DeployPage() {
  const [msg, setMsg] = React.useState('')

  async function run() {
    setMsg('佈署中…')
    try {
      const r = await fetch('/api/r5-deploy', { method: 'POST' })
      const j = await r.json().catch(()=> ({}))
      if (r.ok) setMsg(`完成：promoted=${j?.promoted || 'OK'} · tag=${j?.r5_release_tag || '-'}`)
      else setMsg(`失敗：${j?.error || r.status}`)
    } catch (e:any) {
      setMsg(`失敗：${e?.message || e}`)
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0A0A0B',color:'#e5e7eb'}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{fontSize:24,marginBottom:12}}>無極 · 一鍵佈署</h1>
        <button onClick={run} style={{padding:'12px 18px',borderRadius:12,background:'#fff',color:'#000',fontWeight:600}}>
          一鍵佈署（接管→驗收→Promote→記錄）
        </button>
        <div style={{marginTop:12,opacity:.8,fontSize:14}}>{msg}</div>
        <div style={{marginTop:16,fontSize:12,opacity:.6}}>
          只用現有變數：GITHUB_TOKEN / VERCEL_TOKEN / VERCEL_PROJECT_ID / NEXT_PUBLIC_R5_BASE / GITHUB_REPO
        </div>
      </div>
    </div>
  )
}
