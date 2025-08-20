// app/layout.tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'wentian-clean',
  description: 'Simple Next.js App Router root layout',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body style={{ margin: 0, background: '#0b0c10', color: '#e6edf3' }}>
        {children}
      </body>
    </html>
  );
}
