"use client"

import { useEffect, useRef } from "react"

import { usePreferences } from "@/generation/stores/preferences"

import type { RunRecord } from "./history"

/** Two soft sine notes; silently skipped if audio is unavailable or blocked. */
function playChime() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    gain.connect(ctx.destination)
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.3)
    })
    setTimeout(() => void ctx.close(), 1000)
  } catch {}
}

/** Mirrors background progress into the tab title, and into a desktop
    notification when a run finishes while the tab is hidden. */
export function useRunSignals(records: RunRecord[]) {
  const baseTitle = useRef<string | null>(null)
  const seen = useRef<Map<string, RunRecord["status"]> | null>(null)
  const { notify, tabTitle, chime } = usePreferences()
  const running = records.filter((r) => r.status === "running").length

  useEffect(() => {
    baseTitle.current ??= document.title
    const base = baseTitle.current
    document.title =
      tabTitle && running > 0 ? `(${running}) Generating… · ${base}` : base
    const onVisible = () => {
      if (!document.hidden && running === 0) document.title = base
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [running, tabTitle])

  useEffect(() => {
    const previous = seen.current
    seen.current = new Map(records.map((r) => [r.id, r.status]))
    if (!previous) return
    for (const r of records) {
      if (previous.get(r.id) !== "running" || r.status === "running") continue
      if (chime && r.status === "completed") playChime()
      if (!document.hidden) continue
      if (tabTitle)
        document.title =
          r.status === "completed"
            ? "Done · " + baseTitle.current
            : "Failed · " + baseTitle.current
      if (
        notify &&
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to record changes
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
