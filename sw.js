// Offline support. Network first, so new versions show up straight away; the cache is only
// used when there is no connection. Bump VERSION to drop old caches.
const VERSION = 'sq-v111';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/logo-96.png', 'icons/favicon-32.png',
  'js/app.js', 'js/engine.js', 'js/config.js', 'js/store.js', 'js/coach.js', 'js/map.js', 'js/fog.js', 'js/stats.js', 'js/data/norms.js', 'js/data/races.js', 'js/data/features.js', 'js/data/other.js', 'js/events.js', 'js/target.js', 'js/nutrition.js', 'js/splits.js', 'js/age.js', 'js/cycle.js', 'js/data/changelog.js', 'js/home.js', 'js/data/home.js', 'js/data/kids.js', 'js/gym.js', 'js/data/gym.js', 'js/gymmap.js', 'js/intro.js',
  'js/sound.js', 'js/motivation.js', 'js/challenges.js', 'js/calendar.js',
  'js/data/tracks.js', 'js/data/exercises.js', 'js/data/motivation.js', 'js/time.js', 'js/goal.js', 'js/tri.js', 'js/trimap.js', 'js/data/tri.js', 'js/actions.js', 'js/hybrid.js', 'js/data/hybrid.js', 'js/standards.js', 'js/background.js',
  'sounds/stroke.mp3', 'sounds/stroke2.mp3', 'sounds/splash.mp3', 'sounds/pool.mp3', 'sounds/grunt1.mp3', 'sounds/grunt2.mp3', 'sounds/grunt3.mp3', 'sounds/heave.mp3'];

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
