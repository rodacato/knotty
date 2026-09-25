// The app opens offline: HTML goes to the network first and hashed files are served from the cache.
// Calls to other origins (LLM providers, SheLLM) are never cached.

const CACHE = 'knotty-v2'
const BASE = new URL('./', self.location).pathname

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, `${BASE}catalog/catalog.json`, `${BASE}favicon.svg`, `${BASE}icon-192.png`])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return

  if (e.request.mode === 'navigate' || url.pathname.endsWith('catalog.json')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(e.request.mode === 'navigate' ? BASE : e.request, copy))
          return r
        })
        .catch(() => caches.match(e.request.mode === 'navigate' ? BASE : e.request)),
    )
    return
  }

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ??
        fetch(e.request).then((r) => {
          if (r.ok) {
            const copy = r.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return r
        }),
    ),
  )
})
