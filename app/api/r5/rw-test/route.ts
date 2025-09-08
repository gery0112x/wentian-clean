// app/api/r5/rw-test/route.ts
import { NextResponse } from "next/server";

/**
 * R5 可讀可寫綜合測試
 * 支援 who=vercel | github | supabase
 * 參數：
 *   - guide=1   : 顯示環境變數檢核與指引（會遮罩機敏值）
 *
 * 需求的環境變數：
 *   VERCEL_PROJECT_ID, VERCEL_TOKEN
 *   GITHUB_REPO (e.g. "owner/repo"), GITHUB_BRANCH, GITHUB_TOKEN
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SCHEMA
 *   R5_TEST_RELEASE_KIND (optional, default "baseline")
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, any>;

const mask = (v?: string | null) =>
  !v ? v : v.length <= 8 ? "***" : `${v.slice(0, 3)}${"*".repeat(v.length - 6)}${v.slice(-3)}`;

const ok = (data: Json) =>
  new Response(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });

const nowTs = () => new Date().toISOString();

/** --------------------------
 *  入口
 *  -------------------------*/
export async function GET(req: Request) {
  const url = new URL(req.url);
  const who = (url.searchParams.get("who") || "").toLowerCase().trim();
  const showGuide = url.searchParams.get("guide") === "1";

  // 共用：測試寫入 payload（修好：同時帶 kind 與 tag）
  const testKind = process.env.R5_TEST_RELEASE_KIND ?? "baseline";
  const testTag = `r5_${Date.now()}`;
  const payload = [{ kind: testKind, tag: testTag }];

  // guide 區：回傳環境檢核
  const envEcho =
    showGuide &&
    {
      vercel: {
        VERCEL_PROJECT_ID: !!process.env.VERCEL_PROJECT_ID,
        VERCEL_TOKEN: process.env.VERCEL_TOKEN ? "set(" + mask(process.env.VERCEL_TOKEN) + ")" : "missing",
      },
      github: {
        GITHUB_REPO: process.env.GITHUB_REPO || "missing",
        GITHUB_BRANCH: process.env.GITHUB_BRANCH || "missing",
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "set(" + mask(process.env.GITHUB_TOKEN) + ")" : "missing",
      },
      supabase: {
        SUPABASE_URL: process.env.SUPABASE_URL || "missing",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
          ? "set(" + mask(process.env.SUPABASE_SERVICE_ROLE_KEY) + ")"
          : "missing",
        SUPABASE_SCHEMA: process.env.SUPABASE_SCHEMA || "missing",
      },
      "********************": "********************",
    };

  try {
    if (who === "vercel") {
      const results = await testVercelEnv(payload);
      return ok({ ts: nowTs(), who, results, ...(envEcho ? { env: envEcho } : {}), ok: results?.vercel?.ok === true });
    }

    if (who === "github") {
      const results = await testGithubWrite();
      return ok({ ts: nowTs(), who, results, ...(envEcho ? { env: envEcho } : {}), ok: results?.github?.ok === true });
    }

    if (who === "supabase") {
      const results = await testSupabaseRW(payload);
      // 若缺 env，提供明確指南
      let guide: any[] = [];
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_SCHEMA) {
        guide.push({
          title: "Supabase：缺環境變數",
          todo: [
            "到 Vercel → Settings → Environment Variables 新增：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、SUPABASE_SCHEMA",
            "新增後觸發部署 (Redeploy)",
          ],
        });
      }
      return ok({
        ts: nowTs(),
        who,
        results,
        ...(envEcho ? { env: envEcho } : {}),
        guide,
        ok: results?.supabase?.ok === true,
      });
    }

    // 沒帶 who 或無效
    return ok({
      ts: nowTs(),
      who,
      hint: '使用方式：/api/r5/rw-test?who=vercel|github|supabase（可加 guide=1 顯示環境檢核）',
      ok: false,
    });
  } catch (err: any) {
    return ok({
      ts: nowTs(),
      who,
      error: String(err?.message ?? err),
      ok: false,
    });
  }
}

/** --------------------------
 *  Vercel：新增 / 刪除專案環境變數
 *  -------------------------*/
