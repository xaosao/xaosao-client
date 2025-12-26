const CACHE_NAME = 'xaosao-v3';
const STATIC_CACHE = 'xaosao-static-v3';
const DYNAMIC_CACHE = 'xaosao-dynamic-v3';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/images/logo-pink.png',
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

  // For navigation requests (HTML pages) - network first, NO CACHING
  // This prevents caching error pages that get "stuck"
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful navigation responses
          if (shouldCacheResponse(response)) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request).then((cachedResponse) => {
            // Only return cached response if it exists and was successful
            if (cachedResponse && cachedResponse.ok) {
              return cachedResponse;
            }
            // Fallback to home page if available
            return caches.match('/');
          });
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

// Listen for messages from the main thread to clear cache
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      })
    );
  }
});
