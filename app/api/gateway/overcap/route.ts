import { NextResponse } from "next/server";
export const runtime = "nodejs";

// 小白註解：這個端點會連續去打你自己的 /api/chat，直到超過「每回合上蓋」為止
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
function num(x:any, d=0){ const n = Number(x); return isFinite(n) ? n : d; }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.origin;

  // 可調參數：最多打幾次、每次間隔（毫秒）
  const max = Math.min(num(url.searchParams.get("max"), 120), 200);
  const gap = Math.min(num(url.searchParams.get("gap_ms"), 50), 2000);

  // 從環境變數讀上蓋（cap，上限）
  const cap_per_turn_local = num(process.env.WUJI_COST_CAP_PER_TURN, 0); // 以你設定的「本地幣別」解讀
  const currency = (process.env.WUJI_CURRENCY || "USD").toUpperCase();
  const fx = num(process.env.WUJI_FX_USD_TWD, 32); // 美金→台幣匯率（若你用 NTD）

  // 統計
  let ok=0, fail=0;
  let cum_cost_local = 0;
  let cum_cost_usd = 0;
  let cum_tokens_in = 0, cum_tokens_out = 0;
  const details:any[] = [];

  const t0 = Date.now();
  let triggered = false;

  for (let i=1; i<=max; i++){
    const t1 = Date.now();
    try{
      // 直接呼叫你自己的 Gateway 主通道 /api/chat（不直連供應商）
      const r = await fetch(`${base}/api/chat?q=ping&i=${i}`, { cache:"no-store" });
      const j = await r.json().catch(()=> ({} as any));

      const tokens_in  = num(j?.usage?.prompt_tokens, 0);
      const tokens_out = num(j?.usage?.completion_tokens, 0);
      const cost_local = num(j?.cost_local, 0);          // 你現有通道已會回這個欄位
      const cost_usd   = num(j?.cost_usd, 0);            // 若沒有就維持 0

      ok += r.ok ? 1 : 0;
      fail += r.ok ? 0 : 1;

      cum_tokens_in  += tokens_in;
      cum_tokens_out += tokens_out;
      cum_cost_local += cost_local;
      cum_cost_usd   += cost_usd;

      const ms = Date.now() - t1;
      details.push({ i, status:r.status, ms, cost_local, tokens_in, tokens_out, sample: j?.reply ?? j?.msg ?? null });

      // 判斷是否觸發「每回合上蓋」（以本地幣別解讀）
      if (cap_per_turn_local > 0 && cost_local >= cap_per_turn_local) {
        triggered = true;
        break;
      }
    }catch(e:any){
      fail += 1;
      details.push({ i, status:"ERR", ms: Date.now()-t1, error: String(e?.message||e) });
    }
    if (i<max) await sleep(gap);
  }

  const ms_total = Date.now() - t0;
  const report = {
    currency, cap_per_turn_local,
    triggered,                       // 是否「已觸發上蓋」
    calls_done: ok+fail, ok, fail,
    avg_ms: Math.round(ms_total / Math.max(ok+fail,1)),
    cum_cost_local: Number(cum_cost_local.toFixed(6)),
    cum_cost_usd: Number(cum_cost_usd.toFixed(6)),
    cum_tokens_in, cum_tokens_out,
    hint_zh: !cap_per_turn_local
      ? "你沒有設定每回合上蓋(WUJI_COST_CAP_PER_TURN)；請先在 Vercel 設一個很小的數值，例如 0.001，再重試。"
      : (triggered ? "已觸發上蓋：本次呼叫單價已達每回合上蓋，視為應擋/降級。" : "尚未觸發上蓋：單次成本低於上蓋，建議把上蓋設更小或調大 max 參數重試。"),
    ts: new Date().toISOString()
  };

  return NextResponse.json({ report, details }, { status: 200 });
}
