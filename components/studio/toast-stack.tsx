"use client"

import { useCallback, useEffect, useState } from "react"

import { newId } from "@/lib/studio/id"

const MAX_TOASTS = 3

export interface Toast {
  id: string
  message: string
  actionLabel: string
  onAction: () => void
  ms: number
}

/** Up to three notices at once; a fourth pushes the oldest out. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback(
    (id: string) => setToasts((current) => current.filter((t) => t.id !== id)),
    []
  )
  const push = useCallback(
    ({
      message,
      actionLabel = "Got it",
      onAction = () => undefined,
      ms = 5000,
    }: {
      message: string
      actionLabel?: string
      onAction?: () => void
      ms?: number
    }) =>
      setToasts((current) =>
        [...current, { id: newId(), message, actionLabel, onAction, ms }].slice(
          -MAX_TOASTS
        )
      ),
    []
  )
  return { toasts, push, dismiss }
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.ms)
    return () => clearTimeout(timer)
  }, [toast.id, toast.ms, onDismiss])
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-full bg-card px-4 py-2 text-sm shadow-lg ring-1 ring-white/10"
    >
      {toast.message}
      <button
        type="button"
        className="font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => {
          toast.onAction()
          onDismiss(toast.id)
        }}
      >
        {toast.actionLabel}
      </button>
    </div>
  )
}

/** Bottom-center notices, newest at the bottom. */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
