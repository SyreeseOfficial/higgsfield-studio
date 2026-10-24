"use client"

import { useEffect, useRef } from "react"

import type { RunRecord } from "./history"

/** Mirrors background progress into the tab title, and into a desktop
    notification when a run finishes while the tab is hidden. */
export function useRunSignals(records: RunRecord[]) {
  const baseTitle = useRef<string | null>(null)
  const seen = useRef<Map<string, RunRecord["status"]> | null>(null)
  const running = records.filter((r) => r.status === "running").length

  useEffect(() => {
    baseTitle.current ??= document.title
    const base = baseTitle.current
    document.title = running > 0 ? `(${running}) Generating… · ${base}` : base
    const onVisible = () => {
      if (!document.hidden && running === 0) document.title = base
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [running])

  useEffect(() => {
    const previous = seen.current
    seen.current = new Map(records.map((r) => [r.id, r.status]))
    if (!previous) return
    for (const r of records) {
      if (previous.get(r.id) !== "running" || r.status === "running") continue
      if (!document.hidden) continue
      document.title =
        r.status === "completed"
          ? "Done · " + baseTitle.current
          : "Failed · " + baseTitle.current
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      )
        new Notification(
          r.status === "completed" ? "Generation ready" : "Generation failed",
          {
            body: r.prompt.slice(0, 120),
          }
        )
    }
  }, [records])
}

/** Ask once, from a click, so the browser prompt is tied to a user gesture. */
export function requestNotificationPermission() {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  )
    void Notification.requestPermission()
}
