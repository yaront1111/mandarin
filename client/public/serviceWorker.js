// Ultra Simple Service Worker for Flirtss
// Version that only handles the bare minimum and avoids caching errors
const CACHE_NAME = 'flirtss-cache-v3';

// Minimal set of static assets that should definitely exist
const MINIMAL_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/default-avatar.png'
];

// Install event - cache only essential assets
self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('Caching minimal assets');
        
        // Cache each asset individually to prevent entire batch from failing
        for (const url of MINIMAL_ASSETS) {
          try {
            const response = await fetch(url);
            if (response && response.status === 200) {
              await cache.put(url, response);
              console.log(`Successfully cached: ${url}`);
            } else {
              console.warn(`Skipping cache for ${url}: Invalid response`);
            }
          } catch (assetError) {
            console.warn(`Failed to cache asset ${url}:`, assetError.message);
            // Continue with next asset
          }
        }
        
        // Try to cache homepage separately
        try {
          const homeResponse = await fetch('/');
          if (homeResponse && homeResponse.status === 200) {
            await cache.put('/', homeResponse);
            console.log('Successfully cached homepage');
          }
        } catch (homeError) {
          console.warn('Could not cache homepage:', homeError.message);
        }
        
        console.log('Minimal caching completed');
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

// Fetch event - network first with simple fallback
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
  
  // For fonts, always go to network (avoid caching issues)
  if (requestUrl.pathname.includes('/fonts/') || 
      requestUrl.pathname.endsWith('.woff2') || 
      requestUrl.pathname.endsWith('.woff') || 
      requestUrl.pathname.endsWith('.ttf')) {
    return;
  }
  
  // For HTML requests or app routes - Network first, cache fallback
  if (requestUrl.pathname === '/' || 
      requestUrl.pathname.endsWith('.html') || 
      !requestUrl.pathname.includes('.')) {
    
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(event.request);
          
          // If network is successful, clone and update cache
          if (networkResponse && networkResponse.status === 200) {
            try {
              const cache = await caches.open(CACHE_NAME);
              cache.put(event.request, networkResponse.clone());
            } catch (cacheError) {
              console.warn('Failed to update cache:', cacheError.message);
            }
          }
          
          return networkResponse;
        } catch (networkError) {
          console.log('Network request failed, falling back to cache');
          
          try {
            // Try to get from cache
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If no direct match, try the index as fallback for SPA
            return await caches.match('/index.html');
          } catch (cacheError) {
            console.error('Cache fallback failed:', cacheError.message);
            // Return a simple offline page
            return new Response('You are offline and the app failed to load from cache.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          }
        }
      })()
    );
    return;
  }
  
  // For other assets - simple fetch with offline fallback
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        return response;
      } catch (error) {
        console.log('Network fetch failed, trying cache:', error.message);
        
        try {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
        } catch (cacheError) {
          console.error('Cache fetch also failed:', cacheError.message);
        }
        
        // If both network and cache fail for images, return a placeholder
        if (requestUrl.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
          return caches.match('/default-avatar.png');
        }
        
        // For other resources, return a generic response
        return new Response('Resource unavailable offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
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