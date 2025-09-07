import { NextResponse } from "next/server";
export const runtime = "nodejs";

const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const num = (x:any, d=0)=>{ const n=Number(x); return Number.isFinite(n)?n:d; };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.origin;

  // 參數：最多呼叫幾次、每次間隔(毫秒)
  const max = Math.min(num(url.searchParams.get("max"), 60), 200);
  const gap = Math.min(num(url.searchParams.get("gap_ms"), 50), 2000);

  const cap_per_turn_local = num(process.env.WUJI_COST_CAP_PER_TURN, 0);
  const currency = (process.env.WUJI_CURRENCY || "USD").toUpperCase();

  let ok=0, fail=0, triggered=false;
  const details:any[] = [];
  const t0 = Date.now();

  for (let i=1;i<=max;i++){
    const t1 = Date.now();
    try{
      // 只打你自己的 Gateway 主通道（不直連供應商）
      const r = await fetch(`${base}/api/chat?q=ping&i=${i}`, { cache:"no-store" });
      const j = await r.json().catch(()=>({}));

      const cost_local = num(j?.cost_local, 0);
      ok += r.ok ? 1 : 0;
      fail += r.ok ? 0 : 1;

      details.push({ i, status:r.status, ms: Date.now()-t1, cost_local, sample: j?.reply ?? j?.msg ?? null });

      // 「每回合上蓋」是單次呼叫的上限 → 當次成本 >= 上蓋 就算觸發
      if (cap_per_turn_local > 0 && cost_local >= cap_per_turn_local) { triggered = true; break; }
    }catch(e:any){
      fail += 1;
      details.push({ i, status:"ERR", ms: Date.now()-t1, error: String(e?.message||e) });
    }
    if (i<max) await sleep(gap);
  }

  const report = {
    currency, cap_per_turn_local,
    triggered, calls_done: ok+fail, ok, fail,
    avg_ms: Math.round((Date.now()-t0)/Math.max(ok+fail,1)),
    hint_zh: !cap_per_turn_local
      ? "尚未設定每回合上蓋(WUJI_COST_CAP_PER_TURN)。"
      : (triggered ? "已觸發上蓋（單次成本達到上限）。" : "尚未觸發：把上蓋設得更小一點再試。"),
    ts: new Date().toISOString()
  };

  return NextResponse.json({ report, details }, { status: 200 });
}
