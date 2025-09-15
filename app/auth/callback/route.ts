import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.exchangeCodeForSession(); // 這一步會設定 sb-* cookie
  return NextResponse.redirect(new URL('/home', req.url));
}
