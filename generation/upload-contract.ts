import type { MediaKind } from "./catalog/types"

const CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/wav",
  "audio/x-wav",
  "video/mp4",
])

export type UploadTicket = {
  upload_url: string
  public_url: string
  content_type: string
  upload_headers: Record<string, string>
}

/** Largest file the browser will try to upload, by kind. Generous guesses, not platform
    documentation: tune them to the platform's real limits. */
export const MAX_UPLOAD_BYTES: Record<MediaKind, number> = {
  image: 25 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
}

export function requireUploadContentType(value: unknown): string {
  if (typeof value !== "string" || !CONTENT_TYPES.has(value)) {
    throw new Error(
      "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WAV."
    )
  }
  return value
}

/** Why a file the platform can't take was refused, in terms of what to do instead. */
export function unsupportedFileMessage(file: { type: string; name: string }) {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (/hei[cf]/.test(file.type) || ext === "heic" || ext === "heif")
    return "HEIC photos aren't supported. Export the photo as JPEG or PNG first."
  if (file.type === "video/quicktime" || ext === "mov")
    return "MOV videos aren't supported. Export the clip as MP4 first."
  if (file.type.startsWith("audio/") || ext === "mp3" || ext === "m4a")
    return "Only WAV audio is supported. Convert the file to WAV first."
  return "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WAV."
}

export function mediaKindFromMime(contentType: string): MediaKind {
  requireUploadContentType(contentType)
  if (contentType.startsWith("audio/")) return "audio"
  return contentType.startsWith("video/") ? "video" : "image"
}

export function parseUploadTicket(
  value: unknown,
  contentType: string
): UploadTicket {
  const invalid = () =>
    new Error("Invalid upload response from Higgsfield. Try again.")
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid()
  const data = value as Record<string, unknown>
  if (
    !isHttpsUrl(data.upload_url) ||
    !isHttpsUrl(data.public_url) ||
    data.content_type !== contentType
  )
    throw invalid()
  if (
    !data.upload_headers ||
    typeof data.upload_headers !== "object" ||
    Array.isArray(data.upload_headers)
  )
    throw invalid()
  const entries = Object.entries(data.upload_headers)
  if (
    entries.some(
      ([name, header]) =>
        typeof header !== "string" || /^(authorization|cookie)$/i.test(name)
    )
  )
    throw invalid()
  const headers = Object.fromEntries(entries) as Record<string, string>
  try {
    if (new Headers(headers).get("content-type") !== contentType)
      throw invalid()
  } catch {
    throw invalid()
  }
  return {
    upload_url: data.upload_url,
    public_url: data.public_url,
    content_type: contentType,
    upload_headers: headers,
  }
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    // Loopback http is allowed so the mock platform (HF_MOCK=1) can serve uploads itself.
    const loopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1"
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && loopback)) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}
