const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
}

function filenameFromUrl(url: string, contentType?: string | null): string {
  try {
    const name = new URL(url, window.location.href).pathname.split("/").pop()
    if (name && name.includes(".")) return decodeURIComponent(name)
  } catch {}

  const extension = contentType
    ? EXTENSION_BY_TYPE[contentType.split(";")[0] ?? ""]
    : undefined
  return `generation.${extension ?? "bin"}`
}

function clickDownload(href: string, filename: string, openInNewTab = false) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  anchor.rel = "noopener"
  if (openInNewTab) anchor.target = "_blank"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/**
 * Download a generated image or video. Fetching to a blob makes `download`
 * reliable for same-origin and CORS-enabled media; the direct-link fallback
 * still handles storage URLs that intentionally disallow fetch access.
 */
export async function downloadMedia(
  url: string,
  filename?: string
): Promise<void> {
  if (typeof document === "undefined" || !url) return

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Download failed with ${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    clickDownload(objectUrl, filename ?? filenameFromUrl(url, blob.type))
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    clickDownload(url, filename ?? filenameFromUrl(url), true)
  }
}

/** Fetches at most this many files at once. */
const DOWNLOAD_CONCURRENCY = 4

/** One file downloads directly; several are zipped. A file that cannot be fetched
    (storage that disallows cross-origin reads) is saved on its own afterwards, and
    each file is saved exactly once. */
export async function downloadMany(urls: string[]): Promise<void> {
  if (urls.length < 2) return void (urls[0] && downloadMedia(urls[0]))
  const fetched: { name: string; blob: Blob }[] = []
  const direct: string[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: DOWNLOAD_CONCURRENCY }, async () => {
      while (next < urls.length) {
        const i = next++
        const url = urls[i]!
        try {
          const response = await fetch(url)
          if (!response.ok) throw new Error(String(response.status))
          const blob = await response.blob()
          fetched[i] = {
            name: `${i + 1}-${filenameFromUrl(url, blob.type)}`,
            blob,
          }
        } catch {
          direct.push(url)
        }
      }
    })
  )
  const files = fetched.filter(Boolean)
  if (files.length > 1) {
    try {
      const { zipFiles } = await import("./zip")
      const objectUrl = URL.createObjectURL(await zipFiles(files))
      clickDownload(objectUrl, "generations.zip")
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      // Too big for one zip: save the files one by one instead.
      for (const { name, blob } of files) saveBlob(blob, name)
    }
  } else for (const { name, blob } of files) saveBlob(blob, name)
  for (const url of direct) await downloadMedia(url)
}

function saveBlob(blob: Blob, name: string) {
  const objectUrl = URL.createObjectURL(blob)
  clickDownload(objectUrl, name)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
