'use client';

import React from 'react';

/**
 * 顯示「請轉回指定方向」的遮罩（軟鎖）。
 * 以 CSS 媒體查詢判斷目前方向，不符合時顯示。
 */
export default function OrientationGuard({ require }: { require: 'portrait' | 'landscape' }) {
  return (
    <>
      <div className={`og-mask og-${require}`}>
        <div className="og-card">
          建議以{require === 'portrait' ? '直向' : '橫向'}模式使用本頁面。
        </div>
      </div>
      <style jsx global>{`
        .og-mask{position:fixed; inset:0; display:none; align-items:center; justify-content:center;
          background:rgba(0,0,0,.55); color:#E0E0E0; z-index:1000; padding:24px; backdrop-filter:saturate(.7) blur(2px)}
        .og-card{font-size:clamp(14px, 2.4vh, 18px); text-align:center}

        /* 需要 portrait，但現在是 landscape -> 顯示 */
        @media (orientation: landscape) { .og-portrait{display:flex} }
        /* 需要 landscape，但現在是 portrait -> 顯示 */
        @media (orientation: portrait) { .og-landscape{display:flex} }
      `}</style>
    </>
  );
}
