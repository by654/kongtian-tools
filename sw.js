/* 绌哄ぉ宸ュ叿鍚堥泦 路 Service Worker
   鍙紦瀛樺悓婧愰潤鎬佽祫婧愶紱绗笁鏂?CDN 渚濊禆浠嶈蛋缃戠粶锛堟祻瑙堝櫒 HTTP 缂撳瓨锛夈€?*/
const CACHE = 'kongtian-tools-v18';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/app.css',
  './assets/favicon.svg',
  './assets/js/main.js',
  './assets/js/registry.js',
  './assets/js/core/ui.js',
  './assets/js/core/deps.js',
  './assets/js/core/kit.js',
  './assets/js/core/rand.js',
  './assets/js/core/merge-map.js',
  './assets/js/core/merge.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 浠ｇ爜涓庢牱寮忎紭鍏堣蛋缃戠粶锛岄伩鍏嶆洿鏂板悗浠嶆墽琛屾棫閫昏緫锛涚绾挎椂鍥為€€缂撳瓨
  if (['script', 'style', 'worker', 'json'].includes(req.destination)) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
