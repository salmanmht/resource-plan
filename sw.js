// MEP Resource Plan — service worker
//
// v5: Supabase and all non-GET requests are now COMPLETELY untouched by this
// worker. Previously they were wrapped in `e.respondWith(fetch(req))`, which
// looks like a pass-through but is not: calling respondWith makes the worker
// OWN the request and re-issue it. With no .catch(), any hiccup in that
// re-fetch rejects the promise and the browser converts it into a network
// error response — surfacing in the app as `TypeError: Failed to fetch`.
// That is what broke sign-in: /auth/v1/token is a cross-origin POST, so it
// went through this path and intermittently died before it ever left the
// browser. Returning without respondWith hands the request to the browser's
// native networking, where it cannot fail this way.
const CACHE_NAME = 'mep-rp-v5';

const SHELL_ASSETS = [
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
];

// Pages on this origin that are NOT the Resource Plan. Deployed independently,
// so they stay entirely outside this worker: no caching, no offline fallback,
// no shared update lifecycle. Add future sibling apps here.
const STANDALONE_PAGES = ['/pump.html', '/spec.html'];

function isStandalone(pathname){
  return STANDALONE_PAGES.some(p => pathname === p || pathname.startsWith(p.replace('.html','') + '/'));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      // addAll() is all-or-nothing: one unreachable CDN and the whole install
      // fails, leaving the app with no worker at all. Cache each asset on its
      // own so a single miss can't take the install down with it.
      .then(cache => Promise.all(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[sw] skipped precache:', url, err))
        )
      ))
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

  // ── NEVER INTERCEPT ──────────────────────────────────────────────────────
  // A bare `return` (no respondWith) leaves the request to the browser.
  // This is the whole fix — do not "helpfully" wrap these in fetch() again.

  // Supabase: auth, REST, storage, realtime. All of it, always live.
  if (req.url.includes('supabase.co')) return;

  // Anything that isn't a GET — logins, saves, uploads, deletes. A cache can
  // never serve these, so there is no reason for the worker to be involved,
  // and every reason for it not to be.
  if (req.method !== 'GET') return;

  // Explicit opt-out marker used by sbFetch() in index.html.
  if (req.headers.get('X-Bypass-SW')) return;

  // Standalone sibling apps (e.g. the pump calculator).
  if (isStandalone(path)) return;

  // ── NAVIGATION ───────────────────────────────────────────────────────────
  if (req.mode === 'navigate') {
    // Only the app's own entry point is cached. Caching every navigation under
    // the hardcoded '/index.html' key meant any other page on this origin
    // overwrote the Resource Plan's offline copy, and the fallback below then
    // served the wrong app.
    const isAppShell = (path === '/' || path === '/index.html');
    if (!isAppShell) return;

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

  // ── EVERYTHING ELSE ──────────────────────────────────────────────────────
  // Pinned CDN libs and the manifest: cache-first, they don't change.
  // The .catch() matters — without it a miss on a file that no longer exists
  // on the server (capacitor.js, the /icons/* set) rejects the FetchEvent and
  // logs a console error instead of just 404-ing quietly.
  e.respondWith(
    caches.match(req)
      .then(cached => cached || fetch(req))
      .catch(() => fetch(req).catch(() => Response.error()))
  );
});
