// ❶ バージョンを上げるたびに文字列を変える（更新検知用）
const CACHE = 'mood-cache-v7';   // ← v3 から上げる
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ❷ インストール時：必要ファイルをプレキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // すぐ新SWに切替準備
});

// ❸ 有効化時：古いキャッシュを掃除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim(); // 開いているタブにも即反映
});

// ❹ フェッチ戦略：
//   - 自前ファイルは cache-first（オフライン強い）
//   - CDN等は network-first（更新に強い）→失敗時はキャッシュ
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwn = url.origin === self.location.origin;

  if (isOwn) {
    // 自前: まずキャッシュ、なければネット
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  } else {
    // 外部(CDNなど): まずネット、ダメならキャッシュ
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

