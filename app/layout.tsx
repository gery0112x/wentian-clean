import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '無極入口（最小 PWA 殼）',
  description: 'Next.js App Router 最小 PWA 範本',
  manifest: '/manifest.webmanifest',
  themeColor: '#111827',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
