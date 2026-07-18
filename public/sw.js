/**
 * Ludora service worker — makes the app installable (PWA) and caches static
 * assets for speed/offline.
 *
 * IMPORTANT: it never intercepts navigations (page loads). With clean-URL
 * rewrites, a cached *redirected* response served for a navigation makes the
 * browser throw and the link silently fails — so navigations always go straight
 * to the network. Only same-origin, non-redirected GET assets are cached
 * (network-first). Cross-origin (fonts CDN, Google, Nakama) is left untouched.
 */
const CACHE = 'gz-cache-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop older caches (incl. gz-cache-v1, which could hold bad redirects).
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Let the browser handle navigations and cross-origin/non-GET itself.
  if (req.method !== 'GET' || req.mode === 'navigate') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Never cache redirects or error responses.
        if (fresh.ok && !fresh.redirected) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
