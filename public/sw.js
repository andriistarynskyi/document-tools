// Service worker template. build/service-worker-plugin.js fills in the placeholders below
// at build time, so every deploy gets its own cache and older caches are deleted.
//
// Strategy:
// - Page navigations: network first, so a new deploy shows up on the next load; the cached
//   page is used only when offline.
// - Other same-origin files: cache first. They are content-hashed, so a cached copy is never
//   stale. The app shell is cached on install; the large lazy chunks (pdf.js, ExcelJS) are
//   cached the first time they are used.
const CACHE_PREFIX = __CACHE_PREFIX__;
const CACHE = `${CACHE_PREFIX}${__BUILD_HASH__}`;
const APP_SHELL = __APP_SHELL__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE))
      .then((stale) => Promise.all(stale.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Caches complete, same-origin responses only (206 partial content cannot be cached). */
function isCacheable(response) {
  return response.ok && response.status === 200 && response.type === 'basic';
}

async function networkFirst(event) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(event.request);
    if (isCacheable(response)) event.waitUntil(cache.put('./', response.clone()));
    return response;
  } catch (error) {
    // Offline: fall back to the cached page; rethrow when there is none.
    const cached = await cache.match('./');
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (isCacheable(response)) event.waitUntil(cache.put(event.request, response.clone()));
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? networkFirst(event) : cacheFirst(event));
});
