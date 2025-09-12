export const metadata = { title: '無極入口', manifest: '/manifest.webmanifest' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('SW register fail',e));}`
        }} />
      </body>
    </html>
  );
}
