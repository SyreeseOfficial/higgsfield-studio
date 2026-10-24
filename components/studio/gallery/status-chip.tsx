import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** One look for every state label on a tile: running, queued, waiting, failed, starred, info. */
export type ChipTone = "run" | "queue" | "warn" | "fail" | "star" | "info"

const TONE: Record<ChipTone, string> = {
  run: "bg-white/10 text-primary",
  queue: "bg-white/10 text-foreground",
  warn: "bg-amber-400/15 text-amber-200",
  fail: "bg-red-500/20 text-red-200",
  star: "bg-black/45 text-yellow-300",
  info: "bg-black/45 text-white",
}

export function StatusChip({
  tone,
  icon: Icon,
  spin,
  className,
  children,
  ...props
}: {
  tone: ChipTone
  icon?: LucideIcon
  spin?: boolean
  className?: string
  children?: React.ReactNode
} & Omit<React.ComponentProps<"span">, "className" | "children">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md [&_svg]:size-3.5",
        TONE[tone],
        className
      )}
      {...props}
    >
      {Icon ? <Icon className={spin ? "animate-spin" : undefined} /> : null}
      {children}
    </span>
  )
}
