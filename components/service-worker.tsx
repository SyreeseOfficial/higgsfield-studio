"use client"

import { useEffect } from "react"

/** Registers the static-file cache (production only; in dev it would serve stale code). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])
  return null
}
