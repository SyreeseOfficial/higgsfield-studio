"use client"

import { useEffect } from "react"

/** A bottom-center notice with one action that dismisses itself after `ms`. */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
  ms = 5000,
  actionLabel = "Undo",
}: {
  message: string
  actionLabel?: string
  onUndo: () => void
  onDismiss: () => void
  ms?: number
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, ms)
    return () => clearTimeout(timer)
  }, [message, ms, onDismiss])
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-card px-4 py-2 text-sm shadow-lg ring-1 ring-white/10"
    >
      {message}
      <button
        type="button"
        className="font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onUndo}
      >
        {actionLabel}
      </button>
    </div>
  )
}
