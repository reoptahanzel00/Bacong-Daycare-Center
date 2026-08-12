// Barangay Bacong Daycare Tracker — Service Worker
//
// Network-first strategy: pages are ALWAYS fetched fresh from the network so
// deploys are visible immediately. The cache is only an offline fallback.
// API calls and Next.js static bundles are never intercepted.

const CACHE_NAME = 'bacong-daycare-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept API calls or Next.js static bundles (avoids stale chunks).
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses (clone) for offline fallback.
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Last-resort offline navigation fallback.
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        })
      )
  );
});
