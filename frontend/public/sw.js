const CACHE_NAME = 'calcoach-v2';
const API_CACHE_NAME = 'calcoach-api-v1';

// Static assets pre-cached on install
const STATIC_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// API paths whose responses are worth caching between sessions.
// Meals are deliberately excluded — showing yesterday's log as "today" would be confusing.
const CACHEABLE_API_PREFIXES = [
  '/api/stats/',
  '/api/progress/',
  '/api/settings/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((n) => n !== CACHE_NAME && n !== API_CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API calls to stats/progress/settings: stale-while-revalidate.
  // Serve whatever is cached instantly; always fetch from network in the
  // background to keep the cache up-to-date for the next session.
  // The JS layer clears this cache (via caches.delete) whenever a mutation
  // happens, so stale meal data never leaks through.
  const isCacheableApi = CACHEABLE_API_PREFIXES.some((p) =>
    url.pathname.startsWith(p)
  );
  if (isCacheableApi) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);

        // Always fire a network request to keep cache fresh for next session.
        const networkPromise = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => null);

        // Return cached immediately if available; otherwise wait for network.
        return cached || networkPromise;
      })
    );
    return;
  }

  // All other API calls (/api/meals/, etc.): skip cache, always go to network.
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: network-first, fall back to cache for offline resilience.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