async function testVercelEnv(payload: any[]) {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const token = process.env.VERCEL_TOKEN;

  const out: Json = { vercel: { ok: false, canRead: false, addOk: false, delOk: false, detail: {} as any } };
  if (!projectId || !token) {
    out.vercel.detail = { hint: "缺 VERCEL_PROJECT_ID / VERCEL_TOKEN" };
    return out;
  }

  const base = `https://api.vercel.com`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 讀：列出 env
  const listRes = await fetch(`${base}/v10/projects/${projectId}/env`, { headers });
  out.vercel.canRead = listRes.ok;
  out.vercel.detail = { pStatus: listRes.status };

  // 加：建立一個 env
  const key = "R5_RW_TEST";
  const value = JSON.stringify({ createdAt: Date.now(), key: "R5_RW_TEST", payloadLen: payload.length });
  const addRes = await fetch(`${base}/v10/projects/${projectId}/env`, {
    method: "POST",
    headers,
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production"] }),
  });
  out.vercel.addOk = addRes.ok;
  out.vercel.detail.addStatus = addRes.status;

  let createdId: string | undefined;
  if (addRes.ok) {
    const j = await addRes.json().catch(() => ({}));
    createdId = j?.id;
    out.vercel.detail.created = j;
  }

  // 刪：若剛剛新增成功就刪掉
  if (createdId) {
    const delRes = await fetch(`${base}/v9/projects/${projectId}/env/${createdId}`, {
      method: "DELETE",
      headers,
    });
    out.vercel.delOk = delRes.ok;
    out.vercel.detail.delStatus = delRes.status;
  }

  out.vercel.ok = !!(out.vercel.canRead && out.vercel.addOk);
  return out;
}

/** --------------------------
 *  GitHub：新增檔案（可讀可寫）
 *  -------------------------*/
async function testGithubWrite() {
  const repo = process.env.GITHUB_REPO; // e.g. "owner/repo"
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN;

  const out: Json = { github: { ok: false, canRead: false, createdOk: false, delOk: false, detail: {} as any } };
  if (!repo || !token) {
    out.github.detail = { hint: "缺 GITHUB_REPO / GITHUB_TOKEN（可選 GITHUB_BRANCH）" };
    return out;
  }

  const base = `https://api.github.com`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  // 讀：取 repo 基本資訊
  const repoRes = await fetch(`${base}/repos/${repo}`, { headers });
  out.github.canRead = repoRes.ok;

  const path = `ops/r5_rw_test_${Date.now()}.json`;
  const content = Buffer.from(
    JSON.stringify({ ts: nowTs(), msg: "R5 RW TEST", branch }, null, 2),
    "utf8"
  ).toString("base64");

  // 寫：PUT 內容
  const put = await fetch(`${base}/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: "r5 rw test", content, branch }),
  });

  out.github.createdOk = put.status === 201 || put.status === 200;
  const putJson = await put.json().catch(() => ({}));
  out.github.detail.putJson = putJson;

  // 後清：若需要可刪，但 GitHub 刪檔需要先查 sha，這裡只示範建立成功即可
  out.github.ok = !!(out.github.canRead && out.github.createdOk);
  return out;
}

/** --------------------------
 *  Supabase（REST）：select + insert
 *  -------------------------*/
async function testSupabaseRW(payload: Array<{ kind: string; tag: string }>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_SCHEMA || "public";

  const out: Json = { supabase: { ok: false, canRead: false, addOk: false, detail: {} as any } };
  if (!url || !key) {
    out.supabase.detail = { hint: "缺 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" };
    return out;
  }

  // 讀：/rest/v1/{table}?select=...
  const table = "release_tags";
  const readRes = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      // 指定 schema：讀用 Accept-Profile
      "Accept-Profile": schema,
    },
  });

  let readBody: any = null;
  try {
    readBody = await readRes.json();
  } catch {}
  out.supabase.canRead = readRes.ok;
  out.supabase.detail.readStatus = readRes.status;
  if (readBody) out.supabase.detail.readBody = readBody;

  // 寫：insert（修好：同時帶 kind 與 tag，kind 預設 baseline）
  const writeRes = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // 指定 schema：寫用 Content-Profile
      "Content-Profile": schema,
    },
    body: JSON.stringify(payload),
  });

  let writeBody: any = null;
  try {
    writeBody = await writeRes.json();
  } catch {}
  out.supabase.addOk = writeRes.status === 201 || writeRes.status === 200;
  out.supabase.detail.writeStatus = writeRes.status;
  out.supabase.detail.writeBody = writeBody;

  out.supabase.ok = !!(out.supabase.canRead && out.supabase.addOk);
  return out;
}
