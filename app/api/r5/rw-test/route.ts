// app/api/r5/rw-test/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * R5 讀/寫自測路由（帶內建錯誤指南）
 *
 * 用法：
 *   /api/r5/rw-test?who=supabase        只測 supabase
 *   /api/r5/rw-test?who=vercel          只測 vercel
 *   /api/r5/rw-test?who=github          只測 github
 *   /api/r5/rw-test                     三個全測
 *   + guide=1                           附錯誤指南（預設就會有精簡版，guide=1 顯示更詳細）
 *   + debug=1                           回傳更多原始資訊（不回 token）
 *
 * 關鍵修正：
 *   1) 測 supabase 寫入時一律送合法 kind：
 *        const R5_KIND = process.env.R5_TEST_RELEASE_KIND ?? "baseline"
 *   2) 依錯誤碼與情境產出中文指引（缺 env、Data API 未開、schema 未曝光、RLS/Policy 阻擋、CHECK 約束等）
 */

// ---------- utils ----------
type J = Record<string, any>;
const nowISO = () => new Date().toISOString();
const ok = (s: number) => s === 200 || s === 201 || s === 204;
const mask = (s: string | undefined | null, keep = 4) =>
  !s ? "" : s.length <= keep ? "*".repeat(s.length) : s.slice(0, keep) + "*".repeat(Math.max(0, s.length - keep));

async function jfetch(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  let body: any = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
}

const resWrap = (who: string, results: J, overallOk?: boolean) =>
  NextResponse.json({
    ts: nowISO(),
    who,
    results,
    ok: overallOk ?? Object.values(results).every((x: any) => x?.ok === true),
  });

// ---------- env ----------
const R5_KIND = process.env.R5_TEST_RELEASE_KIND ?? "baseline";

// vercel
const VERCEL_TOKEN = process.env.VERCEL_TOKEN ?? "";
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "";

// github
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_REPO = process.env.GITHUB_REPO ?? "";       // e.g. "gery0112x/wentian-clean"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? "main";

// supabase
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA ?? "gov"; // 你專案採用 gov

// ---------- guidance builders ----------
function envReport(debug: boolean) {
  return {
    vercel: {
      VERCEL_PROJECT_ID: !!VERCEL_PROJECT_ID,
      VERCEL_TOKEN: !!VERCEL_TOKEN ? "set(" + mask(VERCEL_TOKEN) + ")" : "missing",
    },
    github: {
      GITHUB_REPO: GITHUB_REPO || "missing",
      GITHUB_BRANCH,
      GITHUB_TOKEN: !!GITHUB_TOKEN ? "set(" + mask(GITHUB_TOKEN) + ")" : "missing",
    },
    supabase: {
      SUPABASE_URL: SUPABASE_URL || "missing",
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY ? "set(" + mask(SUPABASE_SERVICE_ROLE_KEY) + ")" : "missing",
      SUPABASE_SCHEMA,
      R5_TEST_RELEASE_KIND: R5_KIND,
    },
    debug,
  };
}

function guideMissingEnv(name: string, vars: string[]) {
  return {
    title: `${name}：缺環境變數`,
    todo: [
      `到 Vercel → Settings → Environment Variables 新增：${vars.join(", ")}`,
      "新增後重新部署（或在 Deployments 觸發 Re-Deploy）",
    ],
  };
}

