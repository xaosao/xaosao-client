const CACHE_NAME = 'xaosao-v4';
const STATIC_CACHE = 'xaosao-static-v4';
const DYNAMIC_CACHE = 'xaosao-dynamic-v4';

// Assets to cache immediately on install
// NOTE: Don't cache '/' as it's dynamic and depends on auth state
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/images/logo-pink.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-192x192.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Helper function to check if response should be cached
function shouldCacheResponse(response) {
  // Only cache successful responses
  if (!response || !response.ok) return false;

  // Don't cache redirects
  if (response.redirected) return false;

  // Don't cache opaque responses (cross-origin without CORS)
  if (response.type === 'opaque') return false;

  return true;
}

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip API requests - always fetch from network
  if (url.pathname.startsWith('/api/')) return;

  // Skip auth-related routes - always fetch from network (no caching)
  // This prevents issues with login/logout on iOS Safari
  const authPaths = ['/login', '/logout', '/register', '/model-auth', '/model-logout', '/forgot-password', '/reset-password', '/verify-otp'];
  if (authPaths.some(path => url.pathname.startsWith(path))) return;

  // For navigation requests (HTML pages) - ALWAYS go to network
  // Don't cache navigation requests as they depend on auth state and can cause issues on iOS Safari
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache navigation responses - they are dynamic and auth-dependent
          return response;
        })
        .catch((error) => {
          // On network error, don't try to serve cached pages
          // This prevents iOS Safari from getting stuck with stale pages
          console.error('[SW] Navigation fetch failed:', error);
          // Return a simple offline response instead of cached content
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a1a;color:white;text-align:center;"><div><h1>You are offline</h1><p>Please check your internet connection and try again.</p><button onclick="location.reload()" style="padding:12px 24px;background:#f43f5e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">Retry</button></div></body></html>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // For static assets (JS, CSS, images) - cache first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update cache in background
          fetch(request).then((response) => {
            if (shouldCacheResponse(response)) {
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, response);
              });
            }
          });
          return cachedResponse;
        }

        // Not in cache - fetch and cache
        return fetch(request).then((response) => {
          if (shouldCacheResponse(response)) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default - network first with cache fallback (only cache successful responses)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (shouldCacheResponse(response)) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New notification from XaoSao',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'XaoSao', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data?.url || '/';

      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      })
    );
  }

  // Force update - clear all caches and update
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.skipWaiting())
    );
  }

  // Skip waiting when requested
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
