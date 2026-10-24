/** Hex SHA-256 of some bytes; undefined where SubtleCrypto is missing (insecure context). */
export async function sha256Hex(
  bytes: BufferSource
): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("")
  } catch {
    return undefined
  }
}
