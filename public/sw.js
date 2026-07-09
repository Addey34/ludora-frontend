/**
 * Games Zone service worker — makes the app installable (PWA) and usable offline.
 *
 * Strategy: network-first for same-origin GET requests. Online users always get
 * fresh content (never a stale cache — important with hashed assets and a live
 * leaderboard); offline users fall back to whatever was cached, and navigations
 * fall back to the cached home shell. Cross-origin (fonts CDN, Google, Nakama)
 * is left untouched.
 */
const CACHE = 'gz-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const home = await caches.match('/');
          if (home) return home;
        }
        throw err;
      }
    })()
  );
});
