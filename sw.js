// Long Do POS — Service Worker
// ⚠️ เปลี่ยนเลขเวอร์ชันนี้ทุกครั้งที่แก้ไข app.js / index.html เพื่อบังคับอัปเดตแอป
const CACHE = 'longdo-pos-v5';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Sarabun:wght@300;400;500;600&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first สำหรับไฟล์หลัก (HTML / app.js) เพื่อให้เห็นโค้ดใหม่ทันที
// Cache-first สำหรับไฟล์อื่น (font ฯลฯ) เพื่อความเร็ว/ใช้งานออฟไลน์
self.addEventListener('fetch', e => {
  const isCore = e.request.destination === 'document' || e.request.url.endsWith('app.js');

  if (isCore) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, resClone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
