const CACHE_NAME = "shamanchik-pwa-v7";
const APP_SHELL = [
  "/",
  "/index.html",
  "/chat",
  "/knowledge",
  "/manifest.webmanifest",
  "/pwa.js",
  "/styles.css",
  "/script.js",
  "/catalog.js",
  "/home-knowledge.js",
  "/site-account.js",
  "/chat-assets/chat.css",
  "/chat-assets/chat.js",
  "/knowledge/knowledge.css",
  "/knowledge/knowledge.js",
  "/profile.css",
  "/profile.js",
  "/images/icon-64.png",
  "/images/pwa-icon-192.png",
  "/images/pwa-icon-512.png",
  "/images/logo-gold-small.png",
  "/images/background.jpg",
  "/images/hero.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
        return Promise.resolve(false);
      })))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/chat-api/")
    || url.pathname.startsWith("/chat-ws")
    || url.pathname.startsWith("/storage/")
    || url.pathname.startsWith("/chat-uploads/")
    || url.pathname.startsWith("/product-images/");
}

function shouldPreferNetwork(url) {
  return url.pathname === "/catalog.js"
    || url.pathname === "/sw.js"
    || url.pathname === "/pwa.js";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  if (shouldPreferNetwork(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fresh;
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Лавка Шамана";
  const options = {
    body: payload.body || "Новое уведомление",
    icon: payload.icon || "/images/pwa-icon-192.png",
    badge: payload.badge || "/images/icon-64.png",
    data: {
      url: payload.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const sameOriginClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
        if (sameOriginClient) {
          sameOriginClient.focus();
          return sameOriginClient.navigate(targetUrl);
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
