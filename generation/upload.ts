import {
  MAX_UPLOAD_BYTES,
  mediaKindFromMime,
  parseUploadTicket,
  requireUploadContentType,
  unsupportedFileMessage,
} from "./upload-contract"

export type UploadOptions = {
  /** 0..1 while the file is sent to storage. */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export async function uploadMedia(
  file: File,
  { onProgress, signal }: UploadOptions = {}
): Promise<{ url: string }> {
  let contentType: string
  try {
    contentType = requireUploadContentType(file.type)
  } catch {
    throw new Error(unsupportedFileMessage(file))
  }
  const limit = MAX_UPLOAD_BYTES[mediaKindFromMime(contentType)]
  if (file.size > limit)
    throw new Error(
      `That file is ${Math.ceil(file.size / 1048576)} MB; the limit is ${limit / 1048576} MB.`
    )
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
    ...(signal ? { signal } : {}),
  })
  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new Error(
      `Could not prepare reference upload (${res.status}). Try again.`
    )
  }
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : null
    throw new Error(
      typeof message === "string"
        ? message
        : `Could not prepare reference upload (${res.status}). Try again.`
    )
  }
  const ticket = parseUploadTicket(payload, contentType)
  const status = await put(ticket.upload_url, ticket.upload_headers, file, {
    ...(onProgress ? { onProgress } : {}),
    ...(signal ? { signal } : {}),
  })
  if (status < 200 || status >= 300)
    throw new Error(
      `Reference upload failed (${status}). Try uploading the file again.`
    )
  return { url: ticket.public_url }
}

/** XHR, not fetch: fetch cannot report upload progress. The storage request
    must not carry the platform key or browser cookies (cross-origin XHR sends
    none unless withCredentials is set). */
function put(
  url: string,
  headers: Record<string, string>,
  file: File,
  { onProgress, signal }: UploadOptions
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.withCredentials = false
    for (const [name, value] of Object.entries(headers))
      xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => resolve(xhr.status)
    xhr.onerror = () =>
      reject(new Error("Reference upload failed. Check your connection."))
    xhr.onabort = () =>
      reject(new DOMException("Upload canceled", "AbortError"))
    signal?.addEventListener("abort", () => xhr.abort(), { once: true })
    if (signal?.aborted) return xhr.abort()
    xhr.send(file)
  })
}
