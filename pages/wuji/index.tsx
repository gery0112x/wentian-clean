import { useState } from "react";

export default function WujiPlayground() {
  const [q, setQ] = useState("請用一句話介紹無極平台 v2.1");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string>("");

  async function send() {
    setLoading(true);
    setReply("");
    try {
      const r = await fetch("/api/chat?q=" + encodeURIComponent(q));
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "error");
      setReply(j.reply || JSON.stringify(j));
    } catch (e: any) {
      setReply("❌ " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{minHeight:"100vh", background:"#0b0b0b", color:"#e6e6e6", display:"flex", justifyContent:"center"}}>
      <div style={{width:"min(960px, 100%)", padding:"24px"}}>
        <h1 style={{fontSize:24, marginBottom:16}}>Wuji v2.1 – 入口測試</h1>
        <div style={{display:"flex", gap:12}}>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="輸入你的問題..."
            style={{flex:1, padding:"12px 14px", borderRadius:12, border:"1px solid #333", background:"#151515", color:"#eee"}}
          />
          <button onClick={send} disabled={loading}
            style={{padding:"12px 16px", borderRadius:12, border:"1px solid #444", background: loading ? "#333" : "#1f6feb", color:"#fff"}}>
            {loading ? "送出中…" : "送出"}
          </button>
        </div>

        <div style={{marginTop:16, padding:16, border:"1px solid #222", borderRadius:12, background:"#111"}}>
          <div style={{opacity:0.7, marginBottom:8}}>回應：</div>
          <div style={{whiteSpace:"pre-wrap", lineHeight:1.6}}>{reply || "（尚無回應）"}</div>
        </div>

        <div style={{opacity:0.6, fontSize:12, marginTop:12}}>
          這個頁面會呼叫 <code>/api/chat</code>；成本由後端估算並寫入 <code>_io_gate_logs</code>。
        </div>
      </div>
    </main>
  );
}
