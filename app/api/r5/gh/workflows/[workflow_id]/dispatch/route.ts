import { NextRequest } from "next/server";

const { GH_OWNER, GH_REPO, GH_TOKEN } = process.env;

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workflow_id: string } }
) {
  if (!GH_OWNER || !GH_REPO || !GH_TOKEN) {
    return j(500, {
      ok: false,
      error: { code: "CFG_MISSING", msg: "GH_OWNER/GH_REPO/GH_TOKEN 未設定" },
    });
  }

  const { inputs, ref } = (await req.json().catch(() => ({}))) as {
    inputs?: Record<string, unknown>;
    ref?: string;
  };

  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(
    params.workflow_id
  )}/dispatches`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: ref || "main", inputs }),
  });

  if (r.ok) {
    return j(200, { ok: true, data: { workflow_id: params.workflow_id, ref: ref || "main" } });
  }
  const text = await r.text();
  return j(r.status, { ok: false, error: { code: `GH_${r.status}`, msg: text } });
}
