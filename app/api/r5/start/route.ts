// app/api/r5/start/route.ts
import { json } from "../_core";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { goal, mode = "auto", max_steps = 50, branch = "main" } = body;

  if (!goal) return json({ ok: false, error: "goal is required" }, 400);

  // TODO: 寫入 Supabase（或你慣用的存儲），這裡先用記憶體/回傳樣例
  const run_id = randomUUID();

  // 你實作：insert 到 r5_runs 表，status="queued"/"planning"，步驟初稿存 steps JSON
  // steps 例：[{kind:"gh:dispatch", workflow:"r5-smoke.yml", ref:"main"}, {kind:"vercel:promote"}]

  return json({ ok: true, run_id, status: "planning", goal, mode, max_steps, branch });
}
