// app/page.tsx  — Next.js App Router 首頁（Server Component）
// 簡單、零依賴，不用瀏覽器 API，確保編譯必過

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0b0c10',
        color: '#e6edf3',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji',
        padding: '24px 20px',
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>OK : wentian-clean</h1>

      <ul style={{ lineHeight: 1.9, fontSize: 16 }}>
        <li>
          <a href="/chat" style={{ color: '#9fb3c8' }}>
            /chat（對話入口）
          </a>
        </li>
        <li>
          <a href="/api/llm/health" style={{ color: '#9fb3c8' }}>
            /api/llm/health（健康檢查）
          </a>
        </li>
        <li>
          <a href="/api/version/info" style={{ color: '#9fb3c8' }}>
            /api/version/info（版本資訊）
          </a>
        </li>
      </ul>

      <div style={{ marginTop: 18, opacity: 0.7, fontSize: 13 }}>
        App Router • Next.js 14 • 此頁不使用瀏覽器 API，純 Server Component，避免 build 出錯。
      </div>
    </main>
  );
}
