import { defaultKv } from "./kv"

const INDEX = "media.index"
/** Newest images kept as local copies. */
const MAX_COPIES = 150
const MAX_BYTES = 15 * 1024 * 1024

/** Keeps a local copy of finished images so a tile survives its link expiring.
    Best effort: if the host refuses cross-origin reads (CORS) nothing is saved. */
export async function saveCopies(urls: string[]): Promise<void> {
  const kv = defaultKv()
  for (const url of urls) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      if (!res.ok || !blob.type.startsWith("image/") || blob.size > MAX_BYTES)
        continue
      await kv.set(`media.${url}`, blob)
      const index = ((await kv.get<string[]>(INDEX)) ?? []).filter(
        (u) => u !== url
      )
      index.unshift(url)
      for (const old of index.splice(MAX_COPIES)) await kv.del(`media.${old}`)
      await kv.set(INDEX, index)
    } catch {
      /* offline, CORS, or storage full: the link is still the source of truth */
    }
  }
}

/** Object URL for a saved copy, or undefined. */
export async function copyFor(url: string): Promise<string | undefined> {
  try {
    const blob = await defaultKv().get<Blob>(`media.${url}`)
    return blob ? URL.createObjectURL(blob) : undefined
  } catch {
    return undefined
  }
}
