const CACHE_NAME = 'calcoach-v3';
const API_CACHE_NAME = 'calcoach-api-v2';

// Static assets pre-cached on install
const STATIC_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// API paths whose responses are cached between sessions using stale-while-revalidate.
// The JS layer clears this cache on any mutation so stale data is never shown after a write.
// coach-init is included: showing the previous session's meal log for a fraction of a second
// while the serverless function cold-starts is far better than a 5+ second blank screen.
const CACHEABLE_API_PREFIXES = [
  '/api/meals/coach-init',
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

// Keep-warm: ping a lightweight endpoint every 8 minutes so the Python serverless
// function never goes cold (Vercel shuts it down after ~15 min of inactivity).
// The /api/settings/ call is cheap (no AI, no heavy computation).
const WARM_INTERVAL_MS = 8 * 60 * 1000;
function scheduleWarmPing() {
  setTimeout(async () => {
    try { await fetch('/api/settings/'); } catch (_) {}
    scheduleWarmPing();
  }, WARM_INTERVAL_MS);
}
scheduleWarmPing();

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
