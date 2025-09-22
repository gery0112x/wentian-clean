// app/api/r5/vercel/deploy/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const hook = process.env.VERCEL_DEPLOY_HOOK!;
  const r = await fetch(hook, { method: "POST" });
  const txt = await r.text();
  return NextResponse.json({ ok: r.ok, status: r.status, body: txt });
}
