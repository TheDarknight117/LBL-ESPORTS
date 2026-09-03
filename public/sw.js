const CACHE_NAME = 'lbl-cache-v115';
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
  '/dist/output.css',
  '/assets/logo.webp',
  '/assets/logo2.webp',
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
  '/assets/teams/ruined_king.webp'
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
  // Cache external team logos (ImgBB, PostImg, UI-Avatars, Discord CDN, Imgur, Firebase Storage, Google, etc.)
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

  e.respondWith(
    caches.match(matchKey).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch updated version in the background and update cache
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(matchKey, networkResponse));
          }
        }).catch(() => {/* Ignore network errors */});
        
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(matchKey, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
