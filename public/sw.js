// Service Worker: يخلي التطبيق يشتغل بدون إنترنت
// - الصفحات: من الشبكة أولاً، وإذا ما فيه إنترنت من الكاش
// - ملفات Next الثابتة (/_next/static): من الكاش أولاً (أسماؤها تتغير مع كل بناء)
// - /api: من الشبكة فقط (الذكاء الاصطناعي يحتاج إنترنت)

const VERSION = "v1";
const PAGES_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const ROUTES = ["/", "/food", "/activity", "/weight", "/stats", "/settings"];
const EXTRA = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

async function precache() {
  const pages = await caches.open(PAGES_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  const assetUrls = new Set();
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { cache: "no-store" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(route, res);
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assetUrls.add(m[0]);
      } catch {}
    }),
  );
  await Promise.all(
    [...assetUrls, ...EXTRA].map((u) =>
      fetch(u).then((r) => r.ok && (u.startsWith("/_next/") ? statics : pages).put(u, r)).catch(() => {}),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES_CACHE, STATIC_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res.ok) cache.put(cacheKey, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(cacheKey, { ignoreSearch: true })) || (await cache.match("/"));
    if (hit) return hit;
    return new Response("<h1 dir='rtl'>ما فيه اتصال بالإنترنت</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, url.pathname));
    return;
  }
  // طلبات RSC وباقي الملفات: من الشبكة، وإذا فشلت من الكاش
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isRsc) {
    event.respondWith(
      fetch(request).catch(() => Response.error()), // Next يرجع لتحميل الصفحة كاملة، واللي يجي من الكاش
    );
    return;
  }
  event.respondWith(
    caches.open(PAGES_CACHE).then(async (cache) => {
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    }),
  );
});
