// app/api/r5/next/route.ts
import { json } from "../_core";

export async function POST(req: Request) {
  const { run_id } = await req.json().catch(() => ({}));
  if (!run_id) return json({ ok: false, error: "run_id required" }, 400);

  // TODO: 讀取該 run 當前狀態與下一步
  // - 若下一步是 gh:dispatch → 呼叫你已有的 /api/r5/gh/workflows/{workflow_id}/dispatch
  // - 標記 status="waiting_external"，記錄 external_run_id / waits
  // - 若等待中的任務完成（用 GH API 查或 webhook 回推），就前進下一步
  // - 直到全部步驟完成 → status="success"

  // 這裡回傳最新狀態（讓 GPT 有「進度條」資訊）
  return json({
    ok: true,
    run_id,
    status: "executing",
    progress: { percent: 55, message: "Workflow dispatched, waiting for completion" },
  });
}
