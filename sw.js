/* L.REMETTRE PWA Service Worker
 * - HTML/CSS/JS/JSON: network-first (항상 최신 배포본 우선, 오프라인 시 캐시)
 * - 이미지 썸네일: stale-while-revalidate
 * - PDF/영상(성적서·대용량 자료): 캐시하지 않음 (열람 전용 보안 + 용량 보호)
 */
const CACHE = 'lremettre-v12';
const CORE = [
  './',
  './index.html',
  './viewer.html',
  './css/style.css?v=12',
  './js/main.js?v=12',
  './js/slides-data.js?v=12',
  './assets/logo/lremettre_emblem.png',
  './assets/icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const path = url.pathname.toLowerCase();
  if (/\.(pdf|mp4|webm|mov|m4v|pptx|xlsx|docx)$/.test(path) || req.headers.has('range')) return;

  if (/\.(png|jpe?g|webp|gif|svg)$/.test(path)) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});

