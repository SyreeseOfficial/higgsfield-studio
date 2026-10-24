const KEY = "hf.tips.v1"

function seen(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]")
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
  try {
    localStorage.setItem(KEY, JSON.stringify([...done, id]))
  } catch {
    return false // storage blocked: skip tips rather than repeat them
  }
  return true
}
