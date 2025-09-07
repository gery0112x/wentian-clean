import { NextResponse } from "next/server";
export const runtime = "nodejs";

// utils
const j = (x:any)=>JSON.stringify(x);
const b64 = (s:string)=>Buffer.from(s,"utf8").toString("base64");
const nowIso = ()=>new Date().toISOString();

// ---------- GitHub ----------
async function ghRW() {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO; // owner/name
  if (!token || !repo) return { ok:false, skipped:true, hint:"缺 GITHUB_TOKEN 或 GITHUB_REPO" };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // read
  const metaRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  const meta = await metaRes.json();
  const canRead = metaRes.ok && meta?.full_name === repo;

  // write (create -> delete)
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

// ---------- Vercel ----------
async function vercelRW() {
  const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || ""; // 可選
  if (!token || !projectId) return { ok:false, skipped:true, hint:"缺 VERCEL_TOKEN 或 VERCEL_PROJECT_ID" };

  const h = { Authorization: `Bearer ${token}`, "Content-Type":"application/json" };
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  // read project
  const pRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}${qs}`, { headers: h });
  const pJson = await pRes.json().catch(()=> ({}));
  const canRead = pRes.ok && !!pJson?.id;

  // write env
  const key = "R5_RW_TEST";
  const value = `ok-${Date.now()}`;
  const addRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env${qs}`, {
    method: "POST",
    headers: h,
    body: j({ key, value, target: ["production"], type: "encrypted" }),
  });
  const addJson = await addRes.json().catch(()=> ({}));
  const addOk = addRes.status === 201 && !!addJson?.id;

  // delete (雙保險)
  let delOk = false;
  const delSteps:any[] = [];

  // 1) 先嘗試用 create 回傳的 id 刪
  if (addOk && addJson?.id) {
    const del1 = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${addJson.id}${qs}`, {
      method: "DELETE", headers: h
    });
    delSteps.push({ by:"create-id", status: del1.status });
    if (del1.ok) delOk = true;
  }

  // 2) 若失敗，再列出全部 env，用 key=R5_RW_TEST 全刪
  if (!delOk) {
    const list = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${qs}`, { headers: h });
    const listJson = await list.json().catch(()=> ({}));
    const envs: any[] = listJson?.envs || [];
    const targets = envs.filter(e => e?.key === key).map(e => e.id).filter(Boolean);

    for (const id of targets) {
      const del2 = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${id}${qs}`, {
        method: "DELETE", headers: h
      });
      delSteps.push({ by:"list-key", id, status: del2.status });
      if (del2.ok) delOk = true;
    }
  }

  return {
    ok: canRead && addOk && delOk,
    canRead, addOk, delOk,
    detail: { pStatus: pRes.status, addStatus: addRes.status, delSteps, teamIdUsed: !!teamId }
  };
}

// ---------- Supabase ----------
async function supaRW() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok:false, skipped:true, hint:"缺 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" };

  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type":"application/json" };

  // read
  const r1 = await fetch(`${url}/rest/v1/gov.release_tags?select=*&limit=1`, { headers: h });
  const canRead = r1.ok;

  // write (keep for audit)
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

  const oks = Object.values(out.results).map((r:any)=>!!r?.ok);
  out.ok = oks.length>0 && oks.every(Boolean);

  return NextResponse.json(out, { status: 200 });
}
