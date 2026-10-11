// Offline support. Network first, so new versions show up straight away; the cache is only
// used when there is no connection. Bump VERSION to drop old caches.
const VERSION = 'sq-v15';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon-192.png',
  'js/app.js', 'js/engine.js', 'js/config.js', 'js/store.js', 'js/coach.js', 'js/map.js', 'js/intro.js',
  'js/sound.js', 'js/motivation.js', 'js/challenges.js', 'js/calendar.js',
  'js/data/tracks.js', 'js/data/exercises.js', 'js/data/motivation.js', 'js/time.js', 'js/goal.js', 'js/tri.js', 'js/trimap.js', 'js/data/tri.js', 'js/actions.js', 'js/hybrid.js', 'js/data/hybrid.js', 'js/standards.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !fonts) return; // the coach Worker and other sites go straight to the network
  // cache: 'no-cache' asks the server whether the file changed (instead of reusing the browser's
  // 10-minute copy), so a new version shows up on the next open.
  e.respondWith(
    fetch(req, sameOrigin ? { cache: 'no-cache' } : {})
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
