// app/favicon.ico/route.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  // 以 PNG 回應 /favicon.ico，瀏覽器可接受，並可消除 404。
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
          color: '#ffffff',
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        無
      </div>
    ),
    { width: 32, height: 32 }
  );
}
