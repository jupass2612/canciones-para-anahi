// Guarda la app para que abra rápido y funcione sin internet.
// Las canciones descargadas se guardan aparte (IndexedDB) y se reproducen desde ahí.
const PREFIX = "anahi-";
const CACHE = PREFIX + "v7";
const COVERS = PREFIX + "covers";
const FONTS = PREFIX + "fonts";
const SHELL = ["./", "index.html", "manifest.webmanifest", "songs/songs.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  // Solo borra cachés viejas de esta misma app (otra app puede vivir en el mismo dominio).
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== FONTS && k !== COVERS).map(k => caches.delete(k)))));
  self.clients.claim();
});

const networkFirst = async (req, key) => {
  const cache = await caches.open(CACHE);
  try {
    const r = await fetch(req);
    if (r.ok) cache.put(key || req, r.clone());
    return r;
  } catch {
    return (await cache.match(key || req, { ignoreSearch: true })) || (await cache.match("index.html")) || Response.error();
  }
};

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return; // el audio en línea se transmite directo
  const url = new URL(req.url);

  // Tipografías de Google: se guardan para que la app se vea igual sin internet.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // Portadas (Apple Music): se guardan para verse sin internet.
  if (url.hostname.endsWith("mzstatic.com")) {
    e.respondWith(caches.open(COVERS).then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return; // GitHub, letras y traductor van directo

  // Lista de canciones y la página: primero internet (para ver lo nuevo); sin internet, la copia guardada.
  if (url.pathname.endsWith("/calendar.json")) { e.respondWith(networkFirst(req, new URL("calendar.json", self.registration.scope).href)); return; }
  if (url.pathname.endsWith("/config.json")) { e.respondWith(networkFirst(req, new URL("config.json", self.registration.scope).href)); return; }
  if (url.pathname.endsWith("/songs/songs.json")) { e.respondWith(networkFirst(req, new URL("songs/songs.json", self.registration.scope).href)); return; }
  if (req.mode === "navigate") { e.respondWith(networkFirst(req, new URL("index.html", self.registration.scope).href)); return; }
  if (/\.(mp3|m4a|aac|wav|ogg)$/i.test(url.pathname)) return; // los audios no se duplican aquí

  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
    return r;
  })));
});

// Avisos de canciones nuevas
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Tienes una canción nueva", {
    body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag || "nueva",
    data: { url: d.url || self.registration.scope }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.navigate ? w.navigate(url).then(x => (x || w).focus()) : w.focus(); return; }
    return self.clients.openWindow(url);
  }));
});
