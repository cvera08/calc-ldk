// Service worker: la app abre sin internet.
// Los archivos propios se sirven desde la caché al instante y se actualizan en
// segundo plano; la versión nueva aparece la próxima vez que se abre la app.
// Cambiar VERSION cuando se agregan o quitan archivos de la lista.
const VERSION = "2";
const CACHE = "calc-ldk-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "js/calc.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// Borra solo las cachés viejas de esta app: el dominio cvera08.github.io lo
// comparten las otras apps y sus cachés no se tocan.
self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("calc-ldk-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const own = url.origin === location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
  if (!own && !FONTS.test(req.url)) return;

  ev.respondWith(caches.open(CACHE).then(async (cache) => {
    // Las navegaciones (abrir la app) siempre resuelven a la página principal
    const key = req.mode === "navigate" ? "./" : req;
    const hit = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
    const net = fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") cache.put(key, res.clone());
      return res;
    });
    if (hit) { ev.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
