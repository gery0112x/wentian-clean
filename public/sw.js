// wuji-sw v2 (debug)
const SW_VER = 'wuji-sw-2';
self.addEventListener('install', (evt) => {
  console.log(`[SW ${SW_VER}] install`);
  self.skipWaiting();
});
self.addEventListener('activate', (evt) => {
  console.log(`[SW ${SW_VER}] activate`);
  evt.waitUntil(self.clients.claim());
});
