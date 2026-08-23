// Cache name bumped v3 -> v4 so the activate handler purges the old cache.
// Necessary, not cosmetic: the previous version could have stored a NON-index
// page under the '/index.html' key (see the navigate handler below), and that
// poisoned entry has to be cleared.
const CACHE_NAME = 'mep-rp-v4';
const SHELL_ASSETS = [
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
];

// Pages on this origin that are NOT the Resource Plan. They are deployed
// independently and must stay entirely outside this worker: no caching, no
// offline fallback, no shared update lifecycle. Add future sibling apps here.
const STANDALONE_PAGES = ['/pump.html'];

function isStandalone(pathname){
  return STANDALONE_PAGES.some(p => pathname === p || pathname.startsWith(p.replace('.html','') + '/'));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  let path = '';
  try { path = new URL(req.url).pathname; } catch (err) { path = ''; }

  // Supabase always live
  if (req.url.includes('supabase.co')) {
    e.respondWith(fetch(req));
    return;
  }

  // Standalone sibling apps (e.g. the pump calculator): straight to network,
  // never cached. Their deploys are then completely independent of this app's.
  if (isStandalone(path)) {
    e.respondWith(fetch(req));
    return;
  }

  if (req.mode === 'navigate') {
    // PREVIOUSLY: every navigation was written to the cache under the hardcoded
    // key '/index.html', whatever page had actually been requested. Opening any
    // other page on this origin therefore overwrote the Resource Plan's offline
    // copy with that page's HTML, and the offline fallback below then served
    // the wrong app. Only the app's own entry point is cached now.
    const isAppShell = (path === '/' || path === '/index.html');
    if (!isAppShell) {
      e.respondWith(fetch(req));
      return;
    }
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          // Only store a genuinely good response — caching a 404 or a captive
          // portal page would leave the app permanently broken offline.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else (pinned CDN libs, manifest): cache-first, they don't change
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
