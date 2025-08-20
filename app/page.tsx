export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1>OK：wentian-clean</h1>
      <ul>
        <li><a href="/api/llm/health">/api/llm/health</a>（健康檢查）</li>
        <li><a href="/api/version/info">/api/version/info</a>（版本資訊）</li>
      </ul>
    </main>
  );
}
