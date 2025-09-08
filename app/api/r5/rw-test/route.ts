// app/api/r5/rw-test/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * R5 讀/寫自測路由
 * ?who=vercel|github|supabase  (不帶 who 則三個都測)
 * 修正：kind 改為合法值 baseline，並支援環境變數 R5_TEST_RELEASE_KIND 覆蓋。
 */

type Json = Record<string, any>;

const nowISO = () => new Date().toISOString();
const ok = (n?: number) => n === 200 || n === 201 || n === 204;

// --------- 環境變數 ----------
const R5_KIND = process.env.R5_TEST_RELEASE_KIND ?? "baseline";

// Vercel
const VERCEL_TOKEN = process.env.VERCEL_TOKEN ?? "";
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "";

// GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_REPO = process.env.GITHUB_REPO ?? ""; // e.g. "gery0112x/wentian-clean"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? "main";

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA ?? "gov"; // 必須含 gov

// --------- Helpers ----------
async function jfetch(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  let body: any = null;
  try {
    body = await r.json();
  } catch {
    // ignore
  }
  return { status: r.status, body };
}

const resWrap = (who: string, results: Json, overallOk?: boolean) =>
  NextResponse.json({
    ts: nowISO(),
    who,
    results,
    ok: overallOk ?? Object.values(results).every((x: any) => x?.ok === true),
  });

// --------- Vercel 測試 ----------
async function testVercel(): Promise<Json> {
  const base = "https://api.vercel.com";
  const headers = {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };

  const detail: Json = {};
  let canRead = false;
  let addOk = false;
  let delOk = false;

  // 讀：列出 env（也能驗證 token / projectId）
  const list = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env?decrypt=false`, { headers });
  detail.pStatus = list.status;
  canRead = ok(list.status);

  // 寫：新增一個測試 env
  const key = "R5_RW_TEST";
  const val = Buffer.from(cryptoRandom()).toString("base64"); // 隨機字串
  const addBody = {
    key,
    value: val,
    type: "encrypted",
    target: ["production"],
  };
  const add = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env`, {
    method: "POST",
    headers,
    body: JSON.stringify(addBody),
  });
  detail.addStatus = add.status;
  detail.addJson = add.body ?? null;
  addOk = ok(add.status);

  // 刪：抓 id 後刪除
  const list2 = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env?decrypt=false`, { headers });
  const found = Array.isArray(list2.body?.envs)
    ? list2.body.envs.find((e: any) => e.key === key)
    : null;

  const delSteps: any[] = [];
  if (found?.id) {
    const del = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env/${found.id}`, {
      method: "DELETE",
      headers,
    });
    delSteps.push({ by: "list-key", id: found.id, status: del.status });
    delOk = ok(del.status);
  }
  detail.delSteps = delSteps;
  return { ok: canRead && addOk /* 刪除失敗不算致命 */, canRead, addOk, delOk, detail, teamIdUsed: false };
}

// --------- GitHub 測試 ----------
async function testGithub(): Promise<Json> {
  const base = "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
  };

  const path = `ops/r5_rw_test_${Date.now()}.json`;
  const content = Buffer.from(
    JSON.stringify({ ts: nowISO(), repo: GITHUB_REPO, branch: GITHUB_BRANCH, message: "r5 rw測試：清理" })
  ).toString("base64");

  const detail: Json = {};
  let createdOK = false;
  let canRead = false;
  let delOk = false;

  // 建立 (PUT contents)
  const create = await jfetch(`${base}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "r5 rw test",
      content,
      branch: GITHUB_BRANCH,
    }),
  });
  detail.putStatus = create.status;
  detail.createJson = create.body ?? null;
  createdOK = ok(create.status);

  // 讀
  const read = await jfetch(`${base}/repos/${GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers,
  });
  detail.getStatus = read.status;
  canRead = ok(read.status);

  // 刪
  const sha = create.body?.content?.sha || create.body?.content?.sha || create.body?.commit?.sha || read.body?.sha;
  if (sha) {
    const del = await jfetch(`${base}/repos/${GITHUB_REPO}/contents/${path}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({
        message: "r5 rw test cleanup",
        sha,
        branch: GITHUB_BRANCH,
      }),
    });
    delOk = ok(del.status);
    detail.delStatus = del.status;
  }

  // 附上連結
  if (create.body?.commit?.html_url) detail.html_url = create.body.commit.html_url;
  if (create.body?.commit?.url) detail.url = create.body.commit.url;

  return { ok: createdOK && canRead, createdOK, canRead, delOk, detail };
}

// --------- Supabase 測試（Data API / RLS via service_role） ----------
async function testSupabase(): Promise<Json> {
  const headersBase = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  } as Record<string, string>;

  const detail: Json = {};
  let canRead = false;
  let addOk = false;

  // 讀：隨便抓一筆 id 來確認 200
  const read = await jfetch(`${SUPABASE_URL}/rest/v1/release_tags?select=id&limit=1`, {
    headers: {
      ...headersBase,
      "Accept-Profile": SUPABASE_SCHEMA,
    },
  });
  detail.readStatus = read.status;
  detail.readBody = read.body ?? null;
  canRead = ok(read.status);

  // 寫：只送合法 kind（已修：baseline 或由環境覆蓋）
  const payload = [{ kind: R5_KIND }];

  const write = await jfetch(`${SUPABASE_URL}/rest/v1/release_tags`, {
    method: "POST",
    headers: {
      ...headersBase,
      "Content-Type": "application/json",
      "Content-Profile": SUPABASE_SCHEMA,
      Prefer: "return=minimal", // 不需要回 body，201 即可
    },
    body: JSON.stringify(payload),
  });
  detail.writeStatus = write.status;
  detail.writeBody = write.body ?? null;
  addOk = ok(write.status);

  return { ok: canRead && addOk, canRead, addOk, detail, row: write.body?.[0] ?? null };
}

// --------- 路由處理 ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const who = (searchParams.get("who") || "all").toLowerCase();

  // 快速檢查環境不足的情況，直接丟出 hint，避免誤判
  const hint: Json = {};
  if (who === "vercel" || who === "all") {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      hint.vercel = "缺 VERCEL_TOKEN / VERCEL_PROJECT_ID";
    }
  }
  if (who === "github" || who === "all") {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      hint.github = "缺 GITHUB_TOKEN / GITHUB_REPO";
    }
  }
  if (who === "supabase" || who === "all") {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      hint.supabase = "缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY";
    }
  }

  const results: Json = {};
  try {
    if (who === "vercel" || who === "all") {
      results.vercel = hint.vercel ? { ok: false, hint: hint.vercel } : await testVercel();
    }
    if (who === "github" || who === "all") {
      results.github = hint.github ? { ok: false, hint: hint.github } : await testGithub();
    }
    if (who === "supabase" || who === "all") {
      results.supabase = hint.supabase ? { ok: false, hint: hint.supabase } : await testSupabase();
    }
  } catch (e: any) {
    return resWrap(who, { error: String(e?.message ?? e) }, false);
  }

  return resWrap(who, results);
}

// --------- 小工具 ----------
function cryptoRandom() {
  // node:crypto 無法在 edge 使用；本檔 runtime=nodejs
  const arr = Array.from({ length: 24 }, () => Math.floor(Math.random() * 256));
  return String.fromCharCode(...arr);
}
