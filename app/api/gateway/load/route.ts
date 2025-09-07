import { NextResponse } from "next/server";
export const runtime = "nodejs";

// 小白註解：這個端點會自動去打 /api/chat?q=ping N 次，回一份白話日報
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = Math.min(Number(url.searchParams.get("n") ?? 5), 20); // 預設 5 次，上限 20 次
  const gap = Math.min(Number(url.searchParams.get("gap_ms") ?? 200), 2000); // 每次間隔
  const base = url.origin;

  const caps = {
    per_turn: Number(process.env.WUJI_COST_CAP_PER_TURN ?? 0),
    per_day: Number(process.env.WUJI_DAILY_COST_CAP ?? 0),
    per_month: Number(process.env.WUJI_MONTHLY_COST_CAP ?? 0),
  };

  let ok = 0, fail = 0;
  const details: any[] = [];
  const t0 = Date.now();

  for (let i=1;i<=n;i++){
    const t1 = Date.now();
    try{
      const r = await fetch(`${base}/api/chat?q=ping&i=${i}`, { cache:"no-store" });
      const j = await r.json().catch(()=>({}));
      ok += r.ok ? 1 : 0;
      fail += r.ok ? 0 : 1;
      details.push({ i, status:r.status, ms: Date.now()-t1, sample: j?.reply ?? j?.msg ?? null });
    }catch(e:any){
      fail += 1;
      details.push({ i, status: "ERR", ms: Date.now()-t1, error: String(e?.message||e) });
    }
    if (i<n) await sleep(gap);
  }

  const ms_total = Date.now()-t0;
  const report = {
    ok, fail, total:n,
    avg_ms: Math.round(ms_total/Math.max(n,1)),
    caps,
    hint_zh: fail===0 ? "造流成功，未見錯誤；可進一步測試上蓋與降級" : "發現失敗請貼給我，我給一次到位修正檔",
    ts: new Date().toISOString()
  };

  return NextResponse.json({ report, details }, { status: 200 });
}