function supabaseGuideByStatus(detail: J): J[] {
  const g: J[] = [];
  const read = detail.readStatus;
  const write = detail.writeStatus;
  const writeBody = detail.writeBody;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    g.push(guideMissingEnv("Supabase", ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SCHEMA(=gov)"]));
    return g;
  }

  // 讀取失敗情境
  if (read === 401 || read === 403) {
    g.push({
      title: "Supabase 讀取被拒絕 (401/403)",
      why: "通常是用到 anon key 或 JWT 無效。",
      todo: [
        "確認使用 SUPABASE_SERVICE_ROLE_KEY（不是 anon key）",
        "若仍 403，檢查 Settings → API → Data API 是否啟用",
      ],
    });
  } else if (read === 404) {
    g.push({
      title: "Supabase 讀取 404",
      why: "Data API 未啟用，或 Exposed schemas 未包含指定 schema（gov），或資料表不存在。",
      todo: [
        "Settings → Data API → 打開 Enable Data API",
        "Exposed schemas 加入：public、graphql_public、gov",
        "Extra search path：public, extensions",
        "確認資料表 gov.release_tags 存在",
      ],
    });
  }

  // 寫入失敗情境
  if (write === 406) {
    g.push({
      title: "Supabase 寫入 406",
      why: "多半是 Content-Profile 指向的 schema 未曝光，或 RLS/Policy 阻擋 insert。",
      todo: [
        "Settings → Data API → Exposed schemas 必須包含 gov",
        "release_tags 開啟 RLS，並建立 allow_sr_write（service_role 可 insert）",
        "POST header 需帶 Content-Profile: gov（本路由已帶）",
      ],
    });
  }

  // 檢核違反（你剛遇到的）
  const msg = writeBody?.message || "";
  if (write >= 400 && /check constraint/i.test(msg)) {
    g.push({
      title: "Supabase 寫入違反 CHECK 約束",
      why: "release_tags.kind 僅允許白名單值。",
      todo: [
        "設定環境變數 R5_TEST_RELEASE_KIND=baseline（或其他白名單值）",
        "或直接接受預設 baseline（本路由已預設）",
      ],
    });
  }

  return g;
}

function vercelGuide(detail: J): J[] {
  const g: J[] = [];
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    g.push(guideMissingEnv("Vercel", ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"]));
    return g;
  }
  if (!(detail.pStatus && detail.pStatus === 200)) {
    g.push({
      title: "Vercel 專案環境讀取異常",
      todo: [
        "確認 VERCEL_PROJECT_ID 正確（prj_xxx…）",
        "確認 VERCEL_TOKEN 權限包含讀寫 Environment Variables",
      ],
    });
  }
  if (detail.addStatus && detail.addStatus >= 400) {
    g.push({
      title: "Vercel 新增環境變數失敗",
      todo: [
        "檢查 Token 權限與 Project 成員/Team 權限",
        "避免保留禁止名稱的 key",
      ],
    });
  }
  return g;
}

function githubGuide(detail: J): J[] {
  const g: J[] = [];
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    g.push(guideMissingEnv("GitHub", ["GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH(=main)"]));
    return g;
  }
  if (detail.putStatus && detail.putStatus >= 400) {
    g.push({
      title: "GitHub 建檔失敗",
      todo: [
        "確認 GITHUB_TOKEN 至少有 repo:contents 權限",
        `確認 GITHUB_REPO=${GITHUB_REPO} 存在且 Token 有寫入權`,
        `分支 GITHUB_BRANCH=${GITHUB_BRANCH} 存在`,
      ],
    });
  }
  return g;
}

// ---------- vercel test ----------
async function testVercel(): Promise<J> {
  const base = "https://api.vercel.com";
  const headers = {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };

  const detail: J = {};
  let canRead = false;
  let addOk = false;
  let delOk = false;

  const list = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env?decrypt=false`, { headers });
  detail.pStatus = list.status;
  canRead = ok(list.status);

  const key = "R5_RW_TEST";
  const val = Buffer.from(cryptoRandom()).toString("base64");
  const add = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env`, {
    method: "POST",
    headers,
    body: JSON.stringify({ key, value: val, type: "encrypted", target: ["production"] }),
  });
  detail.addStatus = add.status;
  detail.addJson = add.body ?? null;
  addOk = ok(add.status);

  const list2 = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env?decrypt=false`, { headers });
  const found = Array.isArray(list2.body?.envs) ? list2.body.envs.find((e: any) => e.key === key) : null;
  const delSteps: any[] = [];
  if (found?.id) {
    const del = await jfetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env/${found.id}`, { method: "DELETE", headers });
    delSteps.push({ by: "list-key", id: found.id, status: del.status });
    delOk = ok(del.status);
  }
  detail.delSteps = delSteps;

  const guides = vercelGuide(detail);
  return { ok: canRead && addOk, canRead, addOk, delOk, detail, guide: guides };
}

