// app/layout.tsx
export const metadata = { title: '無極・元始境' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#1A2027" />
        {/* iOS 安裝到桌面時全螢幕 + 直向偏好 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* 正確 dvh 支援 */}
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
