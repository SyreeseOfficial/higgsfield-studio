/** Unique id that also works where `crypto.randomUUID` is missing (older browsers, non-secure origins). */
export function newId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === "function") return c.randomUUID()
  if (typeof c?.getRandomValues === "function")
    return Array.from(c.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("")
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
