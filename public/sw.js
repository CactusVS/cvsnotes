// Заметки - service worker (офлайн-оболочка)
const CACHE = "mn-v3";
const CORE = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/core.js",
  "/games.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API всегда из сети (данные не кэшируем)
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;

  // шрифты - cache-first (для офлайна)
  if (url.host.endsWith("googleapis.com") || url.host.endsWith("gstatic.com")) {
    e.respondWith(cacheFirst(req));
    return;
  }

  // своя статика - network-first, с откатом в кэш
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      const shell = await cache.match("/index.html");
      if (shell) return shell;
    }
    return new Response("Офлайн", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.status === 200 || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response("", { status: 503 });
  }
}
