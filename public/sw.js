// Stale-while-revalidate runtime cache: after the first visit the app (incl. bundled libs)
// works offline. Asset file names are content-hashed, so updates arrive on the next load.
const CACHE = 'pdf-tables-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);

      const network = fetch(request).then((response) => {
        // only cache complete, same-origin responses (206 partial content can't be cached)
        if (response.ok && response.status === 200 && response.type === 'basic') {
          event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
        }
        return response;
      });

      if (cached) {
        event.waitUntil(network.catch(() => undefined)); // refresh in background
        return cached;
      }
      return network.catch(() => Response.error());
    })(),
  );
});
