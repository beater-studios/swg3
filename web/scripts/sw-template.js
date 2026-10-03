// Service worker for offline use. scripts/sw.mjs fills CONFIG at build time: { cache, prefix, urls, pages }.
// Pages: network first, the cached copy when offline or slow. Everything else: the cache first, the network as fallback.

const CONFIG = __CONFIG__;
const PAGE_TIMEOUT_MS = 4000;
// The previous version stays too: a tab still open on it may lazy-load chunks that the new deploy removed.
const KEEP_VERSIONS = 2;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CONFIG.cache);
    await cache.addAll(CONFIG.urls.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // CacheStorage keys come in creation order.
    const ours = (await caches.keys()).filter((key) => key.startsWith(CONFIG.prefix));
    const keep = new Set([...ours.slice(-KEEP_VERSIONS), CONFIG.cache]);
    await Promise.all(ours.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(request.mode === "navigate" ? page(request, url) : asset(request));
});

/** Precache key of a page: the clean URL (/, /rng, /en/guides/ace). */
function pageKey(pathname) {
  const clean = pathname.replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  return clean === "/index" ? "/" : clean;
}

// ignoreVary: module scripts carry an Origin header that the precache requests did not, and servers may send Vary: Origin.
const MATCH = { ignoreVary: true };

async function fromCache(key) {
  const current = await caches.open(CONFIG.cache);
  return (await current.match(key, MATCH)) ?? (await caches.match(key, MATCH));
}

async function page(request, url) {
  const network = fetch(request);
  try {
    return await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), PAGE_TIMEOUT_MS))]);
  } catch {
    const key = pageKey(url.pathname);
    const notFound = key === "/en" || key.startsWith("/en/") ? "/en/404" : "/404";
    const cached = CONFIG.pages.includes(key) ? await fromCache(key) : await fromCache(notFound);
    return cached ?? network;
  }
}

async function asset(request) {
  return (await fromCache(request)) ?? fetch(request);
}
