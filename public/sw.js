// Keeps the app shell (page, scripts, styles, fonts, icons) available offline.
// Training data is not handled here: the app keeps the last good file itself.
const CACHE = 'fitness-dash-v1';
const NETWORK_TIMEOUT_MS = 4000;

// Cache the page and the files it links, so the app also starts offline after the first visit.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch('/', { cache: 'no-cache' });
      const html = await response.clone().text();
      await cache.put('/', response);
      const linked = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll([...new Set(linked)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request)) ?? (request.mode === 'navigate' ? cache.match('/') : undefined);
}

// Network first, so updates show up right away; the cache answers when the server is out of reach.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) });
    if (response.ok) {
      await cache.put(request.mode === 'navigate' ? '/' : request, response.clone());
      return response;
    }
    return (await fromCache(request)) ?? response;
  } catch (error) {
    const cached = await fromCache(request);
    if (cached) return cached;
    throw error;
  }
}

// Files under /assets/ carry a content hash in their name and never change.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/data/')) return;
  event.respondWith(url.pathname.startsWith('/assets/') ? cacheFirst(request) : networkFirst(request));
});
