'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ModelCode = 'DS' | '4O' | 'GM' | 'GK';

export default function ChatEntry() {
  // ----- State -----
  const [active, setActive] = useState<ModelCode>('DS');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ----- Version: URL ?v=MM-SS -> localStorage -> default -----
  const version = useMemo(() => {
    const ok = (s: string | null) =>
      !!s && s.length === 5 && s[2] === '-' && !isNaN(+s.slice(0, 2)) && !isNaN(+s.slice(3, 5));
    const urlV = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('v');
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

  // ----- Left-edge swipe to open/close drawer (mobile) -----
  useEdgeSwipe({
    onOpen: () => setDrawerOpen(true),
    onClose: () => setDrawerOpen(false),
    isOpen: drawerOpen,
  });

  // ----- Close drawer on ESC -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="wuji-root" role="application" aria-label="無極•元始境 入口">
      {/* Top bar */}
      <header className="topbar" role="banner">
        <button className="btn ghost" aria-label="功能" onClick={() => setDrawerOpen(true)}>
          {/* hamburger */}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <div className="brand">無極・元始境&nbsp;<span className="ver">{version}</span></div>
        <div aria-hidden className="spacer" />
      </header>

      {/* Core scroll area (page itself does not scroll) */}
      <section className="content" id="content">
        {/* Hero brand mark — use your transparent PNG at /brand.png */}
        <div className="hero" aria-label="品牌商標">
          <img src="/brand.png" alt="品牌商標" className="brand-mark" />
        </div>

        {/* Quick actions — follow ChatGPT style */}
        <div className="quick-row" role="group" aria-label="快捷功能">
          {['建立圖像', '總結文字', '程式碼', '更多'].map((t) => (
            <button key={t} className="pill" type="button" aria-label={t}>
              <span>{t}</span>
            </button>
          ))}
        </div>

        {/* spacer to keep input visible on small screens */}
        <div style={{ height: 120 }} />
      </section>

      {/* Model chips (stick to input top) */}
      <nav className="models" role="tablist" aria-label="模型切換">
        {(['DS', '4O', 'GM', 'GK'] as ModelCode[]).map((code) => (
          <button
            key={code}
            role="tab"
            aria-selected={active === code}
            className={`model-chip ${active === code ? 'active on' : ''}`}
            onClick={() => setActive(code)}
            onPointerDown={(e) => handlePress(e, () => onLongPress(code, active, setActive))}
          >
            <span className="abbr">{code}</span>
            <span className="hint">{mapModel(code)}</span>
          </button>
        ))}
      </nav>

      {/* Composer */}
      <footer className="composer" role="group" aria-label="輸入區">
        <div className="input">
          {/* left accessories like ChatGPT */}
          <button className="circle" aria-label="相機">
            <div className="cam" />
          </button>
          <button className="circle" aria-label="附件">
            <div className="plus" />
          </button>

          <textarea
            rows={1}
            placeholder="詢問任何問題"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // send message…
              }
            }}
          />

          {/* mic */}
          <button className="mic" aria-label="語音">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V5a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 19v3" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </footer>

      {/* Drawer */}
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="panel">
          <div className="search">
            <input placeholder="搜尋" aria-label="搜尋" />
          </div>

          <div className="menu">
            {[
              '新聊天',
              '圖庫',
              'GPT（功能入口）',
              '新專案',
              '無極平台0815',
              '制度改善',
              '所有專案',
              'GPT版本與切換規則',
              'MVP 定義與封裝策略',
              '財經資料模組',
            ].map((t) => (
              <button key={t} className="menu-item" onPointerDown={(e) => startHold(e, () => showContext(t))}>
                {t}
              </button>
            ))}
          </div>

          <div className="bottom">
            <button className="menu-item" onClick={() => {/* open platform info */}}>
              平台資訊
            </button>
          </div>
        </div>

        <button className="scrim" aria-label="關閉" onClick={() => setDrawerOpen(false)} />
      </aside>

      {/* Styles */}
      <style jsx global>{`
        :root{
          --bg:#1A2027; --bg-2:#151A1F; --surface:#1D232A; --stroke:#242A31;
          --text:#E0E0E0; --text-2:#A7B0BA; --text-3:#7E8994;
          --accent:#00A3C4; --accent-weak:rgba(0,163,196,.08);

          --header-h:56px; --models-h:56px; --composer-h:96px;
        }
        *{box-sizing:border-box; -webkit-tap-highlight-color:transparent}
        html,body{height:100%; background:var(--bg); color:var(--text)}
        body{margin:0; overflow:hidden; font-family:system-ui,-apple-system,"Noto Sans TC","Noto Sans CJK TC",sans-serif}

        .wuji-root{position:relative; width:100vw; height:100vh; background:var(--bg)}
        .topbar{position:fixed; top:0; left:0; right:0; height:56px; display:flex; align-items:center; padding:0 12px; gap:8px; background:var(--bg); border-bottom:1px solid var(--stroke); z-index:30}
        .btn.ghost{width:40px; height:40px; display:grid; place-items:center; border-radius:10px; color:var(--text-2)}
        .btn.ghost:active{background:rgba(255,255,255,.04)}
        .brand{font-weight:600; color:var(--text)}
        .ver{opacity:.9}
        .spacer{flex:1}

        .content{position:absolute; top:56px; left:0; right:0; bottom:96px; overflow:auto; -webkit-overflow-scrolling:touch; padding:16px 12px 0}
        .hero{display:grid; place-items:center; padding:24px 0 6px}
        .brand-mark{width:28vw; max-width:300px; height:auto; image-rendering:auto}

        .quick-row{display:flex; gap:12px; padding:16px 8px; justify-content:center}
        .pill{min-width:132px; height:44px; padding:0 14px; display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid var(--stroke); background:transparent; color:var(--text); border-radius:999px}
        .pill:active{background:rgba(255,255,255,.04)}

        .models{position:fixed; left:0; right:0; bottom:96px; display:flex; gap:12px; justify-content:center; padding:10px 12px; z-index:20}
        .model-chip{position:relative; min-width:88px; height:40px; padding:0 12px; border:1px solid var(--stroke); background:var(--surface); color:var(--text-2); border-radius:999px; font-weight:600}
        .model-chip.active{color:var(--text)}
        .model-chip.on::after{
          content:""; position:absolute; right:0; bottom:0; width:18px; height:18px;
          border-right:2px solid var(--accent); border-bottom:2px solid var(--accent); border-radius:0 0 12px 0;
        }
        .model-chip .hint{position:absolute; top:-22px; left:50%; transform:translateX(-50%); font-size:12px; color:var(--text-2); opacity:.9; pointer-events:none}

        .composer{position:fixed; left:0; right:0; bottom:0; padding:8px 12px 12px; background:linear-gradient(180deg, rgba(26,32,39,0), rgba(26,32,39,.92) 50%, rgba(26,32,39,1)); z-index:15}
        .input{position:relative; display:flex; align-items:center; gap:10px; border:1px solid var(--stroke); background:var(--surface); border-radius:16px; min-height:64px; padding:10px 54px 10px 92px}
        .input::before{content:""; position:absolute; left:10px; top:10px; width:18px; height:12px; border-top:2px solid var(--accent); border-left:2px solid var(--accent); border-radius:6px 0 0 0}
        .input::after{content:""; position:absolute; right:10px; bottom:10px; width:18px; height:12px; border-right:2px solid var(--text-2); border-bottom:2px solid var(--text-2); border-radius:0 0 6px 0}
        .input textarea{flex:1; background:transparent; border:0; outline:0; color:var(--text); font-size:16px; resize:vertical; max-height:180px}
        .circle{width:36px; height:36px; display:grid; place-items:center; border:1px solid var(--stroke); background:var(--surface); border-radius:12px}
        .cam{width:18px; height:12px; border:2px solid var(--text-2); border-bottom-left-radius:2px; border-bottom-right-radius:2px}
        .plus{position:relative; width:18px; height:18px}
        .plus::before, .plus::after{content:""; position:absolute; left:8px; top:2px; width:2px; height:14px; background:var(--text-2)}
        .plus::after{transform:rotate(90deg)}
        .mic{position:absolute; right:8px; bottom:8px; width:40px; height:40px; display:grid; place-items:center; border:1px solid var(--stroke); background:var(--surface); border-radius:12px}
        .mic svg{width:20px; height:20px; color:var(--text)}

        .drawer{position:fixed; inset:0; pointer-events:none; z-index:40}
        .drawer .scrim{position:absolute; inset:0; background:rgba(0,0,0,.4); opacity:0; transition:opacity .2s}
        .drawer .panel{position:absolute; top:0; bottom:0; left:0; width:min(82vw, 360px); background:var(--bg-2); border-right:1px solid var(--stroke); transform:translateX(-100%); transition:transform .2s}
        .drawer.open{pointer-events:auto}
        .drawer.open .scrim{opacity:1}
        .drawer.open .panel{transform:translateX(0)}
        .search{padding:16px}
        .search input{width:100%; height:44px; border:1px solid var(--stroke); border-radius:12px; background:var(--surface); color:var(--text-2); padding:0 12px}
        .menu{padding:0 8px 80px}
        .menu-item{display:block; width:100%; text-align:left; padding:14px 16px; color:var(--text); border:0; background:transparent; border-bottom:1px solid var(--stroke)}
        .bottom{position:absolute; left:0; right:0; bottom:0; border-top:1px solid var(--stroke); padding:10px 8px 16px; background:var(--bg-2)}
      `}</style>
    </main>
  );
}

