// app/api/r5/start/route.ts
import { NextRequest, NextResponse } from "next/server";

function j(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

// ==== Supabase env ====
const SB_URL_RAW = process.env.SUPABASE_URL || "";
const SB_BASE = SB_URL_RAW.replace(/\/rest\/v1\/?$/i, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ==== GitHub / Vercel env ====
const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO = process.env.GH_REPO || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";
const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK || "";

// ==== helpers ====
async function sb(method: string, path: string, body?: any) {
  if (!SB_BASE || !SB_KEY) throw new Error("supabase_env_missing");
  const url = `${SB_BASE}/rest/v1/${path}`;
  const res = await fetch(url, {
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
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const msg = typeof json === "string" ? json : JSON.stringify(json);
    throw new Error(`postgrest_${method}_${res.status}:${msg}`);
  }
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const { op, goal, workflow_id, ref = "main" } = await req.json();

    if (!op) return j(400, { ok: false, error: "op_required" });
    if (!goal) return j(400, { ok: false, error: "goal_required" });

    // 建立 DB 紀錄（先入庫，前端可拿到 id）
    const [row] = await sb("POST", "r5_runs", [{
      goal,
      status: "running",
      step_index: 0,
      progress_percent: op === "gh_dispatch" ? 10 : 0,
      steps: [],
      waits: [],
      progress_message: "",
      meta: { op, workflow_id: workflow_id || null, ref, total_steps: op === "gh_dispatch" ? 3 : 1 },
    }]);

    const id = row.id as string;

    if (op === "vercel_deploy") {
      if (!VERCEL_DEPLOY_HOOK) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ status: "failed", progress_percent: 100 }]);
        return j(500, { ok: false, id, error: "vercel_hook_missing" });
      }
      const r = await fetch(VERCEL_DEPLOY_HOOK, { method: "POST", cache: "no-store" });
      if (!r.ok) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ status: "failed", progress_percent: 100 }]);
        return j(502, { ok: false, id, error: "vercel_deploy_failed", status: r.status });
      }
      // 視你的流程：若希望 deploy 即視為完成，直接結案
      await sb("PATCH", `r5_runs?id=eq.${id}`, [{
        status: "completed",
        step_index: 1,
        progress_percent: 100
      }]);
      return j(200, { ok: true, id });
    }

    if (op === "gh_dispatch") {
      if (!GH_TOKEN || !GH_OWNER || !GH_REPO || !workflow_id) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ status: "failed", progress_percent: 100 }]);
        return j(500, { ok: false, id, error: "github_env_missing" });
      }
      const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(workflow_id)}/dispatches`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "r5-gateway",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref }),
        cache: "no-store",
      });
      if (!r.ok && r.status !== 204) {
        await sb("PATCH", `r5_runs?id=eq.${id}`, [{ status: "failed", progress_percent: 100 }]);
        return j(502, { ok: false, id, error: "gh_dispatch_failed", status: r.status });
      }
      await sb("PATCH", `r5_runs?id=eq.${id}`, [{ step_index: 1, progress_percent: 30 }]);
      return j(200, { ok: true, id });
    }

    return j(400, { ok: false, error: "unsupported_op" });
  } catch (e: any) {
    return j(500, { ok: false, error: e?.message || "internal_error" });
  }
}
