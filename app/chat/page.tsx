'use client';

import { useEffect, useMemo, useState } from 'react';

type ModelCode = 'DS' | '4O' | 'GM' | 'GK';

export default function ChatEntry() {
  // 當前模型
  const [active, setActive] = useState<ModelCode>(() => {
    if (typeof window === 'undefined') return 'DS';
    return (localStorage.getItem('wuji.model') as ModelCode) || 'DS';
  });
  // 抽屜
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 輸入內容
  const [text, setText] = useState('');

  // 版本：URL ?v=MM-SS → localStorage → 預設
  const version = useMemo(() => {
    const ok = (s: string | null) =>
      !!s && s.length === 5 && s[2] === '-' && !isNaN(+s.slice(0, 2)) && !isNaN(+s.slice(3, 5));
    const urlV = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('v') : null;
    if (ok(urlV)) {
      try { localStorage.setItem('wuji.version', urlV!); } catch {}
      return urlV!;
    }
    try {
      const ls = localStorage.getItem('wuji.version');
      if (ok(ls)) return ls!;
    } catch {}
    return '00-00';
  }, []);

  // 左緣滑開/關抽屜（行動）
  useEdgeSwipe({
    onOpen: () => setDrawerOpen(true),
    onClose: () => setDrawerOpen(false),
    isOpen: drawerOpen,
  });

  // ESC 關抽屜
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 切模型
  function switchModel(code: ModelCode) {
    setActive(code);
    try { localStorage.setItem('wuji.model', code); } catch {}
  }

  // 快捷 actions（先用 alert 站位）
  function onQuick(action: 'img' | 'sum' | 'code' | 'more') {
    const map = { img: '建立圖像', sum: '總結文字', code: '程式碼', more: '更多' } as const;
    alert(`【${map[action]}】尚未接 API（目前模型：${active}）`);
  }

  // 送出
  function onSend() {
    if (!text.trim()) return;
    alert(`發送（模型：${active}）\n\n${text.trim()}`);
    setText('');
  }

  return (
    <main className="wuji-root" role="application" aria-label="無極•元始境 入口">
      {/* 頂欄 */}
      <header className="topbar" role="banner">
        <button className="btn ghost" aria-label="功能" onClick={() => setDrawerOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <div className="brand">無極・元始境&nbsp;<span className="ver">{version}</span></div>
        <div aria-hidden className="spacer" />
      </header>

      {/* 主內容（不顯示「我可以為你做什麼？」） */}
      <section className="content" id="content">
        <div className="hero" aria-label="品牌商標">
          {/* 放你的透明底檔 public/brand.png */}
          <img src="/brand.png" alt="品牌" className="brand-mark" />
        </div>

        {/* 快捷功能四顆 */}
        <div className="quick-row" role="group" aria-label="快捷功能">
          <button className="pill" type="button" onClick={() => onQuick('img')}><span>建立圖像</span></button>
          <button className="pill" type="button" onClick={() => onQuick('sum')}><span>總結文字</span></button>
          <button className="pill" type="button" onClick={() => onQuick('code')}><span>程式碼</span></button>
          <button className="pill" type="button" onClick={() => onQuick('more')}><span>更多</span></button>
        </div>

        {/* 撐高，避免被下方覆蓋 */}
        <div style={{ height: '12vh' }} />
      </section>

      {/* 模型膠囊（緊貼輸入框上緣）——只顯示 2 碼 */}
      <nav className="models" role="tablist" aria-label="模型切換">
        {( ['DS','4O','GM','GK'] as ModelCode[] ).map(code => (
          <button
            key={code}
            role="tab"
            aria-selected={active === code}
            className={`model-chip ${active === code ? 'active on' : ''}`}
            onClick={() => switchModel(code)}
            onPointerDown={(e) => handlePress(e, () => onModelHold(code, active, setActive))}
          >
            <span className="abbr">{code}</span>
          </button>
        ))}
      </nav>

      {/* 輸入區 */}
      <footer className="composer" role="group" aria-label="輸入區">
        <div className="input">
          <button className="circle" aria-label="相機"><div className="cam" /></button>
          <button className="circle" aria-label="附件"><div className="plus" /></button>

          <textarea
            rows={1}
            placeholder="詢問任何問題"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
            }}
          />

          {/* 送出鍵（紙飛機） */}
          <button className="send" aria-label="送出" onClick={onSend}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12l18-8-6 8 6 8-18-8z" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>

          {/* 麥克風 */}
          <button className="mic" aria-label="語音">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V5a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 19v3" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </footer>

      {/* 抽屜 */}
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="panel">
          <div className="search"><input placeholder="搜尋" aria-label="搜尋" /></div>

          <div className="menu">
            {[
              '新聊天','圖庫','GPT（功能入口）','新專案','無極平台0815','制度改善',
              '所有專案','GPT版本與切換規則','MVP 定義與封裝策略','財經資料模組',
            ].map((t) => (
              <button key={t} className="menu-item" onPointerDown={(e) => handlePress(e, () => showContext(t))}>
                {t}
              </button>
            ))}
          </div>

          <div className="bottom">
            <button className="menu-item">平台資訊</button>
          </div>
        </div>
        <button className="scrim" aria-label="關閉" onClick={() => setDrawerOpen(false)} />
      </aside>

      {/* 樣式（RWD + safe-area + clamp 字級） */}
      <style jsx global>{`
        :root{
          --bg:#1A2027; --bg-2:#151A1F; --surface:#1D232A; --stroke:#242A31;
          --text:#E0E0E0; --text-2:#A7B0BA; --text-3:#7E8994; --accent:#00A3C4;
          --header-h: clamp(48px, 6vh, 56px);
          --composer-h: clamp(82px, 10vh, 100px);
          --chip-h: clamp(38px, 4.6vh, 46px);
          --space-s: clamp(8px, 1.2vh, 12px);
          --space-m: clamp(12px, 1.6vh, 16px);
          --space-l: clamp(16px, 2vh, 20px);
        }
        *{box-sizing:border-box; -webkit-tap-highlight-color:transparent}
        html,body{height:100%; background:var(--bg); color:var(--text)}
        body{margin:0; overflow:hidden; font-family:system-ui,-apple-system,"Noto Sans TC","Noto Sans CJK TC",sans-serif}

        .wuji-root{position:relative; width:100vw; height:100vh; background:var(--bg)}
        .topbar{
          position:fixed; inset:0 0 auto 0; height:var(--header-h);
          display:flex; align-items:center; gap:var(--space-s); padding:0 var(--space-m);
          background:var(--bg); border-bottom:1px solid var(--stroke); z-index:30;
        }
        .btn.ghost{width:40px; height:40px; display:grid; place-items:center; border-radius:12px; color:var(--text-2)}
        .brand{font-weight:600; font-size:clamp(14px, 2.2vh, 18px)}
        .ver{opacity:.9}
        .spacer{flex:1}

        .content{
          position:absolute; top:var(--header-h); left:0; right:0; bottom:calc(var(--composer-h) + env(safe-area-inset-bottom));
          overflow:auto; -webkit-overflow-scrolling:touch; padding:var(--space-m) var(--space-m) 0;
        }
        .hero{display:grid; place-items:center; padding:clamp(16px, 4vh, 28px) 0 6px}
        .brand-mark{width:min(44vw, 300px); height:auto}

        .quick-row{display:flex; gap:clamp(8px,1.4vh,12px); padding:var(--space-m) 8px; justify-content:center; flex-wrap:wrap}
        .pill{
          min-width:clamp(112px, 28vw, 160px); height:clamp(40px, 5.2vh, 48px); padding:0 14px;
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          border:1px solid var(--stroke); background:transparent; color:var(--text); border-radius:999px;
          font-size:clamp(12px, 1.9vh, 15px);
        }
        .pill:active{background:rgba(255,255,255,.04)}

        .models{
          position:fixed; left:0; right:0; bottom:calc(var(--composer-h) + env(safe-area-inset-bottom));
          display:flex; gap:clamp(8px, 1.4vh,12px); justify-content:center; padding:10px var(--space-m); z-index:20;
        }
        .model-chip{
          position:relative; min-width:clamp(70px, 18vw, 96px); height:var(--chip-h); padding:0 12px;
          border:1px solid var(--stroke); background:var(--surface); color:var(--text);
          border-radius:999px; font-weight:700; font-size:clamp(12px, 2.1vh, 16px);
        }
        .model-chip.on::after{
          content:""; position:absolute; right:0; bottom:0; width:18px; height:18px;
          border-right:2px solid var(--accent); border-bottom:2px solid var(--accent); border-radius:0 0 12px 0;
        }

        .composer{
          position:fixed; left:0; right:0; bottom:0;
          padding:8px var(--space-m) calc(env(safe-area-inset-bottom) + 8px);
          height:calc(var(--composer-h) + env(safe-area-inset-bottom));
          background:linear-gradient(180deg, rgba(26,32,39,0), rgba(26,32,39,.92) 50%, rgba(26,32,39,1));
          z-index:15;
        }
        .input{
          position:relative; display:flex; align-items:center; gap:10px;
          border:1px solid var(--stroke); background:var(--surface); border-radius:16px;
          min-height:clamp(56px, 7vh, 72px); padding:10px 100px 10px 92px;
        }
        .input::before{content:""; position:absolute; left:10px; top:10px; width:18px; height:12px;
          border-top:2px solid #00A3C4; border-left:2px solid #00A3C4; border-radius:6px 0 0 0}
        .input::after{content:""; position:absolute; right:10px; bottom:10px; width:18px; height:12px;
          border-right:2px solid var(--text-2); border-bottom:2px solid var(--text-2); border-radius:0 0 6px 0}
        .input textarea{
          flex:1; background:transparent; border:0; outline:0; color:var(--text);
          font-size:clamp(14px, 2.2vh, 18px); resize:vertical; max-height:30vh;
        }
        .circle{width:36px; height:36px; display:grid; place-items:center; border:1px solid var(--stroke); background:var(--surface); border-radius:12px}
        .cam{width:18px; height:12px; border:2px solid #A7B0BA; border-bottom-left-radius:2px; border-bottom-right-radius:2px}
        .plus{position:relative; width:18px; height:18px}
        .plus::before, .plus::after{content:""; position:absolute; left:8px; top:2px; width:2px; height:14px; background:#A7B0BA}
        .plus::after{transform:rotate(90deg)}
        .send{position:absolute; right:56px; bottom:8px; width:40px; height:40px; display:grid; place-items:center;
          border:1px solid var(--stroke); background:var(--surface); border-radius:12px}
        .send svg{width:20px; height:20px; color:var(--text)}
        .mic{position:absolute; right:8px; bottom:8px; width:40px; height:40px; display:grid; place-items:center; border:1px solid var(--stroke); background:var(--surface); border-radius:12px}
        .mic svg{width:20px; height:20px; color:var(--text)}

        .drawer{position:fixed; inset:0; pointer-events:none; z-index:40}
        .drawer .scrim{position:absolute; inset:0; background:rgba(0,0,0,.4); opacity:0; transition:opacity .2s}
        .drawer .panel{position:absolute; top:0; bottom:0; left:0; width:min(82vw, 360px); background:#151A1F; border-right:1px solid var(--stroke); transform:translateX(-100%); transition:transform .2s}
        .drawer.open{pointer-events:auto}
        .drawer.open .scrim{opacity:1}
        .drawer.open .panel{transform:translateX(0)}
        .search{padding:16px}
        .search input{width:100%; height:44px; border:1px solid var(--stroke); border-radius:12px; background:#1D232A; color:#E0E0E0; padding:0 12px}
        .menu{padding:0 8px 80px}
        .menu-item{display:block; width:100%; text-align:left; padding:14px 16px; color:#E0E0E0; border:0; background:transparent; border-bottom:1px solid var(--stroke)}
        .bottom{position:absolute; left:0; right:0; bottom:0; border-top:1px solid var(--stroke); padding:10px 8px 16px; background:#151A1F}
      `}</style>
    </main>
  );
}

