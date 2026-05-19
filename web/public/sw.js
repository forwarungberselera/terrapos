const CACHE_NAME = "terrapos-v3";
const ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
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
    req.url.includes("securetoken.googleapis.com")
  ) {
    return;
  }

  // Navigation requests (HTML pages) - Network First with offline fallback
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
            // Return a basic offline page instead of broken cache
            return new Response(
              "<html><body><div style='text-align:center;padding:60px 20px;font-family:system-ui'>" +
                "<h2>Offline</h2><p>Tidak ada koneksi internet. Coba refresh lagi nanti.</p>" +
                "</div></body></html>",
              { headers: { "Content-Type": "text/html" } }
            );
          })
        )
    );
    return;
  }

  // Static assets (_next/static) - Cache First
  if (req.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other assets (fonts, images) - Stale While Revalidate
  if (
    req.url.includes("/icon-") ||
    req.url.includes("/favicon") ||
    req.url.includes("onlinewebfonts.com") ||
    req.url.includes("fonts.googleapis.com") ||
    req.url.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: Network only (don't cache dynamic content aggressively)
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
