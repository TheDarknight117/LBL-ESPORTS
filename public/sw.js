const CACHE_NAME = 'lbl-cache-v2';
const ASSETS = [
  '/',
  '/index',
  '/registro',
  '/dashboard',
  '/editar',
  '/equipos',
  '/scouting',
  '/dist/output.css',
  '/assets/logo.png',
  '/assets/logo2.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Install Event - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching static assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event - Stale-while-revalidate strategy for local assets
self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Ignore Firebase SDK/API calls
  if (
    e.request.url.includes('firestore.googleapis.com') || 
    e.request.url.includes('identitytoolkit.googleapis.com') ||
    e.request.url.includes('firebasejs')
  ) {
    return;
  }

  let requestToProcess = e.request;
  const url = new URL(e.request.url);
  
  // Normalize .html requests to clean URLs
  if (url.pathname.endsWith('.html')) {
    let cleanPath = url.pathname.slice(0, -5);
    if (cleanPath === '/index') cleanPath = '/';
    url.pathname = cleanPath;
    requestToProcess = new Request(url.toString(), {
      method: e.request.method,
      headers: e.request.headers,
      mode: e.request.mode,
      credentials: e.request.credentials,
      redirect: 'follow'
    });
  }

  e.respondWith(
    caches.match(requestToProcess).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch updated version in the background and update cache
        fetch(requestToProcess).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(requestToProcess, networkResponse));
          }
        }).catch(() => {/* Ignore network errors */});
        
        return cachedResponse;
      }
      return fetch(requestToProcess);
    })
  );
});
