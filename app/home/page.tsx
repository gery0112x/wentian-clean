// wuji-sw v3 — cache-first shell + debug
const VER = 'wuji-sw-v3';
const CACHE = 'wuji-shell-v3';
const SHELL = ['/', '/home', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (evt) => {
  console.log(`[SW ${VER}] install`);
  evt.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evt) => {
  console.log(`[SW ${VER}] activate`);
  evt.waitUntil(self.clients.claim());
});

// 重要：提供 fetch handler（Chrome 常用作安裝判準之一）
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  // 只攔同源 GET；其餘直傳網路
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // 對 navigation/page 採「快取優先」，其他用「網路優先、回退快取」
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      caches.match('/home').then(hit => hit || fetch(req))
    );
  } else {
    evt.respondWith(
      fetch(req).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        return r;
      }).catch(() => caches.match(req))
    );
  }
});

