const CACHE_NAME = 'lbl-cache-v135';
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
  '/challonge-core.js',
  '/image-optimizer.js',
  '/app-version.js',
  '/pwa-manager.js',
  '/assets/pwa-icon-192.png',
  '/assets/pwa-icon-512.png',
  '/dist/output.css',
  '/assets/logo.webp',
  '/assets/logo2.webp',
  '/assets/BARON.webp',
  '/assets/pentakill.webp',
  '/assets/legion_store.webp',
  '/assets/teams/kaox_pink.webp',
  '/assets/teams/marines_del_altiplano.webp',
  '/assets/teams/uka_kitties.webp',
  '/assets/teams/kaox_red.webp',
  '/assets/teams/mapaches_apaches.webp',
  '/assets/teams/kaox_yellow.webp',
  '/assets/teams/strugglers_esports.webp',
  '/assets/teams/team_first_kill.webp',
  '/assets/teams/aether_core_academy.webp',
  '/assets/teams/kaox_green.webp',
  '/assets/teams/quinteto_de_nos.webp',
  '/assets/teams/t1nacotas.webp',
  '/assets/teams/crimson_weasels.webp',
  '/assets/teams/grieta_cumbiera.webp',
  '/assets/teams/team_dark.webp',
  '/assets/teams/snake_dynasty.webp',
  '/assets/teams/rise_of_kings_order.webp',
  '/assets/teams/aether_core.webp',
  '/assets/teams/condor_nexus.webp',
  '/assets/teams/riot_pls_game.webp',
  '/assets/teams/anti_kaox.webp',
  '/assets/teams/kaox_esports.webp',
  '/assets/teams/katz_esports.webp',
  '/assets/teams/ruined_king.webp',
  '/assets/teams/ruined_kings.webp',
  '/assets/teams/kaox_blue.webp',
  '/assets/teams/kaox_purple.webp',
  '/assets/teams/viktus.webp',
  '/assets/teams/solo_kill_pro.webp',
  '/assets/teams/nox_reign.webp'
];

// Install Event - pre-cache critical assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching assets:', CACHE_NAME);
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - purge old caches immediately and claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
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

// Fetch Event - Network-First for JS/HTML code, Cache-First for static images
self.addEventListener('fetch', (e) => {
  // Ignore non-GET requests
  if (e.request.method !== 'GET') return;

  // External images (ImgBB, PostImg, UI-Avatars, Discord CDN, Imgur, Firebase Storage, Google, etc.)
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
        caches.open('lbl-team-logos-cache').then((cache) => {
          return cache.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
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

  // Ignore Firebase SDK & API endpoints
  if (
    e.request.url.includes('firestore.googleapis.com') || 
    e.request.url.includes('identitytoolkit.googleapis.com') ||
    e.request.url.includes('firebasejs') ||
    e.request.url.includes('workers.dev')
  ) {
    return;
  }

  let matchKey = e.request;
  const url = new URL(e.request.url);
  
  // Normalize SPA /torneos/* navigation requests to clean /torneos
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
    // Network-First strategy: Siempre busca el código fresco primero
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(matchKey, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // Si no hay red, usar el cache de respaldo
        return caches.match(matchKey).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (e.request.mode === 'navigate') return caches.match('/');
        });
      })
    );
  } else {
    // Stale-While-Revalidate for local images & assets
    e.respondWith(
      caches.match(matchKey).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(matchKey, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(matchKey, responseToCache));
          }
          return networkResponse;
        });
      })
    );
  }
});
