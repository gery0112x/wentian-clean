// app/api/r5/runs/[id]/route.ts
import { json } from "../../_core";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const run_id = ctx.params.id;

  // TODO: 從 Supabase 撈 run 狀態與進度（percent/message、steps、step_index、waits、logs_url…）
  const sample = {
    run_id,
    status: "waiting_external",
    step_index: 0,
    steps: [{ kind: "gh:dispatch", workflow: "r5-smoke.yml", ref: "main" }],
    progress: { percent: 40, message: "GitHub Actions running…" },
    waits: ["gh:run#77"],
    logs_url: "https://github.com/…/actions/runs/xxxx",
  };

  return json(sample);
}
