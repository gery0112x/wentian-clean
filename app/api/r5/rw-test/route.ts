// app/api/r5/rw-test/route.ts
import { NextRequest, NextResponse } from "next/server";

// 小工具：讀 env（簡單檢查）
const need = (k: string) => {
  const v = process.env[k];
  return v && v.trim().length > 0 ? v.trim() : null;
};
const json = (o: any, status = 200) =>
  new NextResponse(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// -------- Vercel RW 測試（修正重點在這裡） --------
async function vercelRWTest() {
  const projectId = need("VERCEL_PROJECT_ID"); // prj_xxx
  const bearer = need("VERCEL_TOKEN");         // 個人 Access Token
  const teamId = need("VERCEL_TEAM_ID");       // 團隊用，可省略
  const now = new Date().toISOString();
  const key = "R5_RW_TEST";
  const value = `ok@${now}`;
  const query = new URLSearchParams();
  query.set("upsert", "true");
  if (teamId) query.set("teamId", teamId);

  const base = "https://api.vercel.com";
  const headers = {
    Authorization: `Bearer ${bearer}`,
    "content-type": "application/json",
  };

  const missing: string[] = [];
  if (!projectId) missing.push("VERCEL_PROJECT_ID");
  if (!bearer) missing.push("VERCEL_TOKEN");
  if (missing.length) {
    return {
      ok: false,
      guide: [
        "缺環境變數：" + missing.join(", "),
        "若專案屬於團隊，請在環境變數加 VERCEL_TEAM_ID 並重佈署",
        "此端點已自動帶 upsert=true，可重複寫入同一 key",
      ],
      results: { vercel: { ok: false } },
    };
  }

  // 1) 讀專案（驗讀權限）
  const projUrl = `${base}/v10/projects/${encodeURIComponent(projectId)}${
    query.toString() ? `?${query.toString()}` : ""
  }`;
  const pRes = await fetch(projUrl, { headers });
  const pStatus = pRes.status;

  // 2) 寫環境變數（修正：一定帶 type + target；可選 teamId；upsert=true）
  const envUrl = `${base}/v10/projects/${encodeURIComponent(projectId)}/env${
    query.toString() ? `?${query.toString()}` : ""
  }`;
  const body = {
    key,
    value,
    // Vercel 文件要求：必帶 type 與 target；示例可用 "plain"；敏感資訊可用 "sensitive"
    // https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables
    type: "plain",
    target: ["production", "preview"], // 也可含 "development"
    // gitBranch: 可選：若 target 包含 preview 且想綁特定分支再填
    comment: "r5 rw-test",
  };
  const aRes = await fetch(envUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const addStatus = aRes.status;
  let addBody: any = null;
  try {
    addBody = await aRes.json();
  } catch (_) {}

  return {
    ok: pStatus === 200 && (addStatus === 201 || addStatus === 200),
    results: {
      vercel: {
        ok: addStatus === 201 || addStatus === 200,
        canRead: pStatus === 200,
        addOK: addStatus === 201 || addStatus === 200,
        delOK: false,
        detail: { pStatus, addStatus, addBody },
      },
    },
  };
}

// -------- GitHub RW 測試（沿用：建立檔案 + 回讀 commit） --------
async function githubRWTest() {
  const repo = need("GITHUB_REPO"); // 例：gery0112x/wentian-clean
  const branch = need("GITHUB_BRANCH") || "main";
  const token = need("GITHUB_TOKEN");
  const [owner, name] = (repo || "").split("/");
  const missing: string[] = [];
  if (!owner || !name) missing.push("GITHUB_REPO");
  if (!token) missing.push("GITHUB_TOKEN");
  if (missing.length) {
    return {
      ok: false,
      guide: ["缺環境變數：" + missing.join(", ")],
      results: { github: { ok: false } },
    };
  }

  const ts = Date.now();
  const path = `ops/r5_rw_test_${ts}.json`;
  const content = Buffer.from(JSON.stringify({ ts, ok: true }, null, 2)).toString("base64");

  // PUT /repos/{owner}/{repo}/contents/{path}
  const putUrl = `https://api.github.com/repos/${owner}/${name}/contents/${encodeURIComponent(
    path
  )}`;
  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "r5-rw-test",
    Accept: "application/vnd.github+json",
  };

  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: commonHeaders,
    body: JSON.stringify({
      message: `r5 rw-test ${ts}`,
      content,
      branch,
    }),
  });
  const putOk = putRes.status === 201 || putRes.status === 200;
  const putBody = await putRes.json().catch(() => ({} as any));

  // 讀回最新 commit
  const commitSha = putBody?.commit?.sha;
  let commitBody: any = null;
  if (commitSha) {
    const cUrl = `https://api.github.com/repos/${owner}/${name}/commits/${commitSha}`;
    const cRes = await fetch(cUrl, { headers: commonHeaders });
    commitBody = await cRes.json().catch(() => ({} as any));
  }

  return {
    ok: putOk,
    results: {
      github: {
        ok: putOk,
        path,
        commit: commitBody,
      },
    },
  };
}

// -------- Supabase RW 測試（沿用：讀 id=1 + 插入一筆） --------
async function supabaseRWTest() {
  const url = need("SUPABASE_URL");
  const svcKey = need("SUPABASE_SERVICE_ROLE_KEY");
  const schema = need("SUPABASE_SCHEMA") || "gov";
  const table = `${schema}.release_tags`;

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!svcKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    return {
      ok: false,
      guide: ["缺環境變數：" + missing.join(", ")],
      results: { supabase: { ok: false } },
    };
  }

  // 讀 id=1
  const r1 = await fetch(`${url}/rest/v1/${table}?id=eq.1&select=id`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
  });
  const readStatus = r1.status;
  const readBody = await r1.json().catch(() => []);

  // insert 一筆
  const payload = {
    kind: process.env.R5_TEST_RELEASE_KIND || "baseline",
    tag: `r5_${Date.now()}`,
  };
  const r2 = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: svcKey,
      Authorization: `Bearer ${svcKey}`,
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

// -------- 路由入口 --------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const who = (searchParams.get("who") || "").toLowerCase();
  const ts = new Date().toISOString();

  if (who === "vercel") {
    const r = await vercelRWTest();
    return json({ ts, who: "vercel", ...r });
  }
  if (who === "github") {
    const r = await githubRWTest();
    return json({ ts, who: "github", ...r });
  }
  if (who === "supabase") {
    const r = await supabaseRWTest();
    return json({ ts, who: "supabase", ...r });
  }

  // 指南
  return json({
    ts,
    who,
    ok: false,
    guide: [
      "使用方式：/api/r5/rw-test?who=vercel|github|supabase",
      "vercel：會讀專案 + 新增環境變數（upsert=true）",
      "github：會在 ops/ 下建立 r5_rw_test_<ts>.json 並回讀 commit",
      "supabase：會讀 gov.release_tags id=1 並 insert 一筆",
    ],
  });
}
