import type { MediaItem } from "@/generation/catalog"

const TIMEOUT_MS = 8000

/** False only when the browser positively fails to load the file (expired or deleted link).
    A slow answer counts as fine: it must not block a generation. */
export function referenceReachable(item: MediaItem): Promise<boolean> {
  return new Promise((resolve) => {
    const el =
      item.kind === "video"
        ? document.createElement("video")
        : item.kind === "audio"
          ? document.createElement("audio")
          : new Image()
    const done = (ok: boolean) => {
      clearTimeout(timer)
      el.removeAttribute("src")
      resolve(ok)
    }
    const timer = setTimeout(() => done(true), TIMEOUT_MS)
    el.onerror = () => done(false)
    if (el instanceof HTMLMediaElement) {
      el.preload = "metadata"
      el.onloadedmetadata = () => done(true)
    } else el.onload = () => done(true)
    el.src = item.url
  })
}
