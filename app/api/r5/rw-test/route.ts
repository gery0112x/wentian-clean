// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";

// 小工具
const env = (k: string) => process.env[k]?.trim() || null;
const J = (o: any, s = 200) =>
  new NextResponse(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// ---------- Vercel（修正版 v2） ----------
async function vercelRW() {
  const projectId = env("VERCEL_PROJECT_ID"); // prj_...
  const token = env("VERCEL_TOKEN");          // 個人 Access Token
  const teamId = env("VERCEL_TEAM_ID");       // 若在 Team 底下，填 team_xxx（選填）
  const typeDefault = (env("R5_VERCEL_ENV_TYPE") || "sensitive") as
    | "plain"
    | "encrypted"
    | "sensitive";
  const targets =
    (env("R5_VERCEL_TARGETS") || "production,preview")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as Array<"production" | "preview" | "development">;

  const missing = [];
  if (!projectId) missing.push("VERCEL_PROJECT_ID");
  if (!token) missing.push("VERCEL_TOKEN");
  if (missing.length) {
    return {
      ok: false,
      impl: "vercel-v2",
      guide: [
        `缺少環境變數: ${missing.join(", ")}`,
        "如為團隊專案，請加 VERCEL_TEAM_ID 並重佈署",
      ],
      results: { vercel: { ok: false } },
    };
  }

  const base = "https://api.vercel.com";
  const qs = new URLSearchParams({ upsert: "true" });
  if (teamId) qs.set("teamId", teamId);

  const headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  // 1) 讀專案（驗證 token 與 project）
  const pURL = `${base}/v10/projects/${encodeURIComponent(projectId)}${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const pRes = await fetch(pURL, { headers });
  const pStatus = pRes.status;

  // 2) 寫環境變數（重點：必帶 type + target；預設用 sensitive）
  const eURL = `${base}/v10/projects/${encodeURIComponent(projectId)}/env${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const body = {
    key: "R5_RW_TEST",
    value: `ok@${new Date().toISOString()}`,
    type: typeDefault,              // 預設 sensitive（政策更符合）
    target: targets,                // 必帶：production/preview/development
    comment: "r5 rw-test",
  };

  const aRes = await fetch(eURL, { method: "POST", headers, body: JSON.stringify(body) });
  const addStatus = aRes.status;
  let addBody: any = null;
  try { addBody = await aRes.json(); } catch {}

  // 針對 400 再提示幾種常見誤因
  const hints: string[] = [];
  if (addStatus === 400) {
    hints.push(
      "400 多為請求格式或政策不符：",
      "1) team 有『敏感環境變數政策』→ 請用 type: 'sensitive'",
      "2) 缺 target → 至少帶 ['production','preview']",
      "3) 在 Team 專案卻沒帶 teamId → 設 VERCEL_TEAM_ID",
      "4) key 名稱不合法（只能 A-Z0-9_，且不能以 VERCEL_ 開頭）"
    );
  }

  return {
    ok: pStatus === 200 && (addStatus === 201 || addStatus === 200),
    impl: "vercel-v2",
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

// ---------- GitHub（原邏輯保留） ----------
async function githubRW() {
  const repo = env("GITHUB_REPO"); // 例：user/repo
  const branch = env("GITHUB_BRANCH") || "main";
  const token = env("GITHUB_TOKEN");
  const [owner, name] = (repo || "").split("/");
  const miss = [];
  if (!owner || !name) miss.push("GITHUB_REPO");
  if (!token) miss.push("GITHUB_TOKEN");
  if (miss.length) {
    return { ok: false, impl: "github", guide: [`缺環境變數: ${miss.join(", ")}`], results: { github: { ok: false } } };
  }
  const ts = Date.now();
  const path = `ops/r5_rw_test_${ts}.json`;
  const content = Buffer.from(JSON.stringify({ ts, ok: true }, null, 2)).toString("base64");
  const putUrl = `https://api.github.com/repos/${owner}/${name}/contents/${encodeURIComponent(path)}`;
  const h = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "r5-rw-test",
    Accept: "application/vnd.github+json",
  };
  const put = await fetch(putUrl, { method: "PUT", headers: h, body: JSON.stringify({ message: `r5 rw-test ${ts}`, content, branch }) });
  const ok = put.status === 201 || put.status === 200;
  const putBody = await put.json().catch(() => ({} as any));
  let commitBody: any = null;
  if (putBody?.commit?.sha) {
    const cUrl = `https://api.github.com/repos/${owner}/${name}/commits/${putBody.commit.sha}`;
    const c = await fetch(cUrl, { headers: h });
    commitBody = await c.json().catch(() => ({} as any));
  }
  return { ok, impl: "github", results: { github: { ok, path, commit: commitBody } } };
}

// ---------- Supabase（原邏輯保留） ----------
async function supabaseRW() {
  const url = env("SUPABASE_URL");
  const svc = env("SUPABASE_SERVICE_ROLE_KEY");
  const schema = env("SUPABASE_SCHEMA") || "gov";
  const table = `${schema}.release_tags`;
  const miss = [];
  if (!url) miss.push("SUPABASE_URL");
  if (!svc) miss.push("SUPABASE_SERVICE_ROLE_KEY");
  if (miss.length) {
    return { ok: false, impl: "supabase", guide: [`缺環境變數: ${miss.join(", ")}`], results: { supabase: { ok: false } } };
  }
  const r1 = await fetch(`${url}/rest/v1/${table}?id=eq.1&select=id`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` } });
  const readStatus = r1.status;
  const readBody = await r1.json().catch(() => []);
  const payload = { kind: process.env.R5_TEST_RELEASE_KIND || "baseline", tag: `r5_${Date.now()}` };
  const r2 = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const writeStatus = r2.status;
  const writeBody = await r2.json().catch(() => []);
  return {
    ok: readStatus === 200 && (writeStatus === 201 || writeStatus === 200),
    impl: "supabase",
    results: { supabase: { ok: writeStatus === 201 || writeStatus === 200, canRead: readStatus === 200, addOK: writeStatus === 201 || writeStatus === 200, detail: { readStatus, readBody, writeStatus, writeBody } } },
  };
}

// ---------- 路由入口 ----------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const who = (searchParams.get("who") || "").toLowerCase();
  const ts = new Date().toISOString();

  if (who === "vercel") return J({ ts, who: "vercel", ...(await vercelRW()) });
  if (who === "github") return J({ ts, who: "github", ...(await githubRW()) });
  if (who === "supabase") return J({ ts, who: "supabase", ...(await supabaseRW()) });

  return J({
    ts,
    ok: false,
    guide: [
      "用法：/api/r5/rw-test?who=vercel|github|supabase",
      "vercel：讀專案 + 新增環境變數（upsert=true，type 預設 sensitive）",
      "github：建立 ops/r5_rw_test_<ts>.json 並回讀 commit",
      "supabase：讀 gov.release_tags id=1 並插入一筆",
    ],
  }, 400);
}
