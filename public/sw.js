const CACHE_CODE_NAME = 'lbl-code-v282';
const CACHE_ASSETS_NAME = 'lbl-static-assets-v1';
const CACHE_LOGOS_NAME = 'lbl-team-logos-cache';

// Pre-cache mínimo esencial (evita descargas masivas en segundo plano al primer ingreso)
const SHELL_ASSETS = [
  '/',
  '/dist/output.css',
  '/assets/logo.webp',
  '/assets/fonts/Square-One-Bold.ttf'
];

// Install Event - pre-cache únicamente el shell esencial
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_CODE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - purgar cachés de código antiguas conservando las cachés de imágenes/logos
self.addEventListener('activate', (e) => {
  const allowedCaches = new Set([CACHE_CODE_NAME, CACHE_ASSETS_NAME, CACHE_LOGOS_NAME]);
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !allowedCaches.has(key)).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for skip waiting command
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event - Network-First para código, Cache-First estricto (0 bytes repetidos) para imágenes y fuentes
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Excluir archivos multimedia pesados (.mp4, .webm, .ogg, .mp3) para que el navegador use HTTP Range/Cache nativo
  if (url.pathname.match(/\.(mp4|webm|ogg|mp3)(\?.*)?$/i) || e.request.destination === 'video' || e.request.destination === 'audio') {
    return;
  }

  // Imágenes externas (ImgBB, PostImg, UI-Avatars, Discord CDN, Imgur, Firebase Storage, Google, etc.) -> Cache-First Puro
  if (!e.request.url.startsWith(self.location.origin)) {
    const isImage = e.request.destination === 'image' || 
                    e.request.url.match(/\.(png|jpg|jpeg|svg|webp|gif)(\?.*)?$/i) ||
                    e.request.url.includes('discordapp') ||
                    e.request.url.includes('imgur.com') ||
                    e.request.url.includes('ibb.co') ||
                    e.request.url.includes('postimg.') ||
                    e.request.url.includes('postimages.org') ||
                    e.request.url.includes('ui-avatars.com') ||
                    e.request.url.includes('firebasestorage') ||
                    e.request.url.includes('googleusercontent.com');

    if (isImage) {
      e.respondWith(
        caches.open(CACHE_LOGOS_NAME).then((cache) => {
          return cache.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
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

  // Ignorar endpoints de Firebase SDK y APIs dinámicas
  if (
    e.request.url.includes('/api/') ||
    e.request.url.includes('firestore.googleapis.com') || 
    e.request.url.includes('identitytoolkit.googleapis.com') ||
    e.request.url.includes('firebasejs') ||
    e.request.url.includes('workers.dev')
  ) {
    return;
  }

  let matchKey = e.request;
  
  // Normalizar navegación SPA /torneos/* a /torneos
  if (url.pathname.startsWith('/torneos') && !url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|json|webp)$/i)) {
    matchKey = '/torneos';
  } else if (url.pathname.endsWith('.html')) {
    let cleanPath = url.pathname.slice(0, -5);
    if (cleanPath === '/index') cleanPath = '/';
    matchKey = cleanPath;
  }

  const isCodeOrDocument = e.request.mode === 'navigate' || 
                           url.pathname.endsWith('.js') || 
                           url.pathname.endsWith('.css') || 
                           url.pathname.endsWith('.html') ||
                           url.pathname.startsWith('/torneos') ||
                           url.pathname === '/';

  if (isCodeOrDocument) {
    // Network-First para código/HTML (aprovecha HTTP 304 Not Modified y caché por ?v=XXX)
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_CODE_NAME).then((cache) => cache.put(matchKey, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(matchKey).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (e.request.mode === 'navigate') return caches.match('/');
        });
      })
    );
  } else {
    // Cache-First estricto para imágenes estáticas locales, logos de equipos y fuentes (0 re-descargas en segundo plano)
    e.respondWith(
      caches.open(CACHE_ASSETS_NAME).then((cache) => {
        return cache.match(matchKey).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(matchKey, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
  }
});
