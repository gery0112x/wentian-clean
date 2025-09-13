// public/sw.js
self.addEventListener('install', (event) => {
  console.log('[sw] install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[sw] activate');
  event.waitUntil(self.clients.claim());
});

// 空的 fetch handler 也可以，重點是存在，滿足安裝條件
self.addEventListener('fetch', (event) => {});
