/* Caches the app's own static files so the studio opens without the network.
   Never touches /api, server actions or other origins (results, uploads). */
const CACHE = "studio-static-v1"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // The page itself: network first, last good copy when offline.
  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            caches.open(CACHE).then((c) => c.put("/", response.clone()))
          return response
        })
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error()))
    )
    return
  }

  const hashed = url.pathname.startsWith("/_next/static/") // file name changes with its content
  const stable =
    url.pathname.startsWith("/model-icons/") ||
    url.pathname.startsWith("/presets/")
  if (!hashed && !stable) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request)
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => undefined)
      if (hit) {
        if (stable) event.waitUntil(refresh) // show now, update for next time
        return hit
      }
      return (await refresh) ?? Response.error()
    })
  )
})
