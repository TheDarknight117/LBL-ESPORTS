const CACHE_NAME = 'lbl-cache-v96';
const ASSETS = [
  '/',
  '/torneos',
  '/registro',
  '/dashboard',
  '/editar',
  '/equipos',
  '/scouting',
  '/auditoria-core.js',
  '/staff-config.js',
  '/dist/output.css',
  '/assets/logo.png',
  '/assets/logo2.png',
  '/assets/LBL%20Circular.png',
  '/assets/SEO%20LBL%20etiqueta.png',
  '/assets/scouting1.json',
  '/assets/qualifier.json',
  '/assets/heraldo.png'
];

// Install Event - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching static assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-while-revalidate strategy for local assets
self.addEventListener('fetch', (e) => {
  // Cache external team logos (Discord CDN, Imgur, Firebase Storage, Google, etc.)
  if (!e.request.url.startsWith(self.location.origin)) {
    const isImage = e.request.destination === 'image' || 
                    e.request.url.match(/\.(png|jpg|jpeg|svg|webp|gif)(\?.*)?$/i) ||
                    e.request.url.includes('discordapp') ||
                    e.request.url.includes('imgur.com') ||
                    e.request.url.includes('firebasestorage') ||
                    e.request.url.includes('googleusercontent.com');

    if (isImage && e.request.method === 'GET') {
      e.respondWith(
        caches.open('lbl-team-logos-cache').then((cache) => {
          return cache.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
              // Background update
              fetch(e.request).then((netRes) => {
                if (netRes && netRes.ok) cache.put(e.request, netRes);
              }).catch(() => {});
              return cachedResponse;
            }
            return fetch(e.request).then((netRes) => {
              if (netRes && netRes.ok) cache.put(e.request, netRes.clone());
              return netRes;
            }).catch(() => {});
          });
        })
      );
    }
    return;
  }

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
  
  // Normalize SPA /torneos/* navigation requests to clean /torneos
  if (url.pathname.startsWith('/torneos') && !url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|json)$/i)) {
    url.pathname = '/torneos';
    requestToProcess = new Request(url.toString(), {
      method: e.request.method,
      headers: e.request.headers,
      mode: e.request.mode,
      credentials: e.request.credentials,
      redirect: 'follow'
    });
  } else if (url.pathname.endsWith('.html')) {
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
