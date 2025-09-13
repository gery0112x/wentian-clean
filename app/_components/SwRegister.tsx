// app/_components/SwRegister.tsx
'use client';
import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => console.log('[sw] registered:', reg.scope),
        (err) => console.warn('[sw] register failed:', err)
      );
    } else {
      console.warn('[sw] not supported');
    }
  }, []);
  return null;
}
