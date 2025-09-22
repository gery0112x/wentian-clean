// app/r5/check/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Baseline = {
  ok: boolean;
  data: {
    ok: boolean;
    enforced: boolean;
    repo: { owner: string|null; repo: string|null };
    sources: Record<string,string>;
    spec: { present: boolean; version: string|null };
    pipeline: { present_json: boolean; present_mmd: boolean; version: string|null };
    errors: { latest_path: string|null; open_count: number; open_blockers: number };
  };
};

type RunResp = { ok: boolean; id?: string; error?: string; status?: number };

export default function Page() {
  const [base, setBase] = useState<Baseline|null>(null);
  const [pingOk, setPingOk] = useState<boolean|null>(null);
  const [healthOk, setHealthOk] = useState<boolean|null>(null);

  const [wf, setWf] = useState("r5.yml");
  const [ref, setRef] = useState("main");
  const [goal, setGoal] = useState("deploy main");
  const [runId, setRunId] = useState<string>("");
  const [runState, setRunState] = useState<any|null>(null);
  const [busy, setBusy] = useState(false);

  async function doFetch<T=any>(url:string, init?:RequestInit): Promise<T|null> {
    try {
      const r = await fetch(url, { ...init, cache: "no-store" });
      if (!r.ok) return await r.json().catch(()=>null);
      return await r.json();
    } catch { return null; }
  }

  async function loadBasics() {
    const b = await doFetch<Baseline>("/api/r5/baseline/verify");
    setBase(b || null);
    const p = await doFetch("/api/r5/ping");
    setPingOk(!!p?.ok);
    const h = await doFetch("/api/r5/health");
    setHealthOk(!!h?.ok);
  }

  useEffect(() => { loadBasics(); }, []);

  // 輪詢 runs/{id}
  useEffect(() => {
    if (!runId) return;
    let stop = false;
    const tick = async () => {
      const r = await doFetch(`/api/r5/runs/${runId}`);
      if (stop || !r?.ok) return;
      setRunState(r?.data || null);
      const s = String(r?.data?.status||"");
      if (["completed","failed","cancelled"].includes(s)) return; // 終態，不再輪詢
      setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; };
  }, [runId]);

  const allGreen = useMemo(() => {
    return !!(base?.data?.ok && pingOk && healthOk);
  }, [base, pingOk, healthOk]);

  async function startGh() {
    setBusy(true); setRunId(""); setRunState(null);
    const body = { op: "gh_dispatch", goal, workflow_id: wf, ref };
    const r = await doFetch<RunResp>("/api/r5/start", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    setBusy(false);
    if (r?.ok && r?.id) setRunId(r.id);
    else alert(`start failed: ${r?.error || "unknown"}`);
  }

  async function startVercel() {
    setBusy(true); setRunId(""); setRunState(null);
    const r = await doFetch<RunResp>("/api/r5/start", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "vercel_deploy", goal })
    });
    setBusy(false);
    if (r?.ok && r?.id) setRunId(r.id);
    else alert(`start failed: ${r?.error || "unknown"}`);
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">R5 一鍵檢查 / 任務台</h1>

      <section className="mb-6 p-4 rounded-xl border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">A1｜基準檢查</h2>
          <button className="px-3 py-1 rounded border" onClick={loadBasics}>重新檢查</button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div>baseline.ok：<b className={base?.data?.ok ? "text-green-600" : "text-red-600"}>{String(base?.data?.ok)}</b>（enforced={String(base?.data?.enforced)}）</div>
          <div>/api/r5/ping：<b className={pingOk ? "text-green-600":"text-red-600"}>{String(pingOk)}</b>；/api/r5/health：<b className={healthOk ? "text-green-600":"text-red-600"}>{String(healthOk)}</b></div>
          <div>spec：{base?.data?.spec?.present ? "✅" : "❌"} v{base?.data?.spec?.version || "-"}</div>
          <div>pipeline.json：{base?.data?.pipeline?.present_json ? "✅" : "❌"}；pipeline.mmd：{base?.data?.pipeline?.present_mmd ? "✅" : "❌"} v{base?.data?.pipeline?.version || "-"}</div>
          <div>repo：{base?.data?.repo?.owner || "?"}/{base?.data?.repo?.repo || "?"}（來源：{JSON.stringify(base?.data?.sources)}）</div>
          <div>errors：path={base?.data?.errors?.latest_path || "-"}，open={base?.data?.errors?.open_count}，blockers=<b className={base?.data?.errors?.open_blockers ? "text-red-600":"text-green-600"}>{base?.data?.errors?.open_blockers}</b></div>
          {!allGreen && <div className="text-amber-700 mt-2">⚠️ 尚未通過：請把 <code>errors.jsonl</code> 中阻斷項改成 <code>"state":"fixed"</code> 或修好環境（hook、GH token）。</div>}
        </div>
      </section>

      <section className="mb-6 p-4 rounded-xl border">
        <h2 className="font-semibold">A2/A3｜發任務與追蹤</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <label className="block">workflow_id
            <input value={wf} onChange={e=>setWf(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="r5.yml" />
          </label>
          <label className="block">ref
            <input value={ref} onChange={e=>setRef(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="main" />
          </label>
          <label className="block">goal
            <input value={goal} onChange={e=>setGoal(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="deploy main" />
          </label>
        </div>
        <div className="mt-3 flex gap-3">
          <button disabled={busy} onClick={startGh} className="px-3 py-1 rounded border">Start（GitHub）</button>
          <button disabled={busy} onClick={startVercel} className="px-3 py-1 rounded border">Start（Vercel Hook）</button>
        </div>

        {runId && (
          <div className="mt-4 text-sm">
            <div>run id：<code>{runId}</code></div>
            <div className="mt-1">狀態：{runState ? (
              <>
                <b>{runState.status}</b> ｜ step {runState.step_index}/{runState.total_steps ?? "?"} ｜ {runState.progress_percent}%
              </>
            ) : "讀取中…"}</div>
          </div>
        )}
      </section>

      <section className="p-4 rounded-xl border">
        <h2 className="font-semibold">A4｜備援（Vercel Deploy Hook）</h2>
        <p className="text-sm text-gray-600">若 GitHub 有問題，可用上面的「Start（Vercel Hook）」快速驗證。</p>
      </section>
    </main>
  );
}
