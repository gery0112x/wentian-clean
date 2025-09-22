// app/lib/r5/baseline.ts
import { promises as fs } from "fs";
import path from "path";

// ===== repo/權限環境 =====
// 你原本手動設定（可留空）
const GH_OWNER_MANUAL = process.env.GH_OWNER || "";
const GH_REPO_MANUAL  = process.env.GH_REPO  || "";
const GH_TOKEN        = process.env.R5_ACTIONS_TOKEN || process.env.GH_TOKEN || "";

// Vercel / GitHub 內建偵測（自動抓）
const VERCEL_OWNER = process.env.VERCEL_GIT_REPO_OWNER || "";
const VERCEL_REPO  = process.env.VERCEL_GIT_REPO_SLUG  || "";
const GH_REPO_FULL = process.env.GITHUB_REPOSITORY || ""; // e.g. owner/repo (在 GH Actions 環境)

const GH_OWNER_EFF =
  GH_OWNER_MANUAL ||
  (GH_REPO_FULL.includes("/") ? GH_REPO_FULL.split("/")[0] : "") ||
  VERCEL_OWNER;

const GH_REPO_EFF =
  GH_REPO_MANUAL ||
  (GH_REPO_FULL.includes("/") ? GH_REPO_FULL.split("/")[1] : "") ||
  VERCEL_REPO;

const ENFORCE  = (process.env.R5_BASELINE_ENFORCE ?? "1") !== "0";

// ===== 基準檔相對路徑 =====
const SPEC_PATH      = "docs/r5/r5-spec.v2.2.1.yaml";
const PIPE_MMD_PATH  = "docs/r5/pipeline/r5-pipeline.v2.2.1.mmd";
const PIPE_JSON_PATH = "docs/r5/pipeline/r5-pipeline.v2.2.1.json";

// ===== helpers =====
async function readLocal(relPath: string): Promise<string | null> {
  try {
    const abs = path.join(process.cwd(), relPath);
    return await fs.readFile(abs, "utf-8");
  } catch { return null; }
}

async function fetchGitHubRaw(relPath: string): Promise<string | null> {
  if (!GH_OWNER_EFF || !GH_REPO_EFF) return null;
  const url = `https://raw.githubusercontent.com/${GH_OWNER_EFF}/${GH_REPO_EFF}/main/${relPath}`;
  const headers: Record<string, string> = { "User-Agent": "r5-baseline" };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;
  const r = await fetch(url, { headers, cache: "no-store" });
  if (!r.ok) return null;
  return await r.text();
}

// 優先拉 GitHub（serverless 環境通常讀不到本地檔案）
async function readFileFlexible(relPath: string): Promise<{text: string|null, source: "github"|"local"|"none"}> {
  const fromGit = await fetchGitHubRaw(relPath);
  if (fromGit !== null) return { text: fromGit, source: "github" };
  const fromLocal = await readLocal(relPath);
  if (fromLocal !== null) return { text: fromLocal, source: "local" };
  return { text: null, source: "none" };
}

async function findLatestErrorsPathRemote(): Promise<string | null> {
  if (!GH_OWNER_EFF || !GH_REPO_EFF) return null;
  const url = `https://api.github.com/repos/${GH_OWNER_EFF}/${GH_REPO_EFF}/git/trees/main?recursive=1`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "r5-baseline" };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;
  const r = await fetch(url, { headers, cache: "no-store" });
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
  // 1) 讀三份基準（優先 GitHub Raw）
  const spec      = await readFileFlexible(SPEC_PATH);
  const pipeMmd   = await readFileFlexible(PIPE_MMD_PATH);
  const pipeJson  = await readFileFlexible(PIPE_JSON_PATH);
  const pipeObj   = parseJSON(pipeJson.text);

  // 2) 找最新 errors.jsonl（GitHub 列樹）
  const latestErrorsPath = await findLatestErrorsPathRemote();
  const errorsFile = latestErrorsPath ? await readFileFlexible(latestErrorsPath) : { text: null, source: "none" as const };
  const errors = parseJSONL(errorsFile.text);

  // 3) 統計
  const specVersion     = parseYAMLVersion(spec.text);
  const pipelineVersion = typeof pipeObj?.version === "string" ? pipeObj.version : null;

  let open_count = 0, open_blockers = 0;
  const BLOCKER_NEXT = new Set(["create_ping_health","verify_deploy_hook_url","fix_github_env"]);
  for (const e of errors) {
    if (e?.state === "open") {
      open_count++;
      const sev = String(e?.severity || "blocker").toLowerCase();
      if (sev === "blocker" || sev === "critical" || BLOCKER_NEXT.has(e?.next)) open_blockers++;
    }
  }

  const hasSpec  = !!spec.text;
  const hasMMD   = !!pipeMmd.text;
  const hasPJSON = !!pipeObj;
  const ok = hasSpec && hasMMD && hasPJSON && open_blockers === 0;

  return {
    ok,
    enforced: ENFORCE,
    repo: { owner: GH_OWNER_EFF || null, repo: GH_REPO_EFF || null },
    sources: {
      spec: spec.source,
      pipeline_mmd: pipeMmd.source,
      pipeline_json: pipeJson.source,
      errors_jsonl: errorsFile.source,
    },
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
