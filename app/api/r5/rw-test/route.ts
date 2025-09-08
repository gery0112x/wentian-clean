// app/api/r5/rw-test/route.ts  —— v3（修正 Supabase 406）
import { NextResponse } from "next/server";
export const runtime = "nodejs";
const j = (x:any)=>JSON.stringify(x);
const b64 = (s:string)=>Buffer.from(s,"utf8").toString("base64");
const nowIso = ()=>new Date().toISOString();

/* ---------- GitHub ---------- */
async function ghRW() {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO; // owner/name
  if (!token || !repo) return { ok:false, skipped:true, hint:"缺 GITHUB_TOKEN 或 GITHUB_REPO" };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const metaRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  const meta = await metaRes.json().catch(()=> ({}));
  const canRead = metaRes.ok && meta?.full_name === repo;

  const path = `ops/r5_rw_test_${Date.now()}.json`;
  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers,
    body: j({ message: "r5 rw test: create", content: b64(j({ ts: nowIso(), by: "r5" })) }),
  });
  const putJson = await putRes.json().catch(()=> ({}));
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

/* ---------- Vercel ---------- */
type VercelEnv = { id:string; key:string; target:string[] };
async function vercelRW() {
  const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || "";
  if (!token || !projectId) return { ok:false, skipped:true, hint:"缺 VERCEL_TOKEN 或 VERCEL_PROJECT_ID" };

  const h = { Authorization: `Bearer ${token}`, "Content-Type":"application/json" };
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const key = "R5_RW_TEST";
  const value = `ok-${Date.now()}`;

  const pRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}${qs}`, { headers: h });
  const pJson = await pRes.json().catch(()=> ({}));
  const canRead = pRes.ok && !!pJson?.id;

  const listAll = async ():Promise<VercelEnv[]> => {
    const r = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${qs}`, { headers: h });
    const js = await r.json().catch(()=> ({}));
    return (js?.envs || []) as VercelEnv[];
  };
  const delById = async (id:string) => {
    const r = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${id}${qs}`, { method:"DELETE", headers: h });
    return r.status;
  };

  const delSteps:any[] = [];
  const before = await listAll();
  const dupIds = before.filter(e => e?.key === key).map(e => e.id);
  for (const id of dupIds) delSteps.push({ by:"pre-clean", id, status: await delById(id) });

  const addRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env${qs}`, {
    method: "POST",
    headers: h,
    body: j({ key, value, target: ["production"], type: "encrypted" }),
  });
  const addJson:any = await addRes.json().catch(()=> ({}));
  const createdId: string | undefined = addJson?.id || addJson?.created?.id;
  const addOk = addRes.status === 201 && !!createdId;

  let delOk = false;
  if (addOk && createdId) {
    const st = await delById(createdId);
    delSteps.push({ by:"create-id", id: createdId, status: st });
    delOk = st >= 200 && st < 300;
  }
  if (!delOk) {
    const after = await listAll();
    for (const id of after.filter(e=>e?.key===key).map(e=>e.id)) {
      const st = await delById(id);
      delSteps.push({ by:"list-key", id, status: st });
      if (st >= 200 && st < 300) delOk = true;
    }
  }

  return {
    ok: canRead && addOk && delOk,
    canRead, addOk, delOk,
    detail: { pStatus: pRes.status, addStatus: addRes.status, createdId, addJson, preCleanCount: dupIds.length, delSteps, teamIdUsed: !!teamId }
  };
}

/* ---------- Supabase（修 406：補 Accept 並正確指定 schema） ---------- */
async function supaRW() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_SCHEMA || "gov";
  const table = "release_tags";
  if (!url || !key) return { ok:false, skipped:true, hint:"缺 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" };

  const base = `${url}/rest/v1/${table}`;
  const hBase = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Profile": schema,
    "Content-Profile": schema,
  } as Record<string,string>;

  // read
  const r1 = await fetch(`${base}?select=*&limit=1`, { headers: hBase });
  const canRead = r1.ok;

  // write（留一筆審計）
  const payload = [{
    tag: `r5-rw-${Date.now()}`,
    kind: "probe",
    vercel_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    vercel_branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_BRANCH || null
  }];

  const r2 = await fetch(base, {
    method: "POST",
    headers: { ...hBase, Prefer: "return=representation" },
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

/* ---------- handler ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const who = (url.searchParams.get("who") || "all").toLowerCase();
  const out:any = { ts: nowIso(), who, results:{} };

  if (who === "all" || who === "github")   out.results.github   = await ghRW().catch(e=>({ ok:false, error:String(e) }));
  if (who === "all" || who === "vercel")   out.results.vercel   = await vercelRW().catch(e=>({ ok:false, error:String(e) }));
  if (who === "all" || who === "supabase") out.results.supabase = await supaRW().catch(e=>({ ok:false, error:String(e) }));

  const oks = Object.values(out.results).map((r:any)=>!!r?.ok);
  out.ok = oks.length>0 && oks.every(Boolean);
  return NextResponse.json(out, { status: 200 });
}