// ---------- github test ----------
async function testGithub(): Promise<J> {
  const base = "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
  };

  const path = `ops/r5_rw_test_${Date.now()}.json`;
  const content = Buffer.from(JSON.stringify({ ts: nowISO(), repo: GITHUB_REPO, branch: GITHUB_BRANCH })).toString("base64");

  const detail: J = {};
  let createdOK = false;
  let canRead = false;
  let delOk = false;

  const create = await jfetch(`${base}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: "r5 rw test", content, branch: GITHUB_BRANCH }),
  });
  detail.putStatus = create.status;
  createdOK = ok(create.status);

  const read = await jfetch(`${base}/repos/${GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
  detail.getStatus = read.status;
  canRead = ok(read.status);

  const sha = read.body?.sha || create.body?.content?.sha;
  if (sha) {
    const del = await jfetch(`${base}/repos/${GITHUB_REPO}/contents/${path}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ message: "r5 rw cleanup", sha, branch: GITHUB_BRANCH }),
    });
    delOk = ok(del.status);
    detail.delStatus = del.status;
  }

  const guides = githubGuide(detail);
  return { ok: createdOK && canRead, createdOK, canRead, delOk, detail, guide: guides };
}

// ---------- supabase test ----------
async function testSupabase(): Promise<J> {
  const headersBase = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  } as Record<string, string>;

  const detail: J = {};
  let canRead = false;
  let addOk = false;

  // Read
  const read = await jfetch(`${SUPABASE_URL}/rest/v1/release_tags?select=id&limit=1`, {
    headers: { ...headersBase, "Accept-Profile": SUPABASE_SCHEMA },
  });
  detail.readStatus = read.status;
  detail.readBody = read.body ?? null;
  canRead = ok(read.status);

  // Write（只送合法 kind）
  const payload = [{ kind: R5_KIND }];
  const write = await jfetch(`${SUPABASE_URL}/rest/v1/release_tags`, {
    method: "POST",
    headers: {
      ...headersBase,
      "Content-Type": "application/json",
      "Content-Profile": SUPABASE_SCHEMA,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  detail.writeStatus = write.status;
  detail.writeBody = write.body ?? null;
  addOk = ok(write.status);

  const guides = supabaseGuideByStatus(detail);
  return { ok: canRead && addOk, canRead, addOk, detail, guide: guides };
}

// ---------- route ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const who = (searchParams.get("who") || "all").toLowerCase();
  const guideWanted = searchParams.get("guide") === "1";
  const debug = searchParams.get("debug") === "1";

  const results: J = { env: envReport(debug) };

  try {
    if (who === "vercel" || who === "all") {
      results.vercel = (!VERCEL_TOKEN || !VERCEL_PROJECT_ID)
        ? { ok: false, hint: "缺 VERCEL_TOKEN / VERCEL_PROJECT_ID", guide: guideMissingEnv("Vercel", ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"]) }
        : await testVercel();
    }
    if (who === "github" || who === "all") {
      results.github = (!GITHUB_TOKEN || !GITHUB_REPO)
        ? { ok: false, hint: "缺 GITHUB_TOKEN / GITHUB_REPO", guide: guideMissingEnv("GitHub", ["GITHUB_TOKEN", "GITHUB_REPO"]) }
        : await testGithub();
    }
    if (who === "supabase" || who === "all") {
      results.supabase = (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
        ? { ok: false, hint: "缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", guide: guideMissingEnv("Supabase", ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SCHEMA"]) }
        : await testSupabase();
    }
  } catch (e: any) {
    results.error = { message: String(e?.message ?? e) };
  }

  // 如果沒要詳細指南，就壓縮一下文字
  if (!guideWanted) {
    for (const k of ["vercel", "github", "supabase"]) {
      const sec: any = (results as any)[k];
      if (sec?.guide) sec.guide = (sec.guide as any[]).map((g: any) => g.title ?? g);
    }
  }

  return resWrap(who, results);
}

// ---------- random ----------
function cryptoRandom() {
  const arr = Array.from({ length: 24 }, () => Math.floor(Math.random() * 256));
  return String.fromCharCode(...arr);
}
