/* eslint-disable @next/next/no-img-element */
"use client"

import { memo, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import {
  Copy,
  Download,
  FolderInput,
  Share2,
  Shuffle,
  Star,
  Trash2,
} from "lucide-react"

import {
  GenerationTile,
  type CardAction,
} from "@/components/studio/generation-card"

import type { TileRect } from "./justified-engine"
import type { GalleryItem, LoadTier } from "./gallery-types"

/**
 * One gallery tile, absolutely positioned at the engine-computed rect.
 * Mounted media stays mounted while scrolling so finished generations never
 * flash back to placeholders.
 */
export interface GalleryTileProps {
  item: GalleryItem
  rect: TileRect
  top: number
  tier: LoadTier
  reducedMotion: boolean
  onDelete?: (item: GalleryItem) => void
  onCancel?: (item: GalleryItem) => void
  onRecheck?: (item: GalleryItem) => void
  onMove?: (item: GalleryItem) => void
  onVariation?: (item: GalleryItem) => void
  onStar?: (item: GalleryItem) => void
}

function rectStyle(rect: TileRect, top: number): CSSProperties {
  return { left: rect.x, top, width: rect.width, height: rect.height }
}

async function copyText(text: string) {
  await navigator.clipboard?.writeText(text)
}

/** "Generating 0:42 · usually ~3 min": elapsed time ticks once a second. */
function Elapsed({ since, usually }: { since: number; usually: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  return (
    <>
      Generating {Math.floor(seconds / 60)}:
      {String(seconds % 60).padStart(2, "0")}
      <span className="font-normal opacity-70"> · usually {usually}</span>
    </>
  )
}

function Placeholder() {
  return <span className="absolute inset-0 bg-card" aria-hidden="true" />
}

function StillMedia({ item, tier }: { item: GalleryItem; tier: LoadTier }) {
  return (
    <>
      <Placeholder />
      <img
        className="absolute inset-0 size-full object-cover"
        src={item.src}
        alt={item.alt}
        loading={tier === "full" ? "eager" : "lazy"}
        decoding="async"
      />
    </>
  )
}

/** Poster by default; plays muted on hover/focus; honours reduced motion. */
/** At most one tile video plays at a time; starting one stops the last. */
let playingVideo: HTMLVideoElement | null = null

function HoverVideo({
  item,
  tier,
  playing,
  reducedMotion,
}: {
  item: GalleryItem
  tier: LoadTier
  playing: boolean
  reducedMotion: boolean
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Download starts once the tile has been in the viewport, and is never undone.
  const [armed, setArmed] = useState(tier === "full")
  if (tier === "full" && !armed) setArmed(true)
  const active = playing && !reducedMotion
  const hasPoster = item.src.length > 0
  // Without a poster the first frame is the still, so keep the video visible.
  const showVideo = !hasPoster || (active && loaded)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active) {
      if (playingVideo && playingVideo !== v) playingVideo.pause()
      playingVideo = v
      void v.play()?.catch(() => undefined)
    } else {
      v.pause()
      try {
        v.currentTime = 0
      } catch {}
    }
  }, [active])

  return (
    <>
      <Placeholder />
      {hasPoster ? (
        <img
          className="absolute inset-0 size-full object-cover"
          src={item.src}
          alt={item.alt}
          loading={tier === "full" ? "eager" : "lazy"}
          decoding="async"
          style={{ opacity: showVideo ? 0 : 1 }}
        />
      ) : null}
      <video
        ref={ref}
        className="absolute inset-0 size-full object-cover"
        muted
        loop
        playsInline
        src={armed ? item.videoSrc : undefined}
        preload={hasPoster ? "none" : "metadata"}
        poster={hasPoster ? item.src : undefined}
        onLoadedData={() => setLoaded(true)}
        style={{ opacity: showVideo ? 1 : 0 }}
      />
    </>
  )
}

