/* Personal Digest — Service Worker */
"use strict";
const CACHE = "pnd-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App shell: cache-first, then update in background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Feed API (rss2json / allorigins): network-first with cache fallback for offline
  if (/rss2json\.com|allorigins\.win/.test(url.hostname)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || Response.error()))
    );
    return;
  }
  // Everything else (favicons etc.): network, silent fail
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return self.clients.openWindow("./");
    })
  );
});

/* Message channel: the page can ask the SW to show a notification
   (used for the morning digest while the app/PWA is open in background) */
self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.type === "SHOW_NOTIFICATION" && self.registration && self.registration.showNotification) {
    self.registration.showNotification(d.title || "Digest", {
      body: d.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: d.tag || "digest"
    });
  }
});

/* Web Push (requires a push server — not used in the local-only setup,
   but kept so the app is ready if a push backend is added later) */
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || "Morning Digest", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "digest-push"
    })
  );
});
