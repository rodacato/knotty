// The app opens offline: HTML goes to the network first and hashed files are served from the cache.
// Calls to other origins (LLM providers, SheLLM) are never cached.

const BASE = new URL('./', self.location).pathname
const CACHE = `knotty-v4:${BASE}`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, `${BASE}catalog/`, `${BASE}catalog/catalog.json`, `${BASE}favicon.svg`, `${BASE}icon-192.png`])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k === 'knotty-v1' || k === 'knotty-v2').map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return

  if (e.request.mode === 'navigate') {
    const path = url.pathname.endsWith('/index.html') ? url.pathname.slice(0, -10) : url.pathname
    const document = `${url.origin}${path}`
    e.respondWith(
      fetch(e.request)
        .then(async (r) => {
          if (r.ok) await caches.open(CACHE).then((c) => c.put(document, r.clone()))
          return r
        })
        .catch(async () => (await caches.open(CACHE).then((c) => c.match(document))) ?? new Response('Esta página todavía no está guardada para abrir sin conexión.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })),
    )
    return
  }

  if (url.pathname.endsWith('catalog.json') || url.pathname.startsWith(`${BASE}brand/`)) {
    e.respondWith(fetch(e.request).then(async (r) => {
      if (r.ok) await caches.open(CACHE).then((c) => c.put(e.request, r.clone()))
      return r
    }).catch(async () => (await caches.open(CACHE).then((c) => c.match(e.request))) ?? caches.match(e.request)))
    return
  }

  e.respondWith(
    caches.open(CACHE).then(async (c) => (await c.match(e.request)) ?? caches.match(e.request)).then(
      (cached) =>
        cached ??
        fetch(e.request).then(async (r) => {
          if (r.ok) {
            const copy = r.clone()
            await caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return r
        }),
    ),
  )
})
