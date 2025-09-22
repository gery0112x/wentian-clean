// app/api/r5/start/route.ts
import { NextRequest, NextResponse } from "next/server";
function j(status:number, body:unknown){ return NextResponse.json(body, {status}); }

const SB_URL_RAW = process.env.SUPABASE_URL || "";
const SB_BASE = SB_URL_RAW.replace(/\/rest\/v1\/?$/i, "");
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO  = process.env.GH_REPO  || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";
const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK || "";

async function sb(method:string, path:string, body?:any) {
  if(!SB_BASE || !SB_KEY) throw new Error("supabase_env_missing");
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
  const json = (()=>{ try { return JSON.parse(text); } catch { return text; }})();
  if(!res.ok) throw new Error(`postgrest_${method}_${res.status}:${typeof json==='string'?json:JSON.stringify(json)}`);
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const { op, workflow_id, ref = "main", goal:goalIn } = await req.json();
    if(!op) return j(400,{ ok:false, error:"op_required" });

    // 與 DB 對齊：若你的欄位叫 status 而非 state，請把下兩處 state 換成 status
    const goal =
      goalIn ??
      (op === "vercel_deploy"
        ? "Deploy Vercel"
        : `Run GitHub workflow: ${workflow_id || ""}`);

    const useDB = !!(SB_BASE && SB_KEY);
    const totalSteps = op === "gh_dispatch" ? 3 : 1;
    let id = `tmp_${Date.now()}`;

    if (useDB){
      const [row] = await sb("POST","r5_runs",[{
        op,
        goal,                 // ← 關鍵：補上 goal
        state: "running",     // 若你的表叫 status，改成 status: "running"
        step: 1,
        total_steps: totalSteps,
        percent: op==="gh_dispatch"?10:0,
        workflow_id: workflow_id || null,
        meta:{ ref },
      }]);
      id = row.id as string;
    }

    if (op === "vercel_deploy"){
      if(!VERCEL_DEPLOY_HOOK) return j(500,{ ok:false, id, error:"vercel_hook_missing" });
      const r = await fetch(VERCEL_DEPLOY_HOOK, { method:"POST", cache:"no-store" });
      if(!r.ok) return j(502,{ ok:false, id, error:"vercel_deploy_failed", status:r.status });
      if (useDB) await sb("PATCH",`r5_runs?id=eq.${id}`,[{ step:1, total_steps:1, percent:100, state:"completed" }]); // 若是 status，請一起改
      return j(200,{ ok:true, id });
    }

    if (op === "gh_dispatch"){
      if(!GH_TOKEN || !GH_OWNER || !GH_REPO || !workflow_id){
        if (useDB) await sb("PATCH",`r5_runs?id=eq.${id}`,[{ state:"failed", percent:100 }]); // 同上，必要時換成 status
        return j(500,{ ok:false, id, error:"github_env_missing" });
      }
      const r = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(workflow_id)}/dispatches`,
        { method:"POST", headers:{ Authorization:`Bearer ${GH_TOKEN}`, Accept:"application/vnd.github+json", "User-Agent":"r5-gateway" }, body: JSON.stringify({ ref }), cache:"no-store" }
      );
      if (!r.ok && r.status !== 204){
        if (useDB) await sb("PATCH",`r5_runs?id=eq.${id}`,[{ state:"failed", percent:100 }]);
        return j(502,{ ok:false, id, error:"gh_dispatch_failed", status:r.status });
      }
      if (useDB) await sb("PATCH",`r5_runs?id=eq.${id}`,[{ step:2, percent:30 }]);
      return j(200,{ ok:true, id });
    }

    return j(400,{ ok:false, error:"unsupported_op" });
  } catch (e:any) {
    return j(500,{ ok:false, error: e?.message || "internal_error" });
  }
}
