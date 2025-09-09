// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";

const envGet = (k: string): string | null => (process.env[k]?.trim() ?? null);
const J = (o: unknown, s = 200) =>
  new NextResponse(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/** ---------- Vercel RW Test (fix: types + team + required fields) ---------- */
async function vercelRW() {
  const projectId = envGet("VERCEL_PROJECT_ID"); // prj_xxx
  const token = envGet("VERCEL_TOKEN");          // Personal Access Token
  const teamId = envGet("VERCEL_TEAM_ID");       // team_xxx (可選)
  const teamSlug = envGet("VERCEL_TEAM_SLUG");   // no-opens-projects (可選)

  // 明確型別，避免變成 never[]
  const missing: string[] = [];
  if (!projectId) missing.push("VERCEL_PROJECT_ID");
  if (!token) missing.push("VERCEL_TOKEN");
  if (missing.length > 0) {
    return {
      ok: false,
      results: { vercel: { ok: false } },
      guide: [
        `缺少環境變數：${missing.join(", ")}`,
        "若專案屬於 Team，請補 VERCEL_TEAM_ID（或 VERCEL_TEAM_SLUG）後重佈署",
      ],
    };
  }

  // 既然上面已擋掉 null，這裡用 non-null 斷言讓 TS 靜音
  const pid: string = projectId!;
  const bearer: string = token!;

  const base = "https://api.vercel.com";
  const qs = new URLSearchParams({ upsert: "true" });
  if (teamId) qs.set("teamId", teamId);
  else if (teamSlug) qs.set("slug", teamSlug);

  const headers = {
    Authorization: `Bearer ${bearer}`,
    "content-type": "application/json",
  } as const;

  // 1) 讀 Project（驗證權限/ID）
  const pURL = `${base}/v10/projects/${encodeURIComponent(pid)}${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const pRes = await fetch(pURL, { headers });
  const pStatus = pRes.status;

  // 2) 寫環境變數（必帶 type + target；這裡用 encrypted）
  const eURL = `${base}/v10/projects/${encodeURIComponent(pid)}/env${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const body = {
    key: "R5_RW_TEST",
    value: `ok@${new Date().toISOString()}`,
    type: "encrypted" as const,                 // 依官方：plain | encrypted | system
    target: ["production", "preview"] as const, // 必帶
    comment: "r5 rw-test",
  };
  const aRes = await fetch(eURL, { method: "POST", headers, body: JSON.stringify(body) });
  const addStatus = aRes.status;
  let addBody: unknown = null;
  try { addBody = await aRes.json(); } catch { addBody = null; }

  const hints: string[] = [];
  if (addStatus === 400) {
    hints.push(
      "400 常見原因：",
      "1) 少帶 type/target（此版已帶齊）",
      "2) Team 專案未帶 teamId/slug（請設 VERCEL_TEAM_ID 或 VERCEL_TEAM_SLUG）",
      "3) key 名稱不合法（A-Z0-9_；不要以 VERCEL_ 開頭）",
      "4) token 權限不足（個人 Token 也能用，但需能存取此 Team/Project）"
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

/** ---------- GitHub RW Test（沿用） ---------- */
async function githubRW() {
  const repo = envGet("GITHUB_REPO"); // user/repo
  const branch = envGet("GITHUB_BRANCH") || "main";
  const token = envGet("GITHUB_TOKEN");
  const missing: string[] = [];
  if (!repo) missing.push("GITHUB_REPO");
  if (!token) missing.push("GITHUB_TOKEN");
  if (missing.length > 0) {
    return { ok: false, results: { github: { ok: false } }, guide: [`缺環境變數：${missing.join(", ")}`] };
  }
  const [owner, name] = (repo as string).split("/");
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

/** ---------- Supabase RW Test（沿用） ---------- */
async function supabaseRW() {
  const url = envGet("SUPABASE_URL");
  const svc = envGet("SUPABASE_SERVICE_ROLE_KEY");
  const schema = envGet("SUPABASE_SCHEMA") || "gov";
  const table = `${schema}.release_tags`;
  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!svc) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    return { ok: false, results: { supabase: { ok: false } }, guide: [`缺環境變數：${missing.join(", ")}`] };
  }
  const r1 = await fetch(`${url}/rest/v1/${table}?id=eq.1&select=id`, {
    headers: { apikey: svc!, Authorization: `Bearer ${svc!}` },
  });
  const readStatus = r1.status;
  const readBody = await r1.json().catch(() => []);
  const payload = { kind: process.env.R5_TEST_RELEASE_KIND || "baseline", tag: `r5_${Date.now()}` };
  const r2 = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: svc!, Authorization: `Bearer ${svc!}`, "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const writeStatus = r2.status;
  const writeBody = await r2.json().catch(() => []);
  return {
    ok: readStatus === 200 && (writeStatus === 201 || writeStatus === 200),
    results: { supabase: { ok: writeStatus === 201 || writeStatus === 200, canRead: readStatus === 200, addOK: writeStatus === 201 || writeStatus === 200, detail: { readStatus, readBody, writeStatus, writeBody } } },
  };
}

/** ---------- Route ---------- */
export async function GET(req: NextRequest) {
  const who = new URL(req.url).searchParams.get("who")?.toLowerCase() || "";
  const ts = new Date().toISOString();
  if (who === "vercel")   return J({ ts, who: "vercel",   ...(await vercelRW()) });
  if (who === "github")   return J({ ts, who: "github",   ...(await githubRW()) });
  if (who === "supabase") return J({ ts, who: "supabase", ...(await supabaseRW()) });

  return J({
    ts, ok: false,
    guide: [
      "用法：/api/r5/rw-test?who=vercel|github|supabase",
      "vercel：讀 project + 新增環境變數（type=encrypted, target=[production,preview]，自動帶 teamId/slug）",
      "github：ops/ 新增 r5_rw_test_<ts>.json",
      "supabase：gov.release_tags 讀 id=1 + insert 一筆",
    ],
  }, 400);
}
