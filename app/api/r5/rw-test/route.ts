import { NextResponse } from "next/server";
export const runtime = "nodejs";

// 小工具
const j = (x:any)=>JSON.stringify(x);
const b64 = (s:string)=>Buffer.from(s,"utf8").toString("base64");
const nowIso = ()=>new Date().toISOString();

async function ghRW() {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO; // 形式：owner/name
  if (!token || !repo) return { ok:false, skipped:true, hint:"缺 GITHUB_TOKEN 或 GITHUB_REPO" };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // 讀
  const metaRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  const meta = await metaRes.json();
  const canRead = metaRes.ok && meta?.full_name === repo;

  // 寫（建 → 刪）
  const path = `ops/r5_rw_test_${Date.now()}.json`;
  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers,
    body: j({
      message: "r5 rw test: create",
      content: b64(j({ ts: nowIso(), by: "r5" })),
    }),
  });
  const putJson = await putRes.json();
  const createdSha = putJson?.content?.sha;
  const createdOk  = putRes.ok && !!createdSha;

  // 刪（若建成功）
  let delOk = false, delJson:any = null;
  if (createdOk) {
    const delRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "DELETE",
      headers,
      body: j({ message: "r5 rw test: cleanup", sha: createdSha }),
    });
    delJson = await delRes.json().catch(()=> ({}));
    delOk = delRes.ok;
  }

  return {
    ok: canRead && createdOk && delOk,
    canRead, createdOk, delOk,
    repo, path,
    detail: { metaStatus: metaRes.status, putStatus: putRes.status, delOk, delJson }
  };
}

async function vercelRW() {
  const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return { ok:false, skipped:true, hint:"缺 VERCEL_TOKEN 或 VERCEL_PROJECT_ID" };

  const h = { Authorization: `Bearer ${token}`, "Content-Type":"application/json" };

  // 讀：抓專案資訊
  const pRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, { headers: h });
  const pJson = await pRes.json();
  const canRead = pRes.ok && !!pJson?.id;

  // 寫：新增 env → 刪除
  const name = "R5_RW_TEST";
  const value = `ok-${Date.now()}`;
  const addRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
    method: "POST",
    headers: h,
    body: j({ key: name, value, target: ["production"] }),
  });
  const addJson = await addRes.json();
  const addOk = addRes.ok && !!addJson?.id;

  let delOk = false, delJson:any=null;
  if (addOk) {
    const delRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${addJson.id}`, {
      method: "DELETE", headers: h
    });
    delOk = delRes.ok; delJson = await delRes.json().catch(()=> ({}));
  }

  return {
    ok: canRead && addOk && delOk,
    canRead, addOk, delOk,
    detail: { pStatus: pRes.status, addStatus: addRes.status, delOk, delJson }
  };
}

async function supaRW() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok:false, skipped:true, hint:"缺 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" };

  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type":"application/json" };

  // 讀：抓 release_tags 1 筆
  const r1 = await fetch(`${url}/rest/v1/gov.release_tags?select=*&limit=1`, { headers: h });
  const canRead = r1.ok;

  // 寫：塞一筆 probe
  const payload = [{
    tag: `r5-rw-${Date.now()}`,
    kind: "probe",
    vercel_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    vercel_branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_BRANCH || null
  }];
  const r2 = await fetch(`${url}/rest/v1/gov.release_tags`, {
    method: "POST",
    headers: { ...h, Prefer: "return=representation" },
    body: j(payload),
  });
  const addJson = await r2.json().catch(()=> ({}));
  const addOk = r2.ok;

  return {
    ok: canRead && addOk,
    canRead, addOk,
    detail: { readStatus: r1.status, writeStatus: r2.status, row: addJson?.[0] ?? null }
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const who = (url.searchParams.get("who") || "all").toLowerCase();

  const out:any = { ts: nowIso(), who, results:{} };

  if (who === "all" || who === "github")  out.results.github  = await ghRW().catch(e=>({ ok:false, error:String(e) }));
  if (who === "all" || who === "vercel")  out.results.vercel  = await vercelRW().catch(e=>({ ok:false, error:String(e) }));
  if (who === "all" || who === "supabase") out.results.supabase= await supaRW().catch(e=>({ ok:false, error:String(e) }));

  // 總結
  const oks = Object.values(out.results).map((r:any)=>!!r?.ok);
  out.ok = oks.length>0 && oks.every(Boolean);

  return NextResponse.json(out, { status: 200 });
}