// ----- Helpers -----
function mapModel(code: ModelCode): string {
  return (
    {
      DS: 'DeepSeek',
      '4O': 'GPT‑4o',
      GM: 'Gemini',
      GK: 'Grok',
    } as const
  )[code];
}

function handlePress(e: React.PointerEvent, onLong: () => void) {
  let timer: any;
  const start = () => (timer = setTimeout(onLong, 3000));
  const stop = () => timer && clearTimeout(timer);
  start();
  const el = e.currentTarget as HTMLElement;
  const off = () => {
    stop();
    el.removeEventListener('pointerup', off);
    el.removeEventListener('pointerleave', off);
    el.removeEventListener('pointercancel', off);
  };
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}

function onLongPress(target: ModelCode, current: ModelCode, setActive: (m: ModelCode) => void) {
  if (target === current) {
    // 當前模型：顯示詳情（示意）
    alert(`顯示 ${mapModel(target)} 參數（示意）`);
  } else {
    // 非當前：進入對戰（示意）
    const judge = pickJudge([current, target]);
    alert(`挑戰：${current} vs ${target}｜裁判：${judge}`);
    setActive(target);
  }
}

function pickJudge(contenders: ModelCode[]) {
  // DeepSeek 未上場時優先，否則 GPT-4o，否則人工
  if (!contenders.includes('DS')) return 'DeepSeek';
  return 'GPT-4o';
}

// Left-edge swipe gesture
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
      // 若未開，左緣 18px 內起手；若已開，抽屜右緣 20% 區域起手
      const nearEdge = !opened ? t.clientX < 18 : t.clientX > w * 0.75;
      if (!nearEdge) return;

      tracking = true;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > TOL) {
        tracking = false;
        return;
      }
      if (!opened && dx > TH) {
        opts.onOpen();
        tracking = false;
      }
      if (opened && dx < -TH) {
        opts.onClose();
        tracking = false;
      }
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
