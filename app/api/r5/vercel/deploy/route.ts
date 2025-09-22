import { NextResponse } from "next/server";

export async function POST() {
  const hook = process.env.VERCEL_DEPLOY_HOOK || "";
  if (!hook) return NextResponse.json({ ok: false, error: "vercel_hook_missing" }, { status: 500 });
  const r = await fetch(hook, { method: "POST", cache: "no-store" });
  const txt = await r.text();
  return NextResponse.json({ ok: r.ok, status: r.status, body: txt });
}
