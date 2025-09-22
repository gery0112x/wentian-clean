import { NextRequest, NextResponse } from "next/server";

function j(status: number, body: unknown) { return NextResponse.json(body, { status }); }
const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GH_OWNER = process.env.GH_OWNER!;
const GH_REPO  = process.env.GH_REPO!;
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";
const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK || "";

async function sb(method: string, path: string, body?: any) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { op, workflow_id, ref = "main" } = await req.json();
    if (!op) return j(400, { ok: false, error: "op_required" });

    // 1) 建立 run（先入庫，讓 ChatGPT 立刻得到 id）
    const totalSteps = op === "gh_dispatch" ? 3 : 1;
    const [row] = await sb("POST", "r5_runs", [{
      op, state: "running", step: 1, total_steps: totalSteps, percent: 10,
      workflow_id: workflow_id || null,
      meta: { ref },
    }]);
    const id = row.id as string;

    // 2) 執行任務
    if (op === "gh_dispatch") {
      if (!GH_TOKEN || !GH_OWNER || !GH_REPO || !workflow_id) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ state: "failed", percent: 100 }]);
        return j(500, { ok: false, id, error: "github_env_missing" });
      }
      // GitHub workflow dispatch
      const r = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(workflow_id)}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GH_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "r5-gateway",
          },
          body: JSON.stringify({ ref }),
          cache: "no-store",
        }
      );
      if (!r.ok && r.status !== 204) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ state: "failed", percent: 100 }]);
        return j(502, { ok: false, id, error: "gh_dispatch_failed", status: r.status });
      }
      // 先把 step 推到 2，等待 progress 查詢時補齊 gh_run_id
      await sb("PATCH", `r5_runs?id=eq.${id}`, [{ step: 2, percent: 30 }]);
    }

    if (op === "vercel_deploy") {
      if (!VERCEL_DEPLOY_HOOK) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ state: "failed", percent: 100 }]);
        return j(500, { ok: false, id, error: "vercel_hook_missing" });
      }
      const r = await fetch(VERCEL_DEPLOY_HOOK, { method: "POST", cache: "no-store" });
      if (!r.ok) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ state: "failed", percent: 100 }]);
        return j(502, { ok: false, id, error: "vercel_deploy_failed", status: r.status });
      }
      await sb("PATCH", `r5_runs?id=eq.${id}`, [{ step: 1, total_steps: 1, percent: 100, state: "completed" }]);
    }

    return j(200, { ok: true, id });
  } catch (e: any) {
    return j(500, { ok: false, error: e?.message || "internal_error" });
  }
}
