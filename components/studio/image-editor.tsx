"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcw, RotateCw } from "lucide-react"

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
  centeredRect,
  moveRect,
  rectFromCorners,
  type Rect,
} from "@/lib/studio/crop"
import { cn } from "@/lib/utils"

const PREVIEW_MAX = { w: 560, h: 380 }
const RATIOS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
]
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 }

type Corner = "tl" | "tr" | "bl" | "br"

/** The bitmap drawn rotated by a quarter-turn count onto a canvas of the given size. */
function drawRotated(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  turns: number,
  width: number,
  height: number
) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.translate(width / 2, height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  const quarter = turns % 2 === 1
  ctx.drawImage(
    bitmap,
    -(quarter ? height : width) / 2,
    -(quarter ? width : height) / 2,
    quarter ? height : width,
    quarter ? width : height
  )
}

/** Crop and rotate an image before it is uploaded as a reference. */
export function ImageEditor({
  file,
  onApply,
  onCancel,
}: {
  file: File
  onApply: (edited: File) => void | Promise<void>
  onCancel: () => void
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [turns, setTurns] = useState(0)
  const [rect, setRect] = useState<Rect>(FULL)
  const [lock, setLock] = useState<number | undefined>()
  const [busy, setBusy] = useState(false)
  const preview = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<
    | { kind: "move"; x: number; y: number; from: Rect }
    | { kind: "corner"; fixed: { x: number; y: number } }
    | null
  >(null)

  useEffect(() => {
    let alive = true
    if (file.type === "image/gif") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once from the file type
      setError("Animated GIFs can't be edited here.")
      return
    }
    createImageBitmap(file)
      .then((b) => alive && setBitmap(b))
      .catch(() => alive && setError("This image can't be opened for editing."))
    return () => {
      alive = false
    }
  }, [file])

  const quarter = turns % 2 === 1
  const natural = bitmap
    ? {
        w: quarter ? bitmap.height : bitmap.width,
        h: quarter ? bitmap.width : bitmap.height,
      }
    : { w: 1, h: 1 }
  const scale = Math.min(
    PREVIEW_MAX.w / natural.w,
    PREVIEW_MAX.h / natural.h,
    1
  )
  const view = {
    w: Math.round(natural.w * scale),
    h: Math.round(natural.h * scale),
  }

  useEffect(() => {
    if (preview.current && bitmap)
      drawRotated(preview.current, bitmap, turns, view.w, view.h)
  }, [bitmap, turns, view.w, view.h])

  const rotate = (by: number) => {
    setTurns((t) => (t + by + 4) % 4)
    setRect(FULL)
  }
  const pick = (ratio: number | undefined) => {
    setLock(ratio)
    setRect(ratio ? centeredRect(natural, ratio) : FULL)
  }

  const at = (event: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (event.clientY - r.top) / r.height)),
    }
  }
  const startCorner = (corner: Corner) => (event: React.PointerEvent) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      kind: "corner",
      fixed: {
        x: corner.endsWith("l") ? rect.x + rect.w : rect.x,
        y: corner.startsWith("t") ? rect.y + rect.h : rect.y,
      },
    }
  }
  const onMove = (event: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = at(event)
    if (d.kind === "corner") setRect(rectFromCorners(d.fixed, p, natural, lock))
    else setRect(moveRect(d.from, p.x - d.x, p.y - d.y))
  }

  const apply = async () => {
    if (!bitmap) return
    setBusy(true)
    try {
      const full = document.createElement("canvas")
      drawRotated(full, bitmap, turns, natural.w, natural.h)
      const sx = Math.round(rect.x * natural.w)
      const sy = Math.round(rect.y * natural.h)
      const sw = Math.max(1, Math.round(rect.w * natural.w))
      const sh = Math.max(1, Math.round(rect.h * natural.h))
      const out = document.createElement("canvas")
      out.width = sw
      out.height = sh
      out.getContext("2d")?.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh)
      const type = ["image/jpeg", "image/webp"].includes(file.type)
        ? file.type
        : "image/png"
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, type, 0.92)
      )
      if (!blob) throw new Error("Could not save the edited image.")
      await onApply(new File([blob], file.name, { type }))
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not edit the image."
      )
      setBusy(false)
    }
  }

  const changed = turns !== 0 || rect.w < 1 || rect.h < 1
  const handle = (corner: Corner, pos: string) => (
    <span
      key={corner}
      role="presentation"
      className={cn(
        "absolute size-4 touch-none rounded-sm border-2 border-white bg-black/60",
        pos
      )}
      style={{
        cursor:
          corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize",
      }}
      onPointerDown={startCorner(corner)}
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
    />
  )

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Crop and rotate</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {error ? (
            <p role="alert" className="text-sm text-q-state-error-fg">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col items-center gap-4">
            <div
              ref={frame}
              className="relative touch-none select-none"
              style={{ width: view.w, height: view.h }}
            >
              <canvas
                ref={preview}
                className="size-full rounded-md"
                aria-label="Image preview"
              />
              <div
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  const p = at(event)
                  drag.current = { kind: "move", x: p.x, y: p.y, from: rect }
                }}
                onPointerMove={onMove}
                onPointerUp={() => (drag.current = null)}
              >
                {handle("tl", "-top-2 -left-2")}
                {handle("tr", "-top-2 -right-2")}
                {handle("bl", "-bottom-2 -left-2")}
                {handle("br", "-right-2 -bottom-2")}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Rotate left"
                onClick={() => rotate(-1)}
              >
                <RotateCcw />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Rotate right"
                onClick={() => rotate(1)}
              >
                <RotateCw />
              </Button>
              {RATIOS.map((ratio) => (
                <Button
                  key={ratio.label}
                  variant={lock === ratio.value ? "default" : "outline"}
                  size="sm"
                  aria-pressed={lock === ratio.value}
                  onClick={() => pick(ratio.value)}
                >
                  {ratio.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(rect.w * natural.w)} ×{" "}
              {Math.round(rect.h * natural.h)} px
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!bitmap || !changed || busy}
            onClick={() => void apply()}
          >
            {busy ? "Saving…" : "Use edited image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
