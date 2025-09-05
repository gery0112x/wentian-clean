// /app/hooks/useOrientationLock.ts
// 安全版：避免 SSR/型別差異造成 build 失敗；不依賴 lib.dom 具體型別
import { useEffect } from "react";

type LockMode = "portrait" | "landscape" | "any";

/** 嘗試上鎖畫面方向（瀏覽器支援才會執行）*/
export async function lockScreenOrientation(mode: LockMode = "portrait") {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  const scr: any = (window as any).screen;
  const ori: any = scr?.orientation;

  // 某些環境沒有 orientation 或沒有 lock 方法 → 直接略過
  if (!ori || typeof ori.lock !== "function") return { ok: false, reason: "no-lock" };

  try {
    await ori.lock(mode);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

/** 嘗試解除鎖定（若支援）*/
export function unlockScreenOrientation() {
  if (typeof window === "undefined") return;
  const scr: any = (window as any).screen;
  const ori: any = scr?.orientation;
  if (ori && typeof ori.unlock === "function") {
    try { ori.unlock(); } catch { /* ignore */ }
  }
}

/** React Hook：在掛載時鎖定、卸載時解除；不支援則不做事 */
export function useOrientationLock(required?: LockMode) {
  useEffect(() => {
    let cancelled = false;
    if (!required || typeof window === "undefined") return;

    lockScreenOrientation(required).catch(() => { /* ignore */ });

    return () => {
      if (!cancelled) unlockScreenOrientation();
      cancelled = true;
    };
  }, [required]);
}
