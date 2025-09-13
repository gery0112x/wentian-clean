// app/api/og/icon/route.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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
          color: '#fff',
          fontSize: 64,
          fontWeight: 800,
        }}
      >
        OG
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
