const { GH_OWNER, GH_REPO, GH_TOKEN } = process.env;

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(_: Request, { params }: { params: { run_id: string } }) {
  if (!GH_OWNER || !GH_REPO || !GH_TOKEN) {
    return j(500, {
      ok: false,
      error: { code: "CFG_MISSING", msg: "GH_OWNER/GH_REPO/GH_TOKEN 未設定" },
    });
  }

  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${encodeURIComponent(
    params.run_id
  )}`;

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (r.ok) {
    const data = await r.json();
    return j(200, { ok: true, data });
  }
  const text = await r.text();
  return j(r.status, { ok: false, error: { code: `GH_${r.status}`, msg: text } });
}
