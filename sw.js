/* Archives NITA – service worker
   - Page (index.html) : réseau d'abord (3 s max), sinon copie locale → ouverture instantanée et hors connexion.
   - Bibliothèques jsDelivr versionnées (vérifiées par empreinte SRI dans la page) : cache d'abord, immuables.
   - Polices Google : cache, mise à jour en arrière-plan.
   - Données Supabase : JAMAIS interceptées ni mises en cache (passent directement au réseau). */
const V = "archives-v3.2";
const SHELL = ["./", "manifest.json", "icone-192.png", "icone-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V && k.startsWith("archives-")) await caches.delete(k);
    if (self.registration.navigationPreload) try { await self.registration.navigationPreload.enable(); } catch (x) {}
    await self.clients.claim();
  })());
});

const okToStore = r => r && r.ok && (r.type === "basic" || r.type === "cors");

async function pageFirst(e) {
  const c = await caches.open(V);
  const net = (async () => {
    const r = (await e.preloadResponse) || (await fetch(e.request, { cache: "no-store" }));
    if (okToStore(r)) c.put("./", r.clone());
    return r;
  })();
  const timeout = new Promise(res => setTimeout(res, 3000));
  try {
    const r = await Promise.race([net, timeout]);
    if (r) return r;
    return (await c.match("./")) || (await net);
  } catch (x) {
    return (await c.match("./")) || new Response("<h1>Hors connexion</h1><p>Reconnectez-vous puis actualisez.</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(req) {
  const c = await caches.open(V), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (okToStore(r)) c.put(req, r.clone());
  return r;
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(V), hit = await c.match(req);
  const net = fetch(req).then(r => { if (okToStore(r)) c.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (/\.supabase\.co$/.test(u.hostname)) return;
  if (/\.r2\.cloudflarestorage\.com$/.test(u.hostname)) return;
  if (req.mode === "navigate" && u.origin === location.origin) return e.respondWith(pageFirst(e));
  if (u.hostname === "cdn.jsdelivr.net" && /@\d+\.\d+\.\d+\//.test(u.pathname)) return e.respondWith(cacheFirst(req));
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") return e.respondWith(staleWhileRevalidate(req));
  if (u.origin === location.origin && /\.(png|json)$/.test(u.pathname)) return e.respondWith(staleWhileRevalidate(req));
});

self.addEventListener("message", e => {
  if (e.data === "purge") e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("archives-")).map(k => caches.delete(k)))));
});
