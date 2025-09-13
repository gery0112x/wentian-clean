// app/layout.tsx
import type { ReactNode } from 'react';
import SwRegister from './_components/SwRegister';

export const metadata = {
  title: '無極入口',
  description: '最小 PWA 殼',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111827" />
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />
      </head>
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
