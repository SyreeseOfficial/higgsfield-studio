"use client"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SHORTCUTS: [keys: string, action: string][] = [
  ["Ctrl/⌘ + Enter", "Generate from the prompt box"],
  ["Ctrl/⌘ + K", "Open the command palette"],
  ["?", "Show this list"],
  ["Ctrl/⌘ + V", "Paste an image as a reference"],
]

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
                    {keys}
                  </kbd>
                </dt>
                <dd className="text-muted-foreground">{action}</dd>
              </div>
            ))}
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
