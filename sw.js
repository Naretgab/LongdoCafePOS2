// Long Do POS — Service Worker
// ⚠️ เปลี่ยนเลขเวอร์ชันนี้ทุกครั้งที่แก้ไข app.js / index.html เพื่อบังคับอัปเดตแอป
const CACHE = 'longdo-pos-v18';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './supabase-sync.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Sarabun:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
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
  // ปล่อยผ่านตรงๆ ไม่แตะเลยสำหรับ request ที่ไม่ใช่ GET (เช่น POST/PATCH ไปยัง
  // Supabase REST API ตอนซิงค์ข้อมูล) เพราะ Cache API เก็บได้เฉพาะ GET เท่านั้น —
  // ถ้าไม่กันไว้ตรงนี้จะเจอ error "Request method 'POST' is unsupported"
  if (e.request.method !== 'GET') return;

  // ปล่อยผ่าน request ที่ไปยัง Supabase ทั้งหมด (ทั้ง REST และ Realtime websocket)
  // ไม่ต้อง cache หรือ intercept ใดๆ — ให้เบราว์เซอร์จัดการเองตามปกติ
  if (e.request.url.includes('.supabase.co')) return;

  const isCore = e.request.destination === 'document' || e.request.url.endsWith('app.js') || e.request.url.endsWith('supabase-sync.js');

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
