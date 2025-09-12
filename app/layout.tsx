// @ts-nocheck
import React from 'react';

// Next App Router 會依 metadata 自動產出 <link rel="manifest">、icons、theme-color
export const metadata = {
  title: '無極入口',
  description: '無極入口（最小 PWA 殼）',
  applicationName: '無極入口',
  manifest: '/manifest.webmanifest',
  themeColor: '#111827',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/icon-192.png' }]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