/* ---------- helpers ---------- */

// 通用長按（300ms；要 3000ms 就把 300 改 3000）
function handlePress(e: React.PointerEvent, onLong: () => void) {
  let timer: any;
  const start = () => (timer = setTimeout(onLong, 300));
  const stop = () => timer && clearTimeout(timer);
  start();
  const el = e.currentTarget as HTMLElement;
  const off = () => { stop(); el.removeEventListener('pointerup', off); el.removeEventListener('pointerleave', off); el.removeEventListener('pointercancel', off); };
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}

// 模型長按：當前=>詳情；非當前=>對戰（示意）
function onModelHold(target: ModelCode, current: ModelCode, setActive: (m: ModelCode) => void) {
  if (target === current) alert(`顯示 ${target} 詳情（示意）`);
  else {
    const judge = pickJudge([current, target]);
    alert(`對戰：${current} vs ${target}\n裁判：${judge}（示意）`);
    setActive(target);
  }
}

// 裁判選擇（精簡版）
function pickJudge(contenders: ModelCode[]) {
  if (!contenders.includes('DS')) return 'DeepSeek';
  return 'GPT-4o';
}

// 抽屜項目長按（示意）
function showContext(label: string) {
  alert(`「${label}」：重新命名／新增至專案／封存／刪除（示意）`);
}

// 左緣滑開/關閉抽屜（行動）
function useEdgeSwipe(opts: { onOpen: () => void; onClose: () => void; isOpen: boolean }) {
  useEffect(() => {
    let startX = 0, startY = 0, tracking = false, opened = opts.isOpen;
    const TH = 60, TOL = 30;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const w = window.innerWidth;
      const isMobile = w <= 575;
      if (!isMobile) return;
      opened = opts.isOpen;
      const nearEdge = !opened ? t.clientX < 18 : t.clientX > w * 0.75;
      if (!nearEdge) return;
      tracking = true; startX = t.clientX; startY = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0]; const dx = t.clientX - startX; const dy = t.clientY - startY;
      if (Math.abs(dy) > TOL) { tracking = false; return; }
      if (!opened && dx > TH) { opts.onOpen(); tracking = false; }
      if (opened && dx < -TH) { opts.onClose(); tracking = false; }
    };
    const stop = () => (tracking = false);

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', stop, { passive: true });
    window.addEventListener('touchcancel', stop, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
    };
  }, [opts.isOpen, opts.onOpen, opts.onClose]);
}
