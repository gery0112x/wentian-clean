import { NextResponse, NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession(); // 維持 sb-* cookie 生命週期
  return res;
}
export const config = { matcher: ['/((?!_next|.*\\..*).*)'] };
