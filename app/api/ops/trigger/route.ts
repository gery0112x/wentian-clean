// /app/api/ops/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runOnServer } from '../../../../lib/intent-gateway';
import { PLATFORM, REALM, OPERATOR, banner } from '../../../../lib/identity';

// 只回身份（GET）
export async function GET() {
  return NextResponse.json({
    ok: true,
    platform: PLATFORM,
    realm: REALM,
    operator: OPERATOR,
    banner: banner(),
    feature: { plainProposal: true },
  });
}

// 由後台判斷是否啟用白話提案並直連現有 API（POST）
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 });
    }

    // 以本次請求的 URL 作為 baseURL（最保險，支援 Vercel/本機）
    const url = req.nextUrl; // e.g. https://wentian-clean.vercel.app/api/ops/trigger
    const baseURL = `${url.protocol}//${url.host}`;

    const gate = await runOnServer(baseURL, text);

    return NextResponse.json({
      ok: true,
      platform: PLATFORM,
      realm: REALM,
      operator: OPERATOR,
      banner: banner(),
      ...gate,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
