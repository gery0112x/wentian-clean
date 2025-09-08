// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";

const getEnv = (k: string) => process.env[k]?.trim() || null;
const j = (o: unknown, s = 200) =>
  new NextResponse(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/** ---------- Vercel RW Test ---------- */
async function vercelRW() {
  const projectId = getEnv("VERCEL_PROJECT_ID"); // e.g. prj_xxx
  const token = getEnv("VERCEL_TOKEN");          // Personal Access Token
  const teamId = getEnv("VERCEL_TEAM_ID");       // team_xxx (optional)

  // 安全：明確型別，避免 never[]
  const missing: string[] = [];
  if (!projectId) missing.push("VERCEL_PROJECT_ID");
  if (!token) missing.push("VERCEL_TOKEN");
  if (missing.length) {
    return {
      ok: false,
      results: { vercel: { ok: false } },
      guide: [
        `缺少環境變數：${missing.join(", ")}`,
        "若專案屬於 Team，請加 VERCEL_TEAM_ID 後重佈署",
      ],
    };
  }

  const base = "https://api.vercel.com";
  const qs = new URLSearchParams({ upsert: "true" });
  if (teamId) qs.set("teamId", teamId);

  const headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  // 1) 讀 Project（驗證權限/ID）
  const pURL = `${base}/v10/projects/${encodeURIComponent(projectId)}${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const pRes = await fetch(pURL, { headers });
  const pStatus = pRes.status;

  // 2) 寫環境變數（一定帶 type + target）
  const eURL = `${base}/v10/projects/${encodeURIComponent(projectId)}/env${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const body = {
    key: "R5_RW_TEST",
    value: `ok@${new Date().toISOString()}`,
    // 官方目前接受 "plain" | "encrypted" | "system"
    type: "encrypted",
    // 目標環境至少帶一個；一般帶 production+preview
    target: ["production", "preview"] as const,
    comment: "r5 rw-test",
  };
  const aRes = await fetch(eURL, { method: "POST", headers, body: JSON.stringify(body) });
  const addStatus = aRes.status;
  let addBody: unknown = null;
  try { addBody = await aRes.json(); } catch { addBody = null; }

  const hints: string[] = [];
  if (addStatus === 400) {
    hints.push(
      "400 通常是請求格式或政策檢查：",
      "1) 一定要帶 type（改成 encrypted 已處理）",
      "2) 一定要帶 target（已帶 production, preview）",
      "3) Team 專案需帶 teamId（請設定 VERCEL_TEAM_ID）",
      "4) key 只能用 A-Z0-9_，且不要以 VERCEL_ 開頭"
    );
  }

  return {
    ok: pStatus === 200 && (addStatus === 201 || addStatus === 200),
    results: {
      vercel: {
        ok: addStatus === 201 || addStatus === 200,
        canRead: pStatus === 200,
        addOK: addStatus === 201 || addStatus === 200,
        delOK: false,
        detail: { pStatus, addStatus, addBody, hints },
      },
    },
  };
}

/** ---------- GitHub RW Test ---------- */
async function githubRW() {
  const repo = getEnv("GITHUB_REPO"); // e.g. user/repo
  const branch = getEnv("GITHUB_BRANCH") || "main";
  const token = getEnv("GITHUB_TOKEN");

  const missing: string[] = [];
  if (!repo) missing.push("GITHUB_REPO");
  if (!token) missing.push("GITHUB_TOKEN");
  if (missing.length) {
    return { ok: false, results: { github: { ok: false } }, guide: [`缺環境變數：${missing.join(", ")}`] };
  }

  const [owner, name] = repo.split("/");
  const ts = Date.now();
  const path = `ops/r5_rw_test_${ts}.json`;
  const content = Buffer.from(JSON.stringify({ ts, ok: true }, null, 2)).toString("base64");
  const url = `https://api.github.com/repos/${owner}/${name}/contents/${encodeURIComponent(path)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "r5-rw-test",
    Accept: "application/vnd.github+json",
  };
  const put = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ message: `r5 rw-test ${ts}`, content, branch }) });
  const ok = put.status === 201 || put.status === 200;
  const putBody = await put.json().catch(() => ({} as any));
  return { ok, results: { github: { ok, path, putBody } } };
}

/** ---------- Supabase RW Test ---------- */
async function supabaseRW() {
  const url = getEnv("SUPABASE_URL");
  const svc = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const schema = getEnv("SUPABASE_SCHEMA") || "gov";
  const table = `${schema}.release_tags`;

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!svc) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    return { ok: false, results: { supabase: { ok: false } }, guide: [`缺環境變數：${missing.join(", ")}`] };
  }

  const r1 = await fetch(`${url}/rest/v1/${table}?id=eq.1&select=id`, {
    headers: { apikey: svc, Authorization: `Bearer ${svc}` },
  });
  const readStatus = r1.status;
  const readBody = await r1.json().catch(() => []);

  const payload = { kind: process.env.R5_TEST_RELEASE_KIND || "baseline", tag: `r5_${Date.now()}` };
  const r2 = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: svc,
      Authorization: `Bearer ${svc}`,
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const writeStatus = r2.status;
  const writeBody = await r2.json().catch(() => []);

  return {
    ok: readStatus === 200 && (writeStatus === 201 || writeStatus === 200),
    results: {
      supabase: {
        ok: writeStatus === 201 || writeStatus === 200,
        canRead: readStatus === 200,
        addOK: writeStatus === 201 || writeStatus === 200,
        detail: { readStatus, readBody, writeStatus, writeBody },
      },
    },
  };
}

/** ---------- Route ---------- */
export async function GET(req: NextRequest) {
  const who = new URL(req.url).searchParams.get("who")?.toLowerCase() || "";
  const ts = new Date().toISOString();

  if (who === "vercel") return j({ ts, who: "vercel", ...(await vercelRW()) });
  if (who === "github") return j({ ts, who: "github", ...(await githubRW()) });
  if (who === "supabase") return j({ ts, who: "supabase", ...(await supabaseRW()) });

  return j({
    ts,
    ok: false,
    guide: [
      "用法：/api/r5/rw-test?who=vercel|github|supabase",
      "vercel：讀 project + 新增環境變數（upsert=true, type=encrypted, target=[production,preview]）",
      "github：ops/ 新增 r5_rw_test_<ts>.json",
      "supabase：gov.release_tags 讀 id=1 + insert 1 筆",
    ],
  }, 400);
}
