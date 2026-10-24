import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

export const PLATFORM_KEY_COOKIE = "api_key"

export const PLATFORM_KEY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

export class MissingCredentialsError extends Error {
  constructor() {
    super("Connect your Higgsfield API key")
    this.name = "MissingCredentialsError"
  }
}

const ENC_PREFIX = "enc1."

/** AES-256-GCM key from HF_COOKIE_SECRET, or null when the secret is not set. */
function cookieKey(): Buffer | null {
  const secret = process.env.HF_COOKIE_SECRET
  return secret ? createHash("sha256").update(secret).digest() : null
}

/** Encrypted when HF_COOKIE_SECRET is set; plain JSON otherwise (decode reads both,
    so adding the secret later does not sign anyone out). */
export function encodeCredentials(apiKey: string): string {
  const json = JSON.stringify({ apiKey })
  const key = cookieKey()
  if (!key) return json
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const sealed = Buffer.concat([cipher.update(json, "utf8"), cipher.final()])
  return (
    ENC_PREFIX +
    Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64url")
  )
}

function openCookie(raw: string): string | null {
  if (!raw.startsWith(ENC_PREFIX)) return raw
  const key = cookieKey()
  if (!key) return null // encrypted cookie but no secret: treat as signed out
  const data = Buffer.from(raw.slice(ENC_PREFIX.length), "base64url")
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12))
  decipher.setAuthTag(data.subarray(12, 28))
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8")
}

export function decodeCredentials(
  raw: string | undefined
): { apiKey: string } | null {
  if (!raw) return null
  try {
    const json = openCookie(raw)
    if (json === null) return null
    const parsed = JSON.parse(json) as unknown
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return null
    const apiKey = (parsed as { apiKey?: unknown }).apiKey
    if (typeof apiKey !== "string" || !apiKey.trim()) return null
    return { apiKey: requireApiKey(apiKey) }
  } catch {
    return null
  }
}

export function parseCredentialInput(data: unknown): { apiKey: string } {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Enter an API key")
  }
  const record = data as { apiKey?: unknown; api_key?: unknown }
  const apiKey = record.apiKey ?? record.api_key
  if (typeof apiKey !== "string" || !apiKey.trim())
    throw new Error("Enter an API key")
  return { apiKey: requireApiKey(apiKey) }
}

export function toAuthorizationHeader(apiKey: string): string {
  return `Key ${requireApiKey(apiKey)}`
}

function requireApiKey(apiKey: string): string {
  const key = apiKey.trim()
  if (!key) throw new Error("Enter an API key")
  if (/[^\x21-\x7E]/.test(key))
    throw new Error(
      "Paste the API key exactly as copied from open.higgsfield.ai"
    )
  return key
}
