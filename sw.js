const CACHE = "legado-v31-supabase-fix";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./privacidade.html",
  "./styles.css",
  "./admin.css",
  "./core.js",
  "./app.js",
  "./admin.js",
  "./supabase-config.js",
  "./supabase-bridge.js",
  "./manifest.webmanifest",
  "./assets/logo.png",
  "./assets/logo-192.png",
  "./assets/logo-512.png",
  "./assets/favicon.png",
  "./assets/gilliel-apresentacao.webp",
  "./assets/corte.webp",
  "./assets/barba.webp",
  "./assets/produtos.webp",
  "./assets/agendamento.webp"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (request.mode === "navigate" ? cache.match("./index.html") : Response.error());
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const freshExtensions = /\.(?:html|js|css|json|webmanifest)$/i;
  if (request.mode === "navigate" || freshExtensions.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
