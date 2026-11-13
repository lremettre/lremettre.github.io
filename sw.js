/* L.REMETTRE PWA Service Worker
 * - HTML/CSS/JS/JSON: network-first (항상 최신 배포본 우선, 오프라인 시 캐시)
 * - 이미지 썸네일: network-first (슬라이드 표지 변경 즉시 반영, 오프라인 시 캐시)
 * - PDF/영상(성적서·대용량 자료): 캐시하지 않음 (열람 전용 보안 + 용량 보호)
 */
const CACHE = 'lremettre-v20261113174359';
const CORE = [
  './',
  './index.html',
  './viewer.html',
  './presentation.html',
  './css/style.css',
  './js/main.js',
  './js/pwa-install.js',
  './assets/logo/lremettre_emblem.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const path = url.pathname.toLowerCase();
  if (/\.(pdf|mp4|webm|mov|m4v|pptx|xlsx|docx)$/.test(path) || req.headers.has('range')) return;

  // 1) data/resources.json: 항상 최신 네트워크 원본 직행(no-store), 오프라인 시에만 캐시 폴백
  if (path.endsWith('/data/resources.json') || path === 'data/resources.json') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./data/resources.json', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.open(CACHE).then((c) =>
            c.match('./data/resources.json').then((hit) => hit || c.match(req, { ignoreSearch: true }))
          )
        )
    );
    return;
  }

  // 2) 이미지 및 슬라이드 표지 썸네일: network-first + no-cache 재검증 (업데이트 즉시 반영)
  if (/\.(png|jpe?g|webp|gif|svg|ico)$/.test(path)) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        try {
          const res = await fetch(req, { cache: 'no-cache' });
          if (res.ok) {
            c.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch (err) {
          const hit = (await c.match(req)) || (await c.match(req, { ignoreSearch: true }));
          if (hit) return hit;
          throw err;
        }
      })
    );
    return;
  }

  // 3) HTML / CSS / JS / manifest 등 핵심 앱 리소스: network-first + no-cache 재검증
  e.respondWith(
    (async () => {
      try {
        const target = req.mode === 'navigate' ? req.url : req;
        const res = await fetch(target, { cache: 'no-cache' });
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const exact = await caches.match(req);
        if (exact) return exact;
        const normalized = await caches.match(req, { ignoreSearch: true });
        if (normalized) return normalized;
        if (req.mode === 'navigate') {
          const fallbackHtml = await caches.match('./index.html', { ignoreSearch: true });
          if (fallbackHtml) return fallbackHtml;
        }
        throw err;
      }
    })()
  );
});
