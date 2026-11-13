// Service worker template. build/service-worker-plugin.js fills in the placeholders below
// at build time, so every deploy gets its own cache and older caches are deleted.
//
// Strategy:
// - Page navigations: network first, so a new deploy shows up on the next load; the cached
//   page is used only when offline.
// - Other same-origin files: cache first. They are content-hashed, so a cached copy is never
//   stale. The app shell is cached on install; the large lazy chunks (pdf.js, ExcelJS) are
//   cached the first time they are used.
//
// The page itself and the shell bypass the browser's HTTP cache. GitHub Pages lets browsers
// cache every file for 10 minutes, so a plain fetch could hand back the previous deploy's page
// (pointing at files the new deploy removed) right after this worker deleted the old cache.
const CACHE_PREFIX = __CACHE_PREFIX__;
const CACHE = `${CACHE_PREFIX}${__BUILD_HASH__}`;
const APP_SHELL = __APP_SHELL__;
/** Cache key of the page, used as the offline fallback for navigations. */
const PAGE_KEY = './';

self.addEventListener('install', (event) => {
  // 'reload' fetches from the server and skips the HTTP cache, so the shell is this build's.
  const requests = APP_SHELL.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(requests))
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
    // 'no-cache' revalidates with the server (cheap when unchanged) instead of trusting the
    // HTTP cache. Fetching by URL avoids copying a navigate-mode request, which some browsers reject.
    const response = await fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' });
    // A navigation must not be answered with a followed redirect (e.g. /repo -> /repo/);
    // send a real redirect so the browser updates the address bar.
    if (response.redirected) return Response.redirect(response.url, 302);
    if (isCacheable(response)) event.waitUntil(cache.put(PAGE_KEY, response.clone()));
    return response;
  } catch (error) {
    // Offline: fall back to the cached page; rethrow when there is none.
    const cached = await cache.match(PAGE_KEY);
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
