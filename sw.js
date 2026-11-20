// Offline-first service worker. Online: always fetches the latest files (and refreshes the cache).
// Offline: serves the saved copy so the app still opens and works.
var CACHE = 'class-calendar-v10';
var CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon-64.png', 'badge-logo.png', 'splash-192.png', 'splash-512.png', 'loading-logo.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Firebase SDK modules: cache so sync code can load offline too
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) { return put(req, r); }).catch(function () { return hit; });
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // App files: network first, fall back to the saved copy when offline
  e.respondWith(fetch(req).then(function (r) { return put(req, r); }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html').then(function (h) { return h || caches.match('./'); });
      return Response.error();
    });
  }));
});

// Tapping a reminder opens (or focuses) the app
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
