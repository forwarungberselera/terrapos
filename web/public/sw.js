const CACHE_NAME = "terrapos-v4";
const STATIC_CACHE = "terrapos-static-v4";

// Core pages to pre-cache on first visit
const CORE_PAGES = [
  "/pos",
  "/dashboard",
  "/orders",
  "/login",
  "/shifts",
  "/products",
];

// Essential assets always cached
const CORE_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) =>
            k !== CACHE_NAME && k !== STATIC_CACHE ? caches.delete(k) : null
          )
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Skip non-GET requests
  if (req.method !== "GET") return;

  // Skip Chrome extensions & external URLs
  if (!req.url.startsWith(self.location.origin)) return;

  // Skip API calls & Firestore requests
  if (
    req.url.includes("/api/") ||
    req.url.includes("firestore.googleapis.com") ||
    req.url.includes("identitytoolkit.googleapis.com") ||
    req.url.includes("securetoken.googleapis.com") ||
    req.url.includes("googleapis.com")
  ) {
    return;
  }

  // ============ STATIC ASSETS (_next/static) - Cache First ============
  // These have content hashes in filenames, so safe to cache forever
  if (req.url.includes("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((response) => {
            if (response.ok) {
              cache.put(req, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // ============ NEXT.JS DATA REQUESTS (_next/data) - Stale While Revalidate ============
  if (req.url.includes("/_next/data/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((response) => {
              if (response.ok) {
                cache.put(req, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ============ NAVIGATION (HTML pages) - Network First + Cache ============
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            // Try to return any cached page as fallback
            return caches.match("/pos").then((posCached) => {
              if (posCached) return posCached;
              return new Response(
                '<html><body><div style="text-align:center;padding:60px 20px;font-family:system-ui">' +
                  "<h2>Offline</h2><p>Tidak ada koneksi internet. Coba refresh lagi nanti.</p>" +
                  '<button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;border-radius:12px;border:none;background:#d59567;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Coba Lagi</button>' +
                  "</div></body></html>",
                { headers: { "Content-Type": "text/html" } }
              );
            });
          })
        )
    );
    return;
  }

  // ============ FONTS - Cache First (long-lived) ============
  if (
    req.url.includes("onlinewebfonts.com") ||
    req.url.includes("fonts.googleapis.com") ||
    req.url.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((response) => {
            if (response.ok) {
              cache.put(req, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // ============ IMAGES & ICONS - Stale While Revalidate ============
  if (
    req.url.includes("/icon-") ||
    req.url.includes("/favicon") ||
    req.url.match(/\.(png|jpg|jpeg|webp|svg|gif)/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((response) => {
              if (response.ok) {
                cache.put(req, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ============ JS/CSS CHUNKS (non-static) - Stale While Revalidate ============
  if (req.url.match(/\.(js|css)(\?|$)/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((response) => {
              if (response.ok) {
                cache.put(req, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ============ DEFAULT: Network with cache fallback ============
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// ============ BACKGROUND SYNC: Pre-cache core pages after first load ============
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PRECACHE_PAGES") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.allSettled(
          CORE_PAGES.map((url) =>
            fetch(url)
              .then((res) => {
                if (res.ok) cache.put(url, res);
              })
              .catch(() => {})
          )
        )
      )
    );
  }
});
