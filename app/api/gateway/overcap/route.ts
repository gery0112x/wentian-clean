import { NextResponse } from "next/server";
export const runtime = "nodejs";

const num = (x: any, d = 0) => { const n = Number(x); return Number.isFinite(n) ? n : d; };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.origin;

  // 允許用網址直接覆寫上蓋：?cap_override_local=0.0001
  const cap_override = num(url.searchParams.get("cap_override_local"), 0);
  const cap_per_turn_local_env = num(process.env.WUJI_COST_CAP_PER_TURN, 0);
  const cap_effective = cap_override > 0 ? cap_override : cap_per_turn_local_env;

  // 只打一槍（避免在無伺服器平台超時）
  let call_status = 0, call_cost_local = 0, reply: any = null, ms = 0;
  const t0 = Date.now();
  try {
    const r = await fetch(`${base}/api/chat?q=ping&overcap=1`, { cache: "no-store" });
    call_status = r.status;
    const j: any = await r.json().catch(() => ({}));
    call_cost_local = num(j?.cost_local, 0);
    reply = j?.reply ?? j?.msg ?? null;
  } catch (e: any) {
    return NextResponse.json({ report: {
      triggered: false,
      cap_per_turn_local: cap_effective,
      call_status: "ERR",
      hint_zh: `呼叫 /api/chat 失敗：${String(e?.message || e)}`
    }}, { status: 200 });
  }
  ms = Date.now() - t0;

  const triggered = cap_effective > 0 && call_cost_local >= cap_effective;
  const report = {
    currency: (process.env.WUJI_CURRENCY || "USD").toUpperCase(),
    cap_per_turn_local: cap_effective,
    call_status,
    call_cost_local: Number(call_cost_local.toFixed(6)),
    triggered,
    avg_ms: ms,
    hint_zh: cap_effective === 0
      ? "尚未設定每回合上蓋(WUJI_COST_CAP_PER_TURN)。可用 cap_override_local=0.0001 測試。"
      : (triggered ? "已觸發上蓋（單次成本達到上限）。" : "尚未觸發：把上蓋設更小或用 cap_override_local 測。"),
    ts: new Date().toISOString()
  };

  return NextResponse.json({ report, sample: reply });
}
