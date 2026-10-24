"use client"

import { useEffect, useRef, useState } from "react"
import { Minus, Plus, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CachedImg } from "@/components/studio/cached-img"

const MAX_SCALE = 8

type View = { scale: number; x: number; y: number }
const HOME: View = { scale: 1, x: 0, y: 0 }

/** Image with wheel/pinch-free zoom (wheel, + / − / 0 keys, double click), drag to
    pan and a minimap while zoomed in. Translation is measured from the centre. */
export function ZoomImage({
  src,
  alt,
  onSize,
}: {
  src: string
  alt: string
  onSize?: (size: { width: number; height: number }) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; from: View } | null>(null)
  const [view, setView] = useState<View>(HOME)
  const [dragging, setDragging] = useState(false)
  // Rendered sizes (picture at 100%, and the stage), for the minimap.
  const [size, setSize] = useState<{
    iw: number
    ih: number
    bw: number
    bh: number
  } | null>(null)
  const measure = () => {
    const i = img.current
    const b = box.current
    if (i && b)
      setSize({
        iw: i.offsetWidth,
        ih: i.offsetHeight,
        bw: b.clientWidth,
        bh: b.clientHeight,
      })
  }
  useEffect(() => {
    const b = box.current
    if (!b) return
    const observer = new ResizeObserver(measure)
    observer.observe(b)
    return () => observer.disconnect()
  }, [])

  const clamp = (v: View): View => {
    const el = img.current
    if (!el || v.scale <= 1) return HOME
    const maxX = (el.offsetWidth * v.scale) / 2
    const maxY = (el.offsetHeight * v.scale) / 2
    return {
      scale: v.scale,
      x: Math.min(maxX, Math.max(-maxX, v.x)),
      y: Math.min(maxY, Math.max(-maxY, v.y)),
    }
  }
  /** Zoom toward a point (relative to the box centre) so it stays under the cursor. */
  const zoomAt = (factor: number, cx = 0, cy = 0) =>
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(1, v.scale * factor))
      const k = scale / v.scale
      return clamp({ scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k })
    })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(
        event.deltaY < 0 ? 1.15 : 1 / 1.15,
        event.clientX - r.left - r.width / 2,
        event.clientY - r.top - r.height / 2
      )
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (
        (event.target as HTMLElement | null)?.closest("input,textarea,select")
      )
        return
      if (event.key === "+" || event.key === "=") zoomAt(1.4)
      else if (event.key === "-") zoomAt(1 / 1.4)
      else if (event.key === "0") setView(HOME)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const zoomed = view.scale > 1
  // Visible part of the picture, as fractions, for the minimap.
  const frac = (() => {
    if (!zoomed || !size) return null
    const w = size.iw * view.scale
    const h = size.ih * view.scale
    const vw = Math.min(1, size.bw / w)
    const vh = Math.min(1, size.bh / h)
    return {
      left: Math.max(0, Math.min(1 - vw, 0.5 - view.x / w - vw / 2)),
      top: Math.max(0, Math.min(1 - vh, 0.5 - view.y / h - vh / 2)),
      width: vw,
      height: vh,
    }
  })()

  return (
    <div
      ref={box}
      className="relative flex size-full touch-none items-center justify-center overflow-hidden"
      style={{ cursor: zoomed ? "grab" : "zoom-in" }}
      onDoubleClick={(event) => {
        const r = event.currentTarget.getBoundingClientRect()
        if (zoomed) setView(HOME)
        else
          zoomAt(
            2.5,
            event.clientX - r.left - r.width / 2,
            event.clientY - r.top - r.height / 2
          )
      }}
      onPointerDown={(event) => {
        if (!zoomed) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY, from: view }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const d = drag.current
        if (!d) return
        setView(
          clamp({
            scale: d.from.scale,
            x: d.from.x + event.clientX - d.x,
            y: d.from.y + event.clientY - d.y,
          })
        )
      }}
      onPointerUp={() => {
        drag.current = null
        setDragging(false)
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
      }}
    >
      <CachedImg
        ref={img}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          measure()
          onSize?.({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }}
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl select-none"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: dragging ? "none" : "transform 80ms ease-out",
        }}
      />
      <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => zoomAt(1 / 1.4)}
        >
          <Minus />
        </Button>
        <span className="min-w-10 text-center text-xs tabular-nums">
          {Math.round(view.scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => zoomAt(1.4)}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reset zoom"
          disabled={!zoomed}
          onClick={() => setView(HOME)}
        >
          <RotateCcw />
        </Button>
      </div>
      {frac ? (
        <div
          className="pointer-events-none absolute bottom-2 left-2 w-28 overflow-hidden rounded-lg border border-white/20 bg-black/60"
          style={{ aspectRatio: `${size!.iw} / ${size!.ih}` }}
          aria-hidden
        >
          <CachedImg
            src={src}
            alt=""
            className="size-full object-cover opacity-70"
          />
          <span
            className="absolute border border-primary bg-primary/20"
            style={{
              left: `${frac.left * 100}%`,
              top: `${frac.top * 100}%`,
              width: `${frac.width * 100}%`,
              height: `${frac.height * 100}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
