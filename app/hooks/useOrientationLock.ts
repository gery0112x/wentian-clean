'use client';

import { useEffect } from 'react';

/**
 * 逐頁方向鎖定（軟鎖 + 硬鎖嘗試）
 * @param require 'portrait' | 'landscape'
 */
export function useOrientationLock(require: 'portrait' | 'landscape') {
  useEffect(() => {
    const tryLock = async () => {
      // 某些環境（PWA/全螢幕）才允許。失敗就忽略，改走遮罩。
      // @ts-ignore
      if (screen?.orientation?.lock) {
        try { await screen.orientation.lock(require); } catch {}
      }
    };
    // 需使用者手勢觸發較穩定
    const once = () => { tryLock(); window.removeEventListener('click', once); };
    window.addEventListener('click', once);
    return () => window.removeEventListener('click', once);
  }, [require]);
}
