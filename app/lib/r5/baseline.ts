// app/lib/r5/baseline.ts
import { promises as fs } from "fs";
import path from "path";

const GH_OWNER = process.env.GH_OWNER || "";
const GH_REPO  = process.env.GH_REPO  || "";
const GH_TOKEN = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";
const ENFORCE  = (process.env.R5_BASELINE_ENFORCE ?? "1") !== "0";

const SPEC_PATH      = "docs/r5/r5-spec.v2.2.1.yaml";
const PIPE_MMD_PATH  = "docs/r5/pipeline/r5-pipeline.v2.2.1.mmd";
const PIPE_JSON_PATH = "docs/r5/pipeline/r5-pipeline.v2.2.1.json";

async function readLocal(relPath: string): Promise<string | null> {
  try {
    const abs = path.join(process.cwd(), relPath);
    return await fs.readFile(abs, "utf-8");
  } catch { return null; }
}

async function fetchGitHubRaw(relPath: string): Promise<string | null> {
  if (!GH_OWNER || !GH_REPO) return null;
  const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/${relPath}`;
  const r = await fetch(url, {
    headers: GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent":"r5-baseline" } : { "User-Agent":"r5-baseline" },
    cache: "no-store",
  });
  if (!r.ok) return null;
  return await r.text();
}

async function readFileFlexible(relPath: string): Promise<string | null> {
  return (await readLocal(relPath)) ?? (await fetchGitHubRaw(relPath));
}

async function findLatestErrorsPathLocal(): Promise<string | null> {
  try {
    const base = path.join(process.cwd(), "coldstore");
    const years = (await fs.readdir(base)).filter(d => /^\d{4}$/.test(d)).sort().reverse();
    for (const y of years) {
      const yDir = path.join(base, y);
      const months = (await fs.readdir(yDir)).filter(d => /^\d{2}$/.test(d)).sort().reverse();
      for (const m of months) {
        const mDir = path.join(yDir, m);
        const days = (await fs.readdir(mDir)).filter(d => /^\d{2}$/.test(d)).sort().reverse();
        for (const d of days) {
          const fp = path.join(mDir, d, "errors.jsonl");
          try { await fs.access(fp); return path.relative(process.cwd(), fp).replace(/\\/g,"/"); } catch {}
        }
      }
    }
  } catch {}
  return null;
}

async function findLatestErrorsPathRemote(): Promise<string | null> {
  if (!GH_OWNER || !GH_REPO) return null;
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/trees/main?recursive=1`;
  const r = await fetch(url, {
    headers: GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}`, Accept:"application/vnd.github+json", "User-Agent":"r5-baseline" } : { "User-Agent":"r5-baseline" },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const js: any = await r.json();
  const paths: string[] = (js?.tree || [])
    .filter((t: any) => t?.type === "blob" && typeof t?.path === "string" && t.path.endsWith("errors.jsonl"))
    .map((t: any) => t.path)
    .sort()
    .reverse();
  return paths[0] || null;
}

function parseYAMLVersion(yamlText: string | null): string | null {
  if (!yamlText) return null;
  const m = yamlText.match(/^\s*version:\s*([^\s#]+)/m);
  return m ? m[1] : null;
}

function parseJSON(text: string | null): any | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function parseJSONL(text: string | null): any[] {
  if (!text) return [];
  const out: any[] = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim(); if (!s) continue;
    try { out.push(JSON.parse(s)); } catch {}
  }
  return out;
}

export async function verifyBaseline() {
  // 1) 讀 3 份基準檔
  const specText  = await readFileFlexible(SPEC_PATH);
  const mmdText   = await readFileFlexible(PIPE_MMD_PATH);
  const pjText    = await readFileFlexible(PIPE_JSON_PATH);
  const pjObj     = parseJSON(pjText);

  // 2) 找最新 errors.jsonl
  const latestErrorsPath = (await findLatestErrorsPathLocal()) ?? (await findLatestErrorsPathRemote());
  const errorsText = latestErrorsPath ? await readFileFlexible(latestErrorsPath) : null;
  const errors = parseJSONL(errorsText);

  // 3) 統計
  const specVersion     = parseYAMLVersion(specText);
  const pipelineVersion = typeof pjObj?.version === "string" ? pjObj.version : null;

  let open_count = 0, open_blockers = 0;
  const BLOCKER_NEXT = new Set(["create_ping_health","verify_deploy_hook_url","fix_github_env"]);
  for (const e of errors) {
    if (e?.state === "open") {
      open_count++;
      const sev = String(e?.severity || "blocker").toLowerCase();
      if (sev === "blocker" || sev === "critical" || BLOCKER_NEXT.has(e?.next)) open_blockers++;
    }
  }

  const hasSpec  = !!specText;
  const hasMMD   = !!mmdText;
  const hasPJSON = !!pjObj;
  const ok = hasSpec && hasMMD && hasPJSON && open_blockers === 0;

  return {
    ok,
    enforced: ENFORCE,
    spec: { present: hasSpec, version: specVersion },
    pipeline: { present_json: hasPJSON, present_mmd: hasMMD, version: pipelineVersion },
    errors: { latest_path: latestErrorsPath, open_count, open_blockers }
  };
}

export async function ensureBaselineOk() {
  const r = await verifyBaseline();
  if (!ENFORCE) return { ...r, ok: true };
  return r;
}
