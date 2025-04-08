// Ultra Simple Service Worker for Flirtss
// Version that only handles the bare minimum and avoids caching errors
const CACHE_NAME = 'flirtss-cache-v4';

// Empty minimal assets list - we'll handle caching individually
const MINIMAL_ASSETS = [];

// Install event - skip caching on install to avoid errors
self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    (async () => {
      try {
        // Just open the cache but don't try to preload anything
        await caches.open(CACHE_NAME);
        console.log('Service worker installed successfully');
      } catch (error) {
        console.error('Service worker installation failed:', error.message);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    (async () => {
      try {
        // Get all cache names
        const cacheNames = await caches.keys();
        
        // Delete old caches
        await Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
        
        // Take control of all clients
        await self.clients.claim();
        console.log('Service worker now controlling all clients');
      } catch (error) {
        console.error('Error during service worker activation:', error.message);
      }
    })()
  );
});

// Fetch event - network-only policy to prevent caching issues
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  const requestUrl = new URL(event.request.url);
  
  // Don't handle API or socket requests
  if (requestUrl.pathname.startsWith('/api/') || 
      requestUrl.pathname.startsWith('/socket.io/')) {
    return;
  }
  
  // Don't handle font requests at all - let the browser handle them
  if (requestUrl.pathname.includes('/fonts/') || 
      requestUrl.pathname.endsWith('.woff2') || 
      requestUrl.pathname.endsWith('.woff') || 
      requestUrl.pathname.endsWith('.ttf')) {
    return;
  }
  
  // For HTML requests or app routes - Network with minimal fallback
  if (requestUrl.pathname === '/' || 
      requestUrl.pathname.endsWith('.html') || 
      !requestUrl.pathname.includes('.')) {
    
    event.respondWith(
      (async () => {
        try {
          // Always try network first, don't attempt to cache
          return await fetch(event.request);
        } catch (networkError) {
          console.log('Network request failed, attempt minimal fallback');
          
          try {
            // Only try to get index.html from cache as a last resort
            const indexFallback = await caches.match('/index.html');
            if (indexFallback) {
              return indexFallback;
            }
          } catch (cacheError) {
            // Ignore cache errors
          }
          
          // Return a simple offline message
          return new Response('You are offline. Please check your connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    return;
  }
  
  // For all other assets - network-only strategy to avoid caching issues
  // Only fall back to cache for critical assets
  const isCriticalAsset = (
    requestUrl.pathname === '/manifest.json' || 
    requestUrl.pathname === '/default-avatar.png' ||
    requestUrl.pathname.includes('logo')
  );
  
  if (isCriticalAsset) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch (error) {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Let the browser handle the failure for non-critical assets
          return new Response('Resource unavailable', { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain' } 
          });
        }
      })()
    );
  }
  // For non-critical assets, let the browser handle them normally
});

// Push notification with better error handling
self.addEventListener('push', event => {
  if (!event.data) return;
  
  event.waitUntil(
    (async () => {
      try {
        // Try to parse the data
        let data;
        try {
          data = event.data.json();
        } catch (parseError) {
          // Fallback if JSON parsing fails
          data = {
            title: 'New notification',
            body: event.data.text() || 'You have a new notification',
            url: '/'
          };
        }
        
        // Check if notification permission is granted
        if (self.Notification && self.Notification.permission === 'granted') {
          // Basic notification options with fallbacks
          const options = {
            body: data.body || 'New notification from Flirtss',
            icon: '/default-avatar.png', // Use default avatar as fallback
            badge: '/default-avatar.png',
            data: {
              url: data.url || '/'
            },
            vibrate: [100, 50, 100],
            requireInteraction: false
          };
          
          // Show the notification
          await self.registration.showNotification(
            data.title || 'Flirtss Notification', 
            options
          );
        }
      } catch (error) {
        console.error('Push notification error:', error.message);
      }
    })()
  );
});

// Simplified notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    (async () => {
      try {
        const url = event.notification.data?.url || '/';
        const clients = await self.clients.matchAll({ type: 'window' });
        
        // Try to focus an existing window first
        for (const client of clients) {
          if (client.url === url && 'focus' in client) {
            await client.focus();
            return;
          }
        }
        
        // Otherwise open a new window
        if (self.clients.openWindow) {
          await self.clients.openWindow(url);
        }
      } catch (error) {
        console.error('Error handling notification click:', error.message);
      }
    })()
  );
});