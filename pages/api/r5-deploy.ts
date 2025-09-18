// pages/api/r5-deploy.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })

  const {
    GITHUB_TOKEN,
    VERCEL_TOKEN,
    VERCEL_PROJECT_ID,
    GITHUB_REPO,        // 你環境裡也有，像 "gery0112x/wentian-clean"
    NEXT_PUBLIC_R5_BASE // 例："/_r5"
  } = process.env

  // 取 repo 座標：優先用 GITHUB_REPO，否則預設你的倉庫
  const repoFull = (GITHUB_REPO || 'gery0112x/wentian-clean').trim()
  const [owner, repo] = repoFull.split('/')

  // 動態推算 R5_BASE：站域名 + 你的 NEXT_PUBLIC_R5_BASE（你已設 "/_r5"）
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'wentian-clean.vercel.app'
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const r5Base = `${proto}://${host}${(NEXT_PUBLIC_R5_BASE || '/_r5')}`.replace(/\/+$/, '/')

  try {
    if (!GITHUB_TOKEN) throw new Error('missing:GITHUB_TOKEN')
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) throw new Error('missing:VERCEL_TOKEN/PROJECT_ID')

    // 1) 觸發兩個 workflow（接管與驗收）
    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    }
    await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/r5-takeover.yml/dispatches`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify({ ref: 'main' })
    })
    await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/r5-smoke.yml/dispatches`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify({ ref: 'main' })
    })

    // 2) Promote 最新 READY 的 Preview 到 Production
    const list = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&state=READY&limit=1`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    ).then(r => r.json())

    const uid = list?.deployments?.[0]?.uid
    if (!uid) throw new Error('no_ready_preview')

    const promote = await fetch(`https://api.vercel.com/v13/deployments/${uid}/promote?force=true`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: '{}'
    }).then(r => r.json())

    // 3) 記錄發版（/_r5/release）
    const tag = `rel-${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}`
    await fetch(`${r5Base}release`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseline_tag: 'base-20250917-001', release_tag: tag, notes: { from: 'deploy-api' } })
    }).catch(()=>{})

    return res.status(200).json({ ok: true, promoted: uid, r5_release_tag: tag, vercel: promote })
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
