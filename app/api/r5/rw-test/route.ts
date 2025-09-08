// app/api/r5/rw-test/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const J = (x: any) => new Response(JSON.stringify(x, null, 2), { headers: { "content-type": "application/json; charset=utf-8" }});

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`缺環境變數: ${name}`);
  return v;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const who = url.searchParams.get("who") ?? "supabase";
  const ts = new Date().toISOString();

  if (who === "supabase") {
    // --- 讀/寫都同時帶 gov schema 的 header，並回傳完整錯誤 ---
    const restUrl = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "") + "/rest/v1";
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    const schema = env("SUPABASE_SCHEMA", "public");

    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // 讀與寫都明確指定 gov
      "Accept-Profile": schema,
      "Content-Profile": schema,
      // 要回傳插入後資料，且有重複時合併（方便測）
      Prefer: "return=representation,resolution=merge-duplicates",
    };

    // 先測「讀」
    const readRes = await fetch(`${restUrl}/release_tags?select=id&limit=1`, { headers });
    const readText = await readRes.text();
    let readJson: any = null;
    try { readJson = JSON.parse(readText); } catch {}

    // 再測「寫」
    const payload = [{ kind: "r5_rw_test", tag: `r5-${Date.now()}` }];
    const writeRes = await fetch(`${restUrl}/release_tags`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const writeText = await writeRes.text();
    let writeJson: any = null;
    try { writeJson = JSON.parse(writeText); } catch {}

    return J({
      ts,
      who: "supabase",
      results: {
        supabase: {
          ok: writeRes.ok && readRes.ok,
          canRead: readRes.ok,
          addOk: writeRes.ok,
          detail: {
            readStatus: readRes.status,
            writeStatus: writeRes.status,
            readBody: readJson ?? readText,
            writeBody: writeJson ?? writeText, // 這裡會把真正的錯誤訊息吐回來
          },
          row: Array.isArray(writeJson) ? writeJson[0] : null,
        },
      },
    });
  }

  if (who === "vercel") {
    // 確認 Vercel API token/Project 是否可用（讀寫）
    const token = env("VERCEL_TOKEN");
    const projectId = env("VERCEL_PROJECT_ID");
    const base = "https://api.vercel.com";
    const h = { Authorization: `Bearer ${token}`, "content-type": "application/json" };

    // 讀專案
    const p = await fetch(`${base}/v9/projects/${projectId}`, { headers: h });
    const pJson = await p.json();

    // 建個 list env（測寫入/刪除）
    const key = "R5_RW_TEST";
    const add = await fetch(`${base}/v10/projects/${projectId}/env`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ type: "encrypted", key, value: Math.random().toString(36).slice(2), target: ["production"] }),
    });
    const addJson = await add.json();

    // 刪除剛建立的 env
    let delStatus: number | null = null;
    if (add.ok && addJson?.id) {
      const del = await fetch(`${base}/v9/projects/${projectId}/env/${addJson.id}`, { method: "DELETE", headers: h });
      delStatus = del.status;
    }

    return J({
      ts, who: "vercel",
      results: {
        vercel: {
          ok: p.ok && add.ok && delStatus === 200,
          canRead: p.ok,
          addOk: add.ok,
          delOk: delStatus === 200,
          detail: { pStatus: p.status, addStatus: add.status, delStatus, project: pJson?.id ?? null },
        },
      },
    });
  }

  if (who === "github") {
    // 確認 GitHub PAT 可讀寫 repo
    const token = env("GITHUB_TOKEN");
    const repo = env("GITHUB_REPO"); // 例：gery0112x/wentian-clean
    const api = `https://api.github.com/repos/${repo}/contents/ops`;
    const h = { Authorization: `Bearer ${token}`, "content-type": "application/json", Accept: "application/vnd.github+json" };

    // 讀取 repo（list）
    const list = await fetch(api, { headers: h });
    const listJson = await list.json();

    // 建一個測試檔（PUT）
    const path = `ops/r5_rw_test_${Date.now()}.json`;
    const body = { hello: "r5", ts };
    const put = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        message: "r5s rw測試：清理",
        content: Buffer.from(JSON.stringify(body, null, 2)).toString("base64"),
      }),
    });
    const putJson = await put.json();

    // 刪除（DELETE）
    let delOk = false;
    if (put.ok && putJson?.content?.sha) {
      const del = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: "DELETE",
        headers: h,
        body: JSON.stringify({ message: "r5s rw清理", sha: putJson.content.sha }),
      });
      delOk = del.ok;
    }

    return J({
      ts, who: "github",
      results: {
        github: {
          ok: list.ok && put.ok && delOk,
          canRead: list.ok,
          createdOk: put.ok,
          delOk,
          detail: { listStatus: list.status, putStatus: put.status, path, node: putJson?.content?.path ?? null },
        },
      },
    });
  }

  return J({ ts, who, error: "unknown who" });
}
