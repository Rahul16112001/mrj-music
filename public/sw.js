// Service Worker for MRJ Music - Network-First Strategy with Cache Fallback
const CACHE_NAME = 'mrj-music-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always use Network-First for HTML, JS, CSS, and API to prevent stale caching
  if (
    event.request.mode === 'navigate' ||
    event.request.url.includes('/assets/') ||
    event.request.url.includes('/api/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the response
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
        })
    );
    return;
  }

  // Pass through audio streams directly
  if (event.request.url.includes('.mp3') || event.request.url.includes('.webm') || event.request.url.includes('googlevideo')) {
    return;
  }

  // For other static assets, cache with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