function GalleryTileComponent({
  item,
  rect,
  top,
  tier,
  reducedMotion,
  onDelete,
  onCancel,
  onRecheck,
  onMove,
  onVariation,
  onStar,
}: GalleryTileProps) {
  const [hovered, setHovered] = useState(false)
  const style = rectStyle(rect, top)

  if (item.status === "generating") {
    return (
      <div className="studio-tile group" style={style}>
        <GenerationTile
          state="generating"
          generatingLabel={
            item.queued ? (
              `Queued · ${item.queued}`
            ) : item.canceling ? (
              "Canceling…"
            ) : item.stalled ? (
              "Still working"
            ) : (
              <Elapsed
                since={item.createdAt}
                usually={item.kind === "video" ? "~3 min" : "~30 s"}
              />
            )
          }
          className="size-full"
        />
        <div className="absolute right-2 bottom-2 z-[2] flex gap-2">
          {item.stalled && onRecheck ? (
            <button
              type="button"
              className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-black/60"
              onClick={() => onRecheck(item)}
            >
              Check again
            </button>
          ) : null}
          {onCancel && !item.canceling ? (
            <button
              type="button"
              className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-black/60"
              onClick={() => onCancel(item)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    )
  }
  if (item.status === "failed") {
    return (
      <div className="studio-tile group" style={style}>
        <GenerationTile
          state="failed"
          failureLabel={
            <>
              {item.failureLabel}
              {item.supportId ? (
                <span className="mt-1 block font-mono text-[10px] opacity-60 select-all">
                  Support ID: {item.supportId}
                </span>
              ) : null}
            </>
          }
          className="size-full"
        />
        {onDelete ? (
          <button
            type="button"
            aria-label="Remove"
            className="absolute top-2 right-2 z-[2] flex size-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 hover:bg-black/60"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    )
  }

  const isVideo = item.kind === "video"
  const media = isVideo ? (
    <HoverVideo
      item={item}
      tier={tier}
      playing={hovered}
      reducedMotion={reducedMotion}
    />
  ) : (
    <StillMedia item={item} tier={tier} />
  )

  const actions: CardAction[] = [
    { id: "download", label: "Download", icon: Download },
    {
      id: "copy",
      label: "Copy prompt",
      icon: Copy,
      onSelect: () => void copyText(item.prompt),
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      onSelect: () => {
        const url = new URL(item.videoSrc ?? item.src, window.location.href)
          .href
        if (navigator.share)
          void navigator
            .share({ text: item.prompt, url })
            .catch(() => undefined)
        else void copyText(`${item.prompt}\n${url}`)
      },
    },
    ...(onStar
      ? [
          {
            id: "star",
            label: item.starred ? "Unstar" : "Star",
            icon: Star,
            onSelect: () => onStar(item),
          },
        ]
      : []),
    ...(onVariation
      ? [
          {
            id: "variation",
            label: "More like this",
            icon: Shuffle,
            onSelect: () => onVariation(item),
          },
        ]
      : []),
    ...(onMove
      ? [
          {
            id: "move",
            label: "Move to project",
            icon: FolderInput,
            onSelect: () => onMove(item),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            danger: true,
            onSelect: () => onDelete(item),
          },
        ]
      : []),
  ]

  return (
    <div className="studio-tile" style={style}>
      <GenerationTile
        className="size-full"
        media={media}
        actions={actions}
        generation={{
          src: isVideo ? (item.videoSrc ?? item.src) : item.src,
          poster: isVideo ? item.src || undefined : undefined,
          mediaType: isVideo ? "video" : "image",
          aspectRatio: item.width / item.height,
          prompt: item.prompt,
          model: item.modelLabel,
          createdAt: item.createdAt,
          settings: item.settings,
          ...(item.completedAt ? { completedAt: item.completedAt } : {}),
        }}
        openLabel={`Open generation: ${item.prompt}`}
        onMouseEnter={isVideo ? () => setHovered(true) : undefined}
        onMouseLeave={isVideo ? () => setHovered(false) : undefined}
        onFocus={isVideo ? () => setHovered(true) : undefined}
        onBlur={isVideo ? () => setHovered(false) : undefined}
      />
      {item.starred ? (
        <Star
          aria-label="Starred"
          className="pointer-events-none absolute top-2 left-2 z-[2] size-4 fill-yellow-300 text-yellow-300 drop-shadow"
        />
      ) : null}
    </div>
  )
}

export const GalleryTile = memo(GalleryTileComponent)
