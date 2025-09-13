// app/icons/icon-192.png/route.tsx
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
          color: '#ffffff',
          fontSize: 96,
          fontWeight: 800,
        }}
      >
        無
      </div>
    ),
    { width: 192, height: 192 }
  );
}
