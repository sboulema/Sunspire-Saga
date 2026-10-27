// Sunspire Saga service worker: lets the site be installed as an app and keeps the game playable offline.
// Pages and scripts come from the network first, so a new release shows up on the next launch, and from
// the cache when the network fails. Art and the web fonts come from the cache first: the art only
// changes with a new filename, and the fonts never do.
// Name the cache after its layout; bump it when the caching rules change so old caches are dropped.
const CACHE = 'sunspire-site-v2';
const SHELL = ['./', 'play', 'game.js', 'manifest.webmanifest', 'assets/site.css', 'assets/site.js',
  'assets/favicon.ico', 'assets/sunspire-mark-512.png', 'assets/sunspire-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  // site.css and site.js live in assets/ too but change with releases, so they go network-first
  const art = url.pathname.includes('/assets/') && !/\.(css|js)$/.test(url.pathname);
  e.respondWith(fonts || art ? fromCache(req) : fromNetwork(req));
});

async function fromNetwork(req){
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    // a redirected response (play.html -> play) must not be handed back to a later navigation
    if (res.ok && !res.redirected) c.put(req, res.clone());
    return res;
  } catch (err){
    // the app's start URL carries ?app=1; the cached page is the same without it
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate'){ const play = await c.match('play'); if (play) return play; }
    throw err;
  }
}
async function fromCache(req){
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') c.put(req, res.clone());
  return res;
}
