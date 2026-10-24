"use client"

import { useEffect } from "react"

/** Global shortcuts: Ctrl/⌘+K toggles the palette, "?" (outside text fields) opens help. */
export function useStudioKeys({
  onPalette,
  onHelp,
}: {
  onPalette: () => void
  onHelp: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onPalette()
        return
      }
      const target = event.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      if (event.key === "?" && !typing && !event.metaKey && !event.ctrlKey)
        onHelp()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPalette, onHelp])
}
