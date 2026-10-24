import { clearPlatformCredentials } from "@/generation/actions"

import { loadHistory } from "./history"
import { closeKv } from "./kv"

/** Bytes used and available for this origin, when the browser says. */
export async function storageEstimate(): Promise<{
  usage: number
  quota: number
} | null> {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) ?? {}
    return usage != null && quota ? { usage, quota } : null
  } catch {
    return null
  }
}

/** Downloads every run in history as a JSON file. */
export async function exportHistory(): Promise<void> {
  const records = await loadHistory()
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(records, null, 2)], { type: "application/json" })
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `studio-history-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Removes the API key cookie, history, projects, uploads and settings, then reloads. */
export async function wipeEverything(): Promise<void> {
  await clearPlatformCredentials()
  await closeKv()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("studio")
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
  for (const key of Object.keys(localStorage))
    if (key.startsWith("hf.")) localStorage.removeItem(key)
  sessionStorage.clear()
  // The offline file cache and its worker go too.
  await globalThis.caches
    ?.keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => undefined)
  await navigator.serviceWorker
    ?.getRegistrations()
    .then((all) => Promise.all(all.map((r) => r.unregister())))
    .catch(() => undefined)
  location.reload()
}
