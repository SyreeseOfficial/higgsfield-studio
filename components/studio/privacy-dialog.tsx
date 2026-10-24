"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  exportHistory,
  storageEstimate,
  wipeEverything,
} from "@/lib/studio/storage-admin"

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

/** What this app keeps and where, with export and a full wipe. */
export function PrivacyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [estimate, setEstimate] = useState<Awaited<
    ReturnType<typeof storageEstimate>
  > | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    void storageEstimate().then((value) => alive && setEstimate(value))
    return () => {
      alive = false
    }
  }, [open])

  const nearlyFull = estimate != null && estimate.usage / estimate.quota > 0.8

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirming(false)
        onOpenChange(next)
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Privacy and storage</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 text-sm">
            <ul className="flex flex-col gap-2 text-muted-foreground">
              <li>
                <b className="text-foreground">API key:</b> an HTTP-only cookie
                in this browser, used only by the server.
              </li>
              <li>
                <b className="text-foreground">History:</b> IndexedDB in this
                browser (prompts, settings, result links).
              </li>
              <li>
                <b className="text-foreground">
                  Projects, uploads, preferences:
                </b>{" "}
                localStorage in this browser.
              </li>
              <li>Nothing is stored on a server.</li>
            </ul>
            {estimate ? (
              <p role={nearlyFull ? "alert" : undefined}>
                Browser storage: {mb(estimate.usage)} of {mb(estimate.quota)}
                {nearlyFull
                  ? ". Almost full: export your history, then wipe or delete old runs."
                  : "."}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void exportHistory()}>
                Export history
              </Button>
              {confirming ? (
                <Button
                  variant="destructive"
                  onClick={() => void wipeEverything()}
                >
                  Yes, wipe everything
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setConfirming(true)}>
                  Wipe everything
                </Button>
              )}
            </div>
            {confirming ? (
              <p className="text-muted-foreground">
                This removes your API key, history, projects, uploads and
                settings from this browser. It cannot be undone.
              </p>
            ) : null}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
