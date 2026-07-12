const CACHE = "legado-v30-cadastro-cliente";
const ASSETS = [
  "./", "./index.html", "./admin.html", "./privacidade.html", "./styles.css", "./admin.css", "./core.js", "./app.js", "./admin.js", "./supabase-bridge.js", "./manifest.webmanifest",
  "./assets/logo.png", "./assets/logo-192.png", "./assets/logo-512.png", "./assets/favicon.png", "./assets/gilliel-apresentacao.webp", "./assets/corte.webp", "./assets/barba.webp", "./assets/produtos.webp", "./assets/agendamento.webp"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match("./index.html"))));
});
