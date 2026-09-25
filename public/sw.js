// La app abre sin conexión: el HTML se pide a la red primero y los archivos con hash se sirven del caché.
// Nunca se guardan llamadas a otros orígenes (proveedores de LLM, SheLLM).

const CACHE = 'knotty-v2'
const BASE = new URL('./', self.location).pathname

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, `${BASE}catalog/catalog.json`, `${BASE}favicon.svg`, `${BASE}icon-192.png`])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return

  if (e.request.mode === 'navigate' || url.pathname.endsWith('catalog.json')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone()
          caches.open(CACHE).then((c) => c.put(e.request.mode === 'navigate' ? BASE : e.request, copia))
          return r
        })
        .catch(() => caches.match(e.request.mode === 'navigate' ? BASE : e.request)),
    )
    return
  }

  e.respondWith(
    caches.match(e.request).then(
      (guardado) =>
        guardado ??
        fetch(e.request).then((r) => {
          if (r.ok) {
            const copia = r.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copia))
          }
          return r
        }),
    ),
  )
})
