"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  BarChart3,
  Keyboard,
  KeyRound,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RunRecord } from "@/lib/studio/history"
import { usePreferences } from "@/generation/stores/preferences"
import { requestNotificationPermission } from "@/lib/studio/use-run-signals"
import { cn } from "@/lib/utils"

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          checked ? "bg-primary" : "bg-white/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform motion-reduce:transition-none",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Browser notification permission, read on open (client-only). */
function usePermission(open: boolean) {
  const [permission, setPermission] = useState<string>("default")
  useEffect(() => {
    if (open && typeof Notification !== "undefined")
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from browser API on open
      setPermission(Notification.permission)
  }, [open])
  return typeof Notification === "undefined" ? "unsupported" : permission
}

/** App-wide preferences and shortcuts to key, usage, shortcuts and storage. */
export function PreferencesDialog({
  open,
  onOpenChange,
  keyConfigured,
  onOpenKey,
  onOpenUsage,
  onOpenShortcuts,
  onOpenPrivacy,
  errors,
  onRetry,
}: {
  /** The latest failed runs, newest first. */
  errors: RunRecord[]
  onRetry: (runId: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  keyConfigured: boolean
  onOpenKey: () => void
  onOpenUsage: () => void
  onOpenShortcuts: () => void
  onOpenPrivacy: () => void
}) {
  const prefs = usePreferences()
  const permission = usePermission(open)
  // Close this dialog first so the next one isn't stacked on it.
  const go = (fn: () => void) => () => {
    onOpenChange(false)
    fn()
  }
  const links: [string, string, typeof KeyRound, () => void][] = [
    [
      "API key",
      keyConfigured ? "Saved in this browser" : "Not connected",
      KeyRound,
      onOpenKey,
    ],
    ["Usage", "Runs and timings", BarChart3, onOpenUsage],
    ["Shortcuts", "Keyboard commands", Keyboard, onOpenShortcuts],
    ["Privacy and storage", "Export or wipe data", ShieldCheck, onOpenPrivacy],
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-6">
            <Section title="Account and data">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {links.map(([label, hint, Icon, action]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={go(action)}
                    className="flex items-center gap-3 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Generating">
              <Toggle
                label="Jump to feed after generating"
                description="Leave Home and watch the new tile appear."
                checked={prefs.jumpToFeed}
                onChange={(jumpToFeed) => prefs.set({ jumpToFeed })}
              />
            </Section>
            <Section title="Notifications">
              <Toggle
                label="Desktop notifications"
                description={
                  permission === "denied"
                    ? "Blocked by your browser. Allow notifications for this site, then turn this on."
                    : permission === "unsupported"
                      ? "Not supported in this browser."
                      : "Tell me when a generation finishes in a background tab."
                }
                checked={prefs.notify && permission !== "denied"}
                onChange={(notify) => {
                  prefs.set({ notify })
                  if (notify) requestNotificationPermission()
                }}
              />
              <Toggle
                label="Play a sound when done"
                description="A short chime when a generation completes."
                checked={prefs.chime}
                onChange={(chime) => prefs.set({ chime })}
              />
              <Toggle
                label="Progress in tab title"
                description="Show running, done and failed counts in the browser tab."
                checked={prefs.tabTitle}
                onChange={(tabTitle) => prefs.set({ tabTitle })}
              />
            </Section>
            <Section title="Feed">
              <Toggle
                label="Play videos on hover"
                description="Preview video tiles muted when you point at them."
                checked={prefs.hoverPlay}
                onChange={(hoverPlay) => prefs.set({ hoverPlay })}
              />
              <Toggle
                label="Mute videos"
                description="Open videos with the sound off. The mute button in the viewer changes this too."
                checked={prefs.mute}
                onChange={(mute) => prefs.set({ mute })}
              />
            </Section>
            <Section title="Recent errors">
              {errors.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">
                  No failed runs.
                </p>
              ) : (
                <ul className="flex max-h-56 flex-col divide-y divide-white/10 overflow-y-auto">
                  {errors.map((run) => (
                    <li
                      key={run.id}
                      className="flex items-start justify-between gap-3 py-2"
                    >
                      <div className="min-w-0 text-xs">
                        <p className="font-medium">
                          {run.modelLabel} ·{" "}
                          <span className="font-normal text-muted-foreground">
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          {run.error ?? "Unknown reason"}
                        </p>
                        {run.requestId ? (
                          <p className="font-mono text-xs text-muted-foreground select-all">
                            Support ID: {run.requestId}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onRetry(run.id)}
                      >
                        <RotateCcw className="size-3" /> Retry
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <p className="text-xs text-muted-foreground">
              Studio {process.env.NEXT_PUBLIC_APP_VERSION}
              {process.env.NEXT_PUBLIC_APP_COMMIT
                ? ` · ${process.env.NEXT_PUBLIC_APP_COMMIT}`
                : ""}
            </p>
            <div className="flex justify-end border-t border-white/10 pt-3">
              <Button variant="ghost" size="sm" onClick={prefs.reset}>
                <RotateCcw className="size-3.5" />
                Reset to defaults
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
