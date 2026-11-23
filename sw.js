/* Archives NITA – service worker (v4.5 : notifications ; mise à jour forcée des pages anciennes) */
const V = "archives-v4.5";
const SHELL = ["./", "manifest.json", "icone-192.png", "icone-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== V && k.startsWith("archives-")) await caches.delete(k); if (self.registration.navigationPreload) try { await self.registration.navigationPreload.enable(); } catch (x) {} await self.clients.claim();
  /* nouvelle version installée : les pages en arrière-plan sont rechargées tout de suite ; les pages affichées sont prévenues
     et se mettent à jour dès que l'utilisateur n'est pas en train de saisir (versions anciennes : rechargement à la prochaine ouverture, le cache ayant été vidé) */
  for (const c of await self.clients.matchAll({ type: "window" })) { try { if (c.visibilityState === "hidden" && c.navigate) await c.navigate(c.url); else c.postMessage({ t: "maj" }); } catch (x) {} }
})()); });
const okToStore = r => r && r.ok && (r.type === "basic" || r.type === "cors");
const HORS_LIGNE = () => new Response("<h1>Hors connexion</h1><p>Reconnectez-vous puis actualisez.</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
async function pageFast(e) {
  const c = await caches.open(V);
  const hit = await c.match("./");
  const ancien = hit ? hit.clone().text() : null;
  const net = (async () => {
    const r = (await e.preloadResponse) || (await fetch(e.request, { cache: "no-store" }));
    if (okToStore(r)) {
      const nouveau = await r.clone().text();
      await c.put("./", r.clone());
      if (ancien && (await ancien) !== nouveau) { for (const cl of await self.clients.matchAll({ type: "window" })) cl.postMessage({ t: "maj" }); }
    }
    return r;
  })();
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  try { return await net; } catch (x) { return HORS_LIGNE(); }
}
async function cacheFirst(req) { const c = await caches.open(V), hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (okToStore(r)) c.put(req, r.clone()); return r; }
async function staleWhileRevalidate(req) { const c = await caches.open(V), hit = await c.match(req); const net = fetch(req).then(r => { if (okToStore(r)) c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; }
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return; const u = new URL(req.url);
  if (/\.supabase\.co$/.test(u.hostname)) return;
  if (/\.r2\.cloudflarestorage\.com$/.test(u.hostname)) return;
  if (req.mode === "navigate" && u.origin === location.origin) return e.respondWith(pageFast(e));
  if (u.hostname === "cdn.jsdelivr.net" && (/@\d+\.\d+\.\d+\//.test(u.pathname) || /\/gh\/[^/]+\/[^/@]+@[0-9a-f]{40}\//.test(u.pathname))) return e.respondWith(cacheFirst(req));
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") return e.respondWith(staleWhileRevalidate(req));
  if (u.origin === location.origin && /\.(png|json)$/.test(u.pathname)) return e.respondWith(staleWhileRevalidate(req));
});
self.addEventListener("message", e => { if (e.data === "purge") e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("archives-")).map(k => caches.delete(k))))); });

/* Notifications (Web Push) : affichage du message reçu, puis ouverture de l'application au bon endroit */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: "Archives NITA", b: e.data ? e.data.text() : "" }; }
  const titre = String(d.t || "Archives NITA").slice(0, 120);
  e.waitUntil(self.registration.showNotification(titre, { body: String(d.b || "").slice(0, 300), icon: "icone-192.png", badge: "icone-192.png", lang: "fr", tag: "nita-" + Date.now(), data: { u: d.u || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  let u; try { u = new URL((e.notification.data && e.notification.data.u) || "./", self.registration.scope); } catch (x) { u = new URL("./", self.registration.scope); }
  if (u.origin !== self.location.origin) u = new URL("./", self.registration.scope);
  const v = u.searchParams.get("ouvrir") || "";
  e.waitUntil((async () => {
    const L = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of L) if (c.url.startsWith(self.registration.scope) && "focus" in c) { await c.focus(); c.postMessage({ t: "ouvrir", v }); return; }
    if (self.clients.openWindow) await self.clients.openWindow(u.href);
  })());
});
