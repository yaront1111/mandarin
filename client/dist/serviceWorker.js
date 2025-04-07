// Service Worker for Flirtss
const CACHE_NAME = 'flirtss-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/apple-touch-icon.png',
  '/placeholder.svg',
  '/images/social-preview.jpg',
  '/robots.txt',
  '/sitemap.xml'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first with cache fallback strategy for HTML pages
// Cache first with network fallback for static assets
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
  
  // For API requests, don't cache
  if (requestUrl.pathname.startsWith('/api/')) {
    return;
  }
  
  // HTML pages - Network first, cache fallback, cache update
  if (requestUrl.pathname === '/' || 
      requestUrl.pathname.endsWith('.html') || 
      !requestUrl.pathname.includes('.')) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache a copy of the response
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no match in cache, fall back to the index page for SPA
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // For static assets - Cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache bad responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache the new resource
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from Flirtss',
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: {
        url: data.url || '/'
      },
      vibrate: [100, 50, 100],
      actions: [
        {
          action: 'view',
          title: 'View'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Flirtss Notification', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Check if there is already a window/tab open with the target URL
        const url = event.notification.data.url;
        
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window/tab is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Helper function to sync messages
async function syncMessages() {
  try {
    // Get all queued messages from IndexedDB
    const db = await openMessagesDatabase();
    const messages = await getQueuedMessages(db);
    
    if (messages.length === 0) return;
    
    // Try to send each message
    const successes = [];
    
    for (const message of messages) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${message.token}`
          },
          body: JSON.stringify(message.data)
        });
        
        if (response.ok) {
          successes.push(message.id);
        }
      } catch (err) {
        console.error('Failed to sync message:', err);
      }
    }
    
    // Remove successfully sent messages from the queue
    if (successes.length > 0) {
      await removeQueuedMessages(db, successes);
    }
    
  } catch (err) {
    console.error('Error syncing messages:', err);
  }
}

// IndexedDB helper functions
function openMessagesDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('flirtss-messages', 1);
    
    request.onerror = event => reject(event.target.error);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      const store = db.createObjectStore('messages', { keyPath: 'id' });
      store.createIndex('timestamp', 'timestamp');
    };
    
    request.onsuccess = event => resolve(event.target.result);
  });
}

function getQueuedMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const request = store.getAll();
    
    request.onerror = event => reject(event.target.error);
    request.onsuccess = event => resolve(event.target.result);
  });
}

function removeQueuedMessages(db, ids) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    
    let completed = 0;
    
    ids.forEach(id => {
      const request = store.delete(id);
      
      request.onerror = event => reject(event.target.error);
      
      request.onsuccess = () => {
        completed++;
        if (completed === ids.length) {
          resolve();
        }
      };
    });
    
    transaction.onerror = event => reject(event.target.error);
  });
}