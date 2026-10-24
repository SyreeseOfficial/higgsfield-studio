"use client"

import { useMemo, useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export interface Command {
  id: string
  label: string
  /** Group shown after the label ("Model", "Project"…). */
  hint: string
  run: () => void
}

/** Cmd/Ctrl+K: type to filter, arrows to move, Enter to run. */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Command[]
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return commands.filter((c) =>
      words.every((w) => `${c.label} ${c.hint}`.toLowerCase().includes(w))
    )
  }, [commands, query])
  const choose = (command: Command | undefined) => {
    if (!command) return
    onOpenChange(false)
    command.run()
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("")
          setActive(0)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent size="md">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <input
          autoFocus
          value={query}
          placeholder="Switch model, project or surface…"
          aria-label="Search commands"
          className="w-full bg-transparent px-4 py-3 text-sm outline-none"
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActive((i) => Math.min(i + 1, shown.length - 1))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (event.key === "Enter") {
              event.preventDefault()
              choose(shown[active])
            }
          }}
        />
        <ul role="listbox" className="max-h-80 overflow-y-auto px-2 pb-2">
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No matches
            </li>
          ) : (
            shown.map((command, index) => (
              <li
                key={command.id}
                role="option"
                aria-selected={index === active}
                className={
                  "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm " +
                  (index === active ? "bg-white/10" : "")
                }
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(command)}
              >
                {command.label}
                <span className="text-xs text-muted-foreground">
                  {command.hint}
                </span>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
