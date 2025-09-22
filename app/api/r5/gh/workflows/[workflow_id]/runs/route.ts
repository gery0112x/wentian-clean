import { NextRequest, NextResponse } from "next/server";

const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO  = process.env.GH_REPO  || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";

export async function GET(req: NextRequest, { params }: { params: { workflow_id: string } }) {
  if (!GH_TOKEN) return NextResponse.json({ ok:false, error:"github_token_missing" }, { status:500 });
  const limit = Math.max(1, Math.min(20, Number(new URL(req.url).searchParams.get("limit") || 5)));
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(params.workflow_id)}/runs?per_page=${limit}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent":"r5-gateway" },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ ok:false, error:"github_api_failed", status:r.status }, { status:502 });
  const js = await r.json();
  const runs = (js?.workflow_runs || []).map((x: any) => ({
    id: x.id,
    status: x.status,
    conclusion: x.conclusion,
    html_url: x.html_url,
    created_at: x.created_at,
    updated_at: x.updated_at,
  }));
  return NextResponse.json({ ok: true, total: runs.length, runs });
}
