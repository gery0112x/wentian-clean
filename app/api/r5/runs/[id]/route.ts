import { NextRequest, NextResponse } from "next/server";

function j(status: number, body: unknown) { return NextResponse.json(body, { status }); }
const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO  = process.env.GH_REPO  || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";

async function sbSelectById(id: string) {
  const r = await fetch(`${SB_URL}/rest/v1/r5_runs?id=eq.${id}&select=*`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-store",
  });
  const rows = await r.json();
  return rows[0];
}
async function sbPatch(id: string, patch: any) {
  await fetch(`${SB_URL}/rest/v1/r5_runs?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([patch]),
    cache: "no-store",
  });
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const row = await sbSelectById(id);
  if (!row) return j(404, { ok: false, error: "not_found" });

  let { op, state, step, total_steps, percent, workflow_id, gh_run_id, meta } = row;

  // 若是 GitHub 任務，動態查 run 狀態並更新
  if (op === "gh_dispatch" && GH_TOKEN && GH_OWNER && GH_REPO && workflow_id) {
    // 尚未綁定 run_id → 抓最新一筆 workflow run 當候選
    if (!gh_run_id) {
      const rr = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(workflow_id)}/runs?per_page=1`,
        { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" }, cache: "no-store" }
      );
      if (rr.ok) {
        const js = await rr.json();
        const run = js?.workflow_runs?.[0];
        if (run?.id) {
          gh_run_id = run.id;
          await sbPatch(id, { gh_run_id });
        }
      }
    }
    if (gh_run_id) {
      const gr = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${gh_run_id}`,
        { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" }, cache: "no-store" }
      );
      if (gr.ok) {
        const run = await gr.json();
        const status = run.status as string;       // queued / in_progress / completed
        const conclusion = run.conclusion as string | null; // success / failure / cancelled / null
        // 映射進度
        if (status === "queued")  { state = "running"; step = 2; percent = 30; }
        if (status === "in_progress") { state = "running"; step = 3; percent = 70; }
        if (status === "completed") {
          state = conclusion === "success" ? "completed" : (conclusion === "cancelled" ? "cancelled" : "failed");
          step = 3; percent = state === "completed" ? 100 : 100;
        }
        total_steps = 3;
        await sbPatch(id, { state, step, total_steps, percent });
      }
    }
  }

  return j(200, { ok: true, data: { id, state, step, total_steps, percent, updated_at: new Date().toISOString() } });
}
