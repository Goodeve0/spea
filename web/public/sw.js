/* Speak Coach Service Worker — 离线外壳缓存 */
// CACHE 版本号在构建时由 vite.config.ts swVersionPlugin() 注入（格式：speak-coach-<sha>-<date>）
// 开发模式下保留字面量 __SW_CACHE_VERSION__，SW 不会被注册（vite dev 不复制 public/sw.js 到 dist）
const CACHE = '__SW_CACHE_VERSION__';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/mascot-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 仅处理同源静态资源；跨域的后端 API / LLM 代理不缓存、不拦截
  if (url.origin !== self.location.origin) return;

  // 页面导航：network-first，离线回退到缓存的外壳（保证离线可打开）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // 其他静态资源：stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
