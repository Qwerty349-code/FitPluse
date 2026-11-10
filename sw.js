// Service Worker: офлайн-режим и автоматическое обновление.
// Версия кэша ИЗМЕНЕНА (v22), поэтому у всех, кто уже установил приложение, браузер
// скачает новые файлы, а страница сама перезагрузится один раз.
// Данные пользователя лежат в localStorage и при обновлении не удаляются.
// При следующих правках сайта увеличьте номер версии (v23, v24...).
const CACHE = 'kcal-calc-v22';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.ico', './favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache:'reload' — берём свежие файлы с сервера, а не из HTTP-кэша браузера
      .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// «Сначала кэш, обновление в фоне»: быстро и без сети.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // рекламу и сторонние скрипты не кэшируем
  // Файл подтверждения Google Search Console и служебные файлы поисковиков всегда идут напрямую с сервера, мимо кэша
  if (/^\/google[0-9a-f]+\.html$/i.test(url.pathname) || /^\/(robots\.txt|sitemap.*\.xml)$/i.test(url.pathname)
      || /\.apk$/i.test(url.pathname) || url.pathname.indexOf('/.well-known/') === 0) return;   // APK и файлы проверки приложения всегда с сервера

  // Открытие страницы: сначала сеть (всегда свежая версия), при отсутствии интернета — копия из кэша
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const fresh = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit || cache.match('./index.html'));
        return hit || fresh;
      })
    )
  );
});
