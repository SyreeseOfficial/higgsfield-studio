"use client"

import { useState } from "react"
import { KeyRound, Settings, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Sidebar footer entry: API key access and local data management. */
export function SidebarSettings({
  collapsed,
  keyConfigured,
  onOpenKey,
  onClearHistory,
}: {
  collapsed: boolean
  keyConfigured: boolean
  onOpenKey: () => void
  onClearHistory: () => void
}) {
  const [clearing, setClearing] = useState(false)

  const trigger = (
    <DropdownMenuTrigger
      aria-label="Settings"
      className={cn(
        "group relative flex h-9 w-full items-center gap-2.5 rounded-lg px-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        collapsed && "justify-center px-0"
      )}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground">
        <Settings className="size-3.5" />
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar",
            keyConfigured ? "bg-primary" : "bg-destructive"
          )}
          aria-hidden
        />
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          Settings
        </span>
      ) : null}
    </DropdownMenuTrigger>
  )

  return (
    <>
      <DropdownMenu>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger render={<span className="block" />}>
              {trigger}
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
        <DropdownMenuContent align="end" side="right" sideOffset={8}>
          <DropdownMenuItem onClick={onOpenKey}>
            <KeyRound />
            {keyConfigured ? "Manage API key" : "Connect API key"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setClearing(true)}
          >
            <Trash2 /> Clear local history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={clearing} onOpenChange={setClearing}>
        <DialogContent size="xs">
          <DialogHeader>
            <DialogTitle>Clear local history?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-q-body-sm-regular text-q-text-secondary">
              Every generation stored in this browser is removed. Projects
              stay; the generations inside them go too.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearing(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onClearHistory()
                setClearing(false)
              }}
            >
              Clear history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
