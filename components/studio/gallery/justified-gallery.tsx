"use client"

import { Fragment, useState, type ReactNode } from "react"
import { Check, Download, FolderInput, Loader2, Trash2 } from "lucide-react"

import { downloadMany } from "@/lib/studio/download-media"

import {
  ScreenEmptyState,
  type ScreenEmptyStateContent,
} from "@/components/studio/screen-empty-state"

import { DensityControl } from "./density-control"
import { GalleryTile } from "./gallery-tile"
import type { GalleryItem, LoadTier } from "./gallery-types"
import { useJustifiedGallery } from "./use-justified-gallery"
import { useReducedMotion } from "./use-reduced-motion"

/**
 * JustifiedGallery — the virtualized justified-masonry feed. The engine owns
 * layout + windowing math; this renders only the visible rows as absolutely
 * positioned tiles over a fixed-height sizer.
 */
export interface JustifiedGalleryProps {
  items: GalleryItem[]
  title?: ReactNode
  grouped?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void | Promise<unknown>
  emptyState: ScreenEmptyStateContent
  onDelete?: (item: GalleryItem) => void
  onCancel?: (item: GalleryItem) => void
  onRecheck?: (item: GalleryItem) => void
  /** Ask to file these tiles under a project (the caller shows the picker). */
  onMove?: (items: GalleryItem[]) => void
  onDeleteMany?: (items: GalleryItem[]) => void
}

export function JustifiedGallery({
  items,
  title = "Your generations",
  grouped = false,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyState,
  onDelete,
  onCancel,
  onRecheck,
  onMove,
  onDeleteMany,
}: JustifiedGalleryProps) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const reducedMotion = useReducedMotion()
  const { viewportRef, ...gallery } = useJustifiedGallery(items, grouped, {
    hasMore,
    loadingMore,
    onLoadMore,
  })
  const viewBottom = gallery.scrollTop + gallery.viewportHeight
  const chosen = items.filter((item) => selected.has(item.id))
  const bulk = onMove || onDeleteMany
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const pill =
    "inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium hover:bg-white/14 disabled:opacity-40 disabled:hover:bg-white/8"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-center justify-between gap-4 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {title != null ? (
            <h1 className="text-q-headline-sm-semi-bold whitespace-nowrap">
              {title}
            </h1>
          ) : null}
          {gallery.loadingMore ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Loading
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {selecting ? (
            <>
              <span className="text-xs text-muted-foreground" role="status">
                {chosen.length} selected
              </span>
              <button
                type="button"
                className={pill}
                disabled={!chosen.some((i) => i.status === "ready")}
                onClick={() =>
                  void downloadMany(
                    chosen.flatMap((i) =>
                      i.status === "ready" ? [i.videoSrc ?? i.src] : []
                    )
                  )
                }
              >
                <Download className="size-3.5" /> Download
              </button>
              {onMove ? (
                <button
                  type="button"
                  className={pill}
                  disabled={!chosen.length}
                  onClick={() => {
                    onMove(chosen)
                    stopSelecting()
                  }}
                >
                  <FolderInput className="size-3.5" /> Move
                </button>
              ) : null}
              {onDeleteMany ? (
                <button
                  type="button"
                  className={pill}
                  disabled={!chosen.length}
                  onClick={() => {
                    onDeleteMany(chosen)
                    stopSelecting()
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              ) : null}
              <button type="button" className={pill} onClick={stopSelecting}>
                Done
              </button>
            </>
          ) : (
            <>
              {bulk ? (
                <button
                  type="button"
                  className={pill}
                  disabled={items.length === 0}
                  onClick={() => setSelecting(true)}
                >
                  Select
                </button>
              ) : null}
              <DensityControl
                value={gallery.density}
                onChange={gallery.setDensity}
              />
            </>
          )}
        </div>
      </header>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]"
      >
        {gallery.itemCount === 0 ? (
          <ScreenEmptyState className="h-full" {...emptyState} />
        ) : (
          <div
            className="relative w-full"
            style={{ height: gallery.layout.totalHeight }}
          >
            {gallery.visibleRows.map((row) => {
              if (row.type === "header") {
                return (
                  <div
                    key={row.key}
                    className="absolute inset-x-0 flex items-end px-0.5 pb-2"
                    style={{ top: row.y, height: row.height }}
                  >
                    <h3 className="text-xs font-medium text-muted-foreground">
                      {row.label}
                    </h3>
                  </div>
                )
              }
              const visible =
                row.y < viewBottom && row.y + row.height > gallery.scrollTop
              const tier: LoadTier = visible ? "full" : "near"
              return row.tiles!.map((rect) => (
                <Fragment key={rect.item.id}>
                  <GalleryTile
                    item={rect.item}
                    rect={rect}
                    top={row.y}
                    tier={tier}
                    reducedMotion={reducedMotion}
                    onDelete={onDelete}
                    onCancel={onCancel}
                    onRecheck={onRecheck}
                    {...(onMove
                      ? { onMove: (i: GalleryItem) => onMove([i]) }
                      : {})}
                  />
                  {selecting ? (
                    <button
                      type="button"
                      aria-pressed={selected.has(rect.item.id)}
                      aria-label={`Select: ${rect.item.alt}`}
                      className="absolute z-[5] rounded-[inherit] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      style={{
                        left: rect.x,
                        top: row.y,
                        width: rect.width,
                        height: rect.height,
                      }}
                      onClick={() => toggle(rect.item.id)}
                    >
                      <span
                        className={
                          "absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-2 border-white/80 " +
                          (selected.has(rect.item.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/40")
                        }
                      >
                        {selected.has(rect.item.id) ? (
                          <Check className="size-3.5" />
                        ) : null}
                      </span>
                    </button>
                  ) : null}
                </Fragment>
              ))
            })}
          </div>
        )}
      </div>
    </div>
  )
}
