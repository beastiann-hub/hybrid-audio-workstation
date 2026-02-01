// Service Worker for Hybrid Audio Workstation
// Provides offline support and caching

const CACHE_NAME = 'haw-v1.1.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './engine.js',
  './core.js',
  './tracks.js',
  './chopper.js',
  './sequencer.js',
  './effects.js',
  './midi.js',
  './storage.js',
  './beat-detection.js',
  './ai-features.js',
  './soundtouch_min.js',
  './touch-handler.js',
  './manifest.json'
];

// External resources to cache
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/webmidi@latest/dist/iife/webmidi.iife.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache static assets (fail gracefully if some don't exist)
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err))
          )
        );
      })
      .then(() => {
        // Cache external assets separately
        return caches.open(CACHE_NAME).then(cache => 
          Promise.allSettled(
            EXTERNAL_ASSETS.map(url =>
              fetch(url)
                .then(response => cache.put(url, response))
                .catch(err => console.warn(`[SW] Failed to cache external ${url}:`, err))
            )
          )
        );
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // For audio files, use network-first strategy
  if (request.url.match(/\.(wav|mp3|ogg|flac|m4a)$/i)) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // For API calls, always use network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }
  
  // For everything else, use cache-first strategy
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Update cache in background
    fetchAndCache(request);
    return cachedResponse;
  }
  return fetchAndCache(request);
}

// Network-first strategy  
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network-only strategy
async function networkOnly(request) {
  return fetch(request);
}

// Fetch and update cache
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Fetch failed:', request.url);
    throw error;
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Background sync for saving projects (future feature)
self.addEventListener('sync', (event) => {
  if (event.tag === 'save-project') {
    event.waitUntil(syncProject());
  }
});

async function syncProject() {
  // Future: sync project data when back online
  console.log('[SW] Syncing project data...');
}
