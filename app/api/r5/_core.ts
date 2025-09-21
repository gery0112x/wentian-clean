// app/api/r5/_core.ts  ← 共用工具（小檔）
import { NextResponse } from "next/server";

export type RunStatus = "queued" | "planning" | "executing" | "waiting_external" | "success" | "error" | "cancelled";

export async function json(data: any, init: number = 200) {
  return NextResponse.json(data, { status: init });
}
