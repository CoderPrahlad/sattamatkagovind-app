// Cache version - BUMP THIS to force all clients to refresh
const CACHE_NAME = 'matkaking-v5';
const STATIC_ASSETS = [
  '/favicon.ico',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
  '/icons/icon-150.png',
  '/icons/favicon-32.png',
  '/icons/favicon-16.png',
  '/manifest.json',
];

// Install: cache only truly static assets (icons, manifest)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: NETWORK FIRST for everything
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ success: false, error: 'You are offline' }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // ALL other requests (HTML, JS, CSS): NETWORK FIRST
  // This ensures users always get the latest code
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === 'GET' && !request.url.includes('/api/')) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For HTML pages, serve cached root
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
