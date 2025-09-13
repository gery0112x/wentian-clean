// scripts/pwa-health.mjs
// Node >=18 (使用內建 fetch)
// 目的：驗證 PWA 最小可安裝條件（manifest / icons / diag）
//
// 使用：BASE_URL=https://wentian-clean.vercel.app node scripts/pwa-health.mjs
// 或   node scripts/pwa-health.mjs https://wentian-clean.vercel.app

import fs from "node:fs";

const baseArg = process.argv[2];
const BASE = (process.env.BASE_URL || baseArg || "http://localhost:3000").replace(/\/+$/,"");
const TIMEOUT_MS = 12000;

const notes = [];
const errs  = [];

function logOK(s){ notes.push(`✅ ${s}`); }
function logNG(s){ errs.push(`❌ ${s}`); }

function withTimeout(p, ms, label){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(`${label} timeout ${ms}ms`), ms);
  return p(ctrl.signal).finally(()=>clearTimeout(t));
}

async function get(url, accept){
  return withTimeout(async (signal)=>{
    const res = await fetch(url, { signal, headers: accept ? {Accept: accept} : {} });
    const ct = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    return { ok: res.ok, status: res.status, ct, size: buf.byteLength, text: ()=>new TextDecoder().decode(buf) };
  }, TIMEOUT_MS, `GET ${url}`);
}

function must(cond, msg){ cond ? logOK(msg) : logNG(msg); return cond; }

function joinUrl(pathOrUrl){
  try { return new URL(pathOrUrl, BASE).toString(); } catch { return `${BASE}${pathOrUrl}`; }
}

(async () => {
  console.log(`🔎 PWA Health Check @ ${BASE}\n`);

  // 1) Manifest
  const manifestURL = `${BASE}/manifest.webmanifest`;
  let manifest;
  try{
    const r = await get(manifestURL, "application/manifest+json,application/json");
    must(r.ok, `manifest.webmanifest 200 (${r.status})`);
    must(/application\/(manifest\+json|json)/i.test(r.ct), `manifest content-type OK (${r.ct || "n/a"})`);
    if(r.ok){
      try{ manifest = JSON.parse(r.text()); logOK("manifest 可解析 JSON"); }
      catch(e){ logNG(`manifest JSON 解析失敗: ${e.message}`); }
    }
  }catch(e){
    logNG(`manifest 請求失敗：${String(e)}`);
  }

  // 驗證必要欄位
  if(manifest){
    const req = ["name","short_name","start_url","scope","display","icons"];
    for(const k of req) must(Boolean(manifest[k]), `manifest.${k} 存在`);

    const displayOK = ["standalone","minimal-ui","fullscreen"].includes(manifest.display);
    must(displayOK, `manifest.display 合法 (${manifest.display})`);

    let icon192Src, icon512Src;
    if(Array.isArray(manifest.icons)){
      // 嘗試就地找 192 與 512
      const has192 = manifest.icons.find(i => /192x192/.test(i.sizes || "") || /icon-192\.png$/.test(i.src || ""));
      const has512 = manifest.icons.find(i => /512x512/.test(i.sizes || "") || /icon-512\.png$/.test(i.src || ""));
      icon192Src = has192?.src || "/icons/icon-192.png";
      icon512Src = has512?.src || "/icons/icon-512.png";
      must(Boolean(has192), `icons[] 包含 192x192（或 icon-192.png）`);
      must(Boolean(has512), `icons[] 包含 512x512（或 icon-512.png）`);
    }else{
      logNG("manifest.icons 不是陣列");
      icon192Src = "/icons/icon-192.png";
      icon512Src = "/icons/icon-512.png";
    }

    // 2) Icons
    for (const [label, src] of [["icon-192", icon192Src],["icon-512", icon512Src]]){
      const url = joinUrl(src);
      try{
        const r = await get(url, "image/png");
        must(r.ok, `${label} 200 (${r.status}) — ${url}`);
        must(/image\/png/i.test(r.ct), `${label} content-type image/png`);
        must(r.size > 1000, `${label} 檔案大小看起來正常 (${r.size} bytes)`);
      }catch(e){
        logNG(`${label} 請求失敗：${String(e)}`);
      }
    }
  }

  // 3) /api/pwa/diag
  const diagURL = `${BASE}/api/pwa/diag`;
  try{
    const r = await get(diagURL, "application/json");
    must(r.ok, `GET /api/pwa/diag 200 (${r.status})`);
    if(r.ok){
      const json = JSON.parse(r.text());
      const healthy = json?.summary?.healthy === true || json?.summary?.manifest_ok && json?.summary?.icon_192_ok && json?.summary?.icon_512_ok;
      must(healthy, `diag 報告 healthy == true`);
    }
  }catch(e){
    logNG(`/api/pwa/diag 請求失敗：${String(e)}`);
  }

  // 4) /home（可選但有利於冒煙）
  try{
    const r = await get(`${BASE}/home`, "text/html");
    must(r.ok, `/home 200 (${r.status})`);
    must(/text\/html/i.test(r.ct), `/home content-type HTML`);
  }catch(e){
    logNG(`/home 請求失敗：${String(e)}`);
  }

  const all = [...notes, ...errs];
  const report = [
    `# PWA Health @ ${BASE}`,
    "",
    ...all.map(s => `- ${s}`),
    "",
    errs.length ? `**結果：FAILED（${errs.length} 項）**` : `**結果：PASSED**`
  ].join("\n");

  console.log("\n" + report + "\n");

  // GitHub Summary
  const sum = process.env.GITHUB_STEP_SUMMARY;
  if(sum){
    fs.appendFileSync(sum, report + "\n");
  }

  if(errs.length) process.exit(1);
})();
