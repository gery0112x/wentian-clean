import { NextRequest, NextResponse } from "next/server";

const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO  = process.env.GH_REPO  || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";

export async function GET(_req: NextRequest, { params }: { params: { run_id: string } }) {
  if (!GH_TOKEN) return NextResponse.json({ ok:false, error:"github_token_missing" }, { status:500 });
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${params.run_id}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent":"r5-gateway" },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ ok:false, error:"github_api_failed", status:r.status }, { status:502 });
  const x = await r.json();
  const data = {
    id: x.id,
    status: x.status,
    conclusion: x.conclusion,
    html_url: x.html_url,
    created_at: x.created_at,
    updated_at: x.updated_at,
  };
  return NextResponse.json({ ok: true, data });
}
