import { read, write } from "@/generation/stores/browser-storage"

const KEY = "hf.tips.v1"

function seen(): string[] {
  try {
    const parsed: unknown = JSON.parse(read(KEY) ?? "[]")
    return Array.isArray(parsed)
      ? parsed.filter((t) => typeof t === "string")
      : []
  } catch {
    return []
  }
}

/** True the first time it is asked for a given tip in this browser, false after. Client-only. */
export function claimTip(id: string): boolean {
  const done = seen()
  if (done.includes(id)) return false
  // Storage blocked: skip tips rather than repeat them.
  return write(KEY, JSON.stringify([...done, id]))
}
