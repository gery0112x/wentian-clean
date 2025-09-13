// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: '無極入口',
  description: '無極入口（最小 PWA 殼）',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/api/icon/192', sizes: '192x192', type: 'image/png' },
      { url: '/api/icon/512', sizes: '512x512', type: 'image/png' },
    ],
  },
  themeColor: '#111827',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js');}}catch(e){}})();
` }}/>
      </head>
      <body>{children}</body>
    </html>
  )
}
