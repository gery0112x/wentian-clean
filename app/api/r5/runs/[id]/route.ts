// app/api/r5/runs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

function j(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

// ==== env ====
const SB_URL_RAW = process.env.SUPABASE_URL || "";
const SB_BASE = SB_URL_RAW.replace(/\/rest\/v1\/?$/i, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO = process.env.GH_REPO || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";

// ==== helpers ====
async function sbr(path: string) {
  const url = `${SB_BASE}/rest/v1/${path}`;
  const r = await fetch(url, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`postgrest_get_${r.status}`);
  return r.json();
}
async function sbPatch(id: string, patch: any) {
  const url = `${SB_BASE}/rest/v1/r5_runs?id=eq.${id}`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([patch]),
    cache: "no-store",
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!SB_BASE || !SB_KEY) return j(500, { ok: false, error: "supabase_env_missing" });

    const rows = await sbr(`r5_runs?id=eq.${params.id}&select=*`);
    const row = rows?.[0];
    if (!row) return j(404, { ok: false, error: "not_found" });

    // 解構（DB 欄位）
    let { id, status, step_index, progress_percent, steps, updated_at, meta, goal } = row || {};
    const op = meta?.op as string | undefined;
    const workflow_id = meta?.workflow_id as string | undefined;
    const ref = meta?.ref as string | undefined;
    let total_steps: number | null =
      typeof meta?.total_steps === "number" ? meta.total_steps :
      Array.isArray(steps) ? steps.length : null;

    // 若是 GH 工作流，嘗試同步最新狀態
    if (op === "gh_dispatch" && GH_TOKEN && GH_OWNER && GH_REPO && workflow_id) {
      // 若未綁定 run_id，抓最新一筆 workflow run 當候選（per_page=1）
      let gh_run_id = meta?.gh_run_id as number | undefined;
      if (!gh_run_id) {
        const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(workflow_id)}/runs?per_page=1`;
        const rr = await fetch(url, {
          headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "r5-gateway" },
          cache: "no-store",
        });
        if (rr.ok) {
          const js = await rr.json();
          const run = js?.workflow_runs?.[0];
          if (run?.id) {
            gh_run_id = run.id;
            await sbPatch(id, { meta: { ...meta, gh_run_id } });
            meta = { ...meta, gh_run_id };
          }
        }
      }
      // 若有 run_id，查詳細
      if (gh_run_id) {
        const gr = await fetch(
          `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${gh_run_id}`,
          { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "r5-gateway" }, cache: "no-store" }
        );
        if (gr.ok) {
          const run = await gr.json();
          const st = (run.status as string) || "";
          const conclusion = (run.conclusion as string | null) || null;

          if (st === "queued")  { status = "running"; step_index = 1; progress_percent = 30; }
          if (st === "in_progress") { status = "running"; step_index = 2; progress_percent = 70; }
          if (st === "completed") {
            status = conclusion === "success" ? "completed" :
                     conclusion === "cancelled" ? "cancelled" : "failed";
            step_index = 3; progress_percent = 100;
          }
          total_steps = 3;
          await sbPatch(id, { status, step_index, progress_percent, meta: { ...meta, total_steps } });
        }
      }
    }

    // 回傳（同時含舊鍵以相容）
    return j(200, {
      ok: true,
      data: {
        id,
        status,
        step_index,
        total_steps,
        progress_percent: Number(progress_percent ?? 0),
        updated_at,
        // 兼容舊鍵：
        state: status,
        step: step_index,
        percent: Number(progress_percent ?? 0),
      }
    });
  } catch (e: any) {
    return j(500, { ok: false, error: e?.message || "internal_error" });
  }
}
