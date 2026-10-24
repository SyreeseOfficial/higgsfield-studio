"use client"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Picks the project a set of generations is filed under; `undefined` takes them out of every project. */
export function MoveToProjectDialog({
  open,
  count,
  projects,
  onPick,
  onOpenChange,
}: {
  open: boolean
  count: number
  projects: { id: string; name: string }[]
  onPick: (projectId: string | undefined) => void
  onOpenChange: (open: boolean) => void
}) {
  const row =
    "w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xs">
        <DialogHeader>
          <DialogTitle>
            Move {count} {count === 1 ? "generation" : "generations"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex max-h-72 flex-col overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={row}
                onClick={() => onPick(p.id)}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              className={`${row} text-muted-foreground`}
              onClick={() => onPick(undefined)}
            >
              No project
            </button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
