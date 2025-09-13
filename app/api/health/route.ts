export const runtime = 'edge';

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      ts: new Date().toISOString(),
      env: process.env.VERCEL_ENV ?? 'unknown',
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-health': 'ok',
      },
    }
  );
}
