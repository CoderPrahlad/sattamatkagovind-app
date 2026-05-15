// Cache version - BUMP THIS to force all clients to refresh
const CACHE_NAME = 'matkaking-v6';
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
// NOTE: NO skipWaiting() — new SW waits for old tabs to close before activating
// This prevents the blank page flash that was happening every 60 seconds
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Do NOT call self.skipWaiting() — let the new SW wait naturally
  // Users will see an "Update Available" banner instead of auto-reload
});

// Activate: clean ALL old caches
// NOTE: Only claim clients on first install, not on updates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Only claim if this is the first SW (no previous controller)
      // On updates, we wait for user to click "Update" in the banner
      return self.clients.claim();
    })
  );
});

// Listen for skip waiting message from the update banner
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: NETWORK FIRST for everything
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: network first, NO caching (prevents stale data and HTML-in-cache issues)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache API responses — they must always be fresh
          return response;
        })
        .catch(() => {
          // Offline: return a proper JSON error, never HTML
          return new Response(
            JSON.stringify({ success: false, error: 'You are offline. Please check your internet connection.' }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        })
    );
    return;
  }

  // Static assets (icons, images, fonts): Cache First strategy
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && request.method === 'GET') {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        }).catch(() => {
          return new Response('', { status: 404 });
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
        if (response.ok && request.method === 'GET') {
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
