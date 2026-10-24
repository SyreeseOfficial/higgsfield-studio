"use client"

import { useEffect, useRef, useState, type ClipboardEvent } from "react"

import type {
  MediaItem,
  MediaKind,
  MediaRole,
  ModelEntry,
} from "@/generation/catalog"
import {
  inputRoles,
  MEDIA_ROLES,
  REFERENCE_ROLE,
} from "@/generation/catalog/media-inputs"
import { kindOf } from "@/lib/studio/uploads"
import type { AssetSelection } from "@/lib/studio/uploads"

import type { StudioPromptBoxProps } from "../studio-prompt-box"

export function mediaSlots(model: ModelEntry, inputMode?: string): MediaRole[] {
  const limits = inputRoles(model, inputMode)
  return MEDIA_ROLES.filter(
    (role) =>
      !!limits[role] &&
      (role === "start" ||
        role === "end" ||
        role === "source" ||
        ((role === "video" || role === "audio") && limits[role] === 1))
  )
}

/** Which kinds of reference the dock can still take, and how many of each. */
export function referenceRoom(
  model: ModelEntry,
  inputMode: string | undefined,
  media: MediaItem[]
) {
  const limits = inputRoles(model, inputMode)
  const slots = mediaSlots(model, inputMode)
  const kinds = (Object.keys(REFERENCE_ROLE) as MediaKind[]).filter(
    (kind) =>
      !slots.includes(REFERENCE_ROLE[kind]) &&
      (limits[REFERENCE_ROLE[kind]] ?? 0) > 0
  )
  const kindLimits = Object.fromEntries(
    kinds.map((kind) => [
      kind,
      Math.max(
        0,
        (limits[REFERENCE_ROLE[kind]] ?? 0) -
          media.filter((item) => item.role === REFERENCE_ROLE[kind]).length
      ),
    ])
  ) as Partial<Record<MediaKind, number>>
  const remaining = Object.values(kindLimits).reduce(
    (total, count) => total + count,
    0
  )
  return { kinds, kindLimits, remaining }
}

/** Pasted images and files dropped on the dock become references, like the library's upload tile. */
export function useReferenceIntake({
  model,
  inputMode,
  media,
  onMediaAdd,
  library,
}: Pick<
  StudioPromptBoxProps,
  "model" | "inputMode" | "media" | "onMediaAdd" | "library"
>) {
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null
  )
  const busy = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const [dragging, setDragging] = useState(false)

  const take = async (files: File[]) => {
    if (!files.length || busy.current) return
    busy.current = true
    try {
      const { kinds, kindLimits } = referenceRoom(model, inputMode, media)
      if (!kinds.length)
        throw new Error(`${model.label} doesn't take reference files.`)
      const used: Partial<Record<MediaKind, number>> = {}
      for (const file of files) {
        const kind = kindOf(file)
        if (!kinds.includes(kind))
          throw new Error(`${model.label} doesn't take ${kind} references.`)
        used[kind] = (used[kind] ?? 0) + 1
        if (used[kind]! > (kindLimits[kind] ?? 0))
          throw new Error(
            `You can add ${kindLimits[kind] ?? 0} more ${kind} files.`
          )
      }
      abort.current = new AbortController()
      setStatus({ text: "Uploading reference…", error: false })
      const uploaded: AssetSelection[] = []
      let reused = 0
      for (const file of files)
        uploaded.push(
          await library.onUpload(file, {
            signal: abort.current.signal,
            onReused: () => reused++,
            onProgress: (fraction) =>
              setStatus({
                text: `Uploading reference… ${Math.round(fraction * 100)}%`,
                error: false,
              }),
          })
        )
      onMediaAdd("auto", uploaded)
      if (reused) {
        setStatus({
          text:
            reused === uploaded.length
              ? "Already uploaded, reusing it."
              : `${reused} already uploaded, reusing.`,
          error: false,
        })
        window.setTimeout(() => setStatus(null), 2500)
      } else setStatus(null)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError")
        setStatus(null)
      else
        setStatus({
          text: caught instanceof Error ? caught.message : "Upload failed.",
          error: true,
        })
    } finally {
      busy.current = false
    }
  }

  // Files dragged anywhere over the window are taken; the overlay says so.
  const takeRef = useRef(take)
  useEffect(() => {
    takeRef.current = take
  })
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: globalThis.DragEvent) =>
      !!event.dataTransfer?.types.includes("Files")
    const enter = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const leave = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const over = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) event.preventDefault() // else the browser opens the file
    }
    const drop = (event: globalThis.DragEvent) => {
      depth = 0
      setDragging(false)
      // A drop zone inside a dialog (the library's upload tile) handles its own files.
      if (!hasFiles(event) || event.defaultPrevented) return
      event.preventDefault()
      void takeRef.current(Array.from(event.dataTransfer?.files ?? []))
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragleave", leave)
    window.addEventListener("dragover", over)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("dragover", over)
      window.removeEventListener("drop", drop)
    }
  }, [])

  return {
    status,
    dragging,
    cancel: () => abort.current?.abort(),
    onPaste: (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData.files)
      if (!files.length) return
      event.preventDefault()
      void take(files)
    },
  }
}
