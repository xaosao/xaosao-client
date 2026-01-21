const CACHE_NAME = 'xaosao-v6';
const STATIC_CACHE = 'xaosao-static-v6';
const DYNAMIC_CACHE = 'xaosao-dynamic-v6';

// Assets to cache immediately on install
// NOTE: Don't cache '/' as it's dynamic and depends on auth state
// NOTE: Only include files that definitely exist to prevent install failure
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/images/logo-pink.png',
  '/images/logo-white.png',
  '/images/icon.png',
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

  // For static assets (JS, CSS) - NETWORK FIRST to ensure fresh code
  // This prevents iOS Safari caching issues where old JS causes hydration errors
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses for offline fallback
          if (shouldCacheResponse(response)) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache only when offline
          return caches.match(request);
        })
    );
    return;
  }

  // For local images (/images/) - network first to prevent stale content
  if (url.pathname.startsWith('/images/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (shouldCacheResponse(response)) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For external images and fonts - cache first (these don't cause hydration issues)
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
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
          }).catch(() => {}); // Ignore network errors for background update
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

// ========================================
// Push Notification Handlers
// ========================================

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    console.log('[SW] No push data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    data = {
      title: 'XaoSao',
      body: event.data.text() || 'New notification',
    };
  }

  // Build notification options
  const options = {
    body: data.body || 'New notification from XaoSao',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    image: data.image,
    tag: data.tag || `notification-${Date.now()}`,
    renotify: true, // Vibrate even if same tag
    requireInteraction: false, // Auto-dismiss on mobile
    vibrate: [200, 100, 200],
    data: {
      url: data.data?.url || '/',
      type: data.data?.type,
      ...data.data,
    },
    actions: data.actions || [],
  };

  // Show notification
  event.waitUntil(
    self.registration.showNotification(data.title || 'XaoSao', options)
      .then(() => console.log('[SW] Notification shown'))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';

  // Handle action buttons
  if (event.action === 'view' || event.action === 'confirm') {
    // Use the URL from notification data
    targetUrl = notificationData.url || '/';
  } else if (event.action === 'dispute') {
    // Navigate to dispute page if booking ID exists
    if (notificationData.bookingId) {
      targetUrl = `/customer/book-service/dispute/${notificationData.bookingId}`;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an existing window with the app
      for (const client of clientList) {
        // Check if any window has the app loaded
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate the existing window
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            data: notificationData,
          });
          return client.focus();
        }
      }

      // No existing window - open new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Handle push subscription change (browser renewed the subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');

  event.waitUntil(
    // Re-subscribe with the new subscription
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Send new subscription to server
        return fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        });
      })
      .catch((err) => console.error('[SW] Failed to resubscribe:', err))
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
