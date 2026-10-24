/* eslint-disable @next/next/no-img-element */
"use client"

import { memo, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import {
  Bookmark,
  Copy,
  Download,
  FolderInput,
  ImagePlus,
  RotateCcw,
  Share2,
  Shuffle,
  Star,
  Trash2,
  Volume2,
} from "lucide-react"

import {
  GenerationTile,
  type CardAction,
} from "@/components/studio/generation-card"

import { cn } from "@/lib/utils"
import { brandColor } from "@/lib/studio/model-brand"

import { RUN_MIME } from "../sidebar"
import { StatusChip } from "./status-chip"
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
  /** Open the result viewer (also for a run still generating, which updates live). */
  onOpen?: (item: GalleryItem) => void
  /** The loaded media's real aspect ratio, when it differs from the one the run asked for. */
  onMeasured?: (item: GalleryItem, aspect: number) => void
  onUseAsReference?: (item: GalleryItem) => void
  onSaveAsReference?: (item: GalleryItem) => void
}

const TILE_BUTTON =
  "inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

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

/** Invisible full-tile button that opens the viewer; sits under the tile's own controls. */
function OpenButton({
  item,
  onOpen,
}: {
  item: GalleryItem
  onOpen: (item: GalleryItem) => void
}) {
  return (
    <button
      type="button"
      aria-label={`Open generation: ${item.prompt}`}
      className="absolute inset-0 z-[1] cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
      onClick={() => onOpen(item)}
    />
  )
}

/** Reports the media's true shape once, so the layout settles after the first load. */
function reportShape(
  item: GalleryItem,
  width: number,
  height: number,
  onMeasured?: (item: GalleryItem, aspect: number) => void
) {
  if (!onMeasured || !width || !height) return
  const aspect = width / height
  if (Math.abs(aspect / (item.width / item.height) - 1) > 0.02)
    onMeasured(item, aspect)
}

/** Company badge, plus duration / resolution / sound for video. */
function TileBadges({ item }: { item: GalleryItem }) {
  const facts = [
    item.durationSec ? `${item.durationSec}s` : null,
    item.resolution ?? null,
  ].filter(Boolean)
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[2] flex max-w-[calc(100%-1rem)] items-center gap-1">
      {item.modelIcon ? (
        <StatusChip
          tone="info"
          className="size-6 justify-center p-0"
          title={item.modelLabel}
        >
          <img
            src={`/model-icons/${item.modelIcon}.svg`}
            alt=""
            className="size-3.5"
          />
        </StatusChip>
      ) : null}
      {facts.length > 0 ? (
        <StatusChip tone="info">{facts.join(" · ")}</StatusChip>
      ) : null}
      {item.hasSound ? (
        <StatusChip
          tone="info"
          icon={Volume2}
          className="size-6 justify-center p-0"
          role="img"
          aria-label="Has sound"
          title="Has sound"
        />
      ) : null}
    </div>
  )
}

function Placeholder() {
  return <span className="absolute inset-0 bg-card" aria-hidden="true" />
}

function StillMedia({
  item,
  tier,
  onMeasured,
}: {
  item: GalleryItem
  tier: LoadTier
  onMeasured?: (item: GalleryItem, aspect: number) => void
}) {
  return (
    <>
      <Placeholder />
      <img
        className="absolute inset-0 size-full object-cover"
        src={item.src}
        alt={item.alt}
        loading={tier === "full" ? "eager" : "lazy"}
        decoding="async"
        onLoad={(event) =>
          reportShape(
            item,
            event.currentTarget.naturalWidth,
            event.currentTarget.naturalHeight,
            onMeasured
          )
        }
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
  onMeasured,
}: {
  item: GalleryItem
  tier: LoadTier
  playing: boolean
  reducedMotion: boolean
  onMeasured?: (item: GalleryItem, aspect: number) => void
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
  // With a poster the tile is just an image until hovered; no player is created
  // (or downloaded) for the hundreds of videos that are never pointed at.
  const mountVideo = hasPoster ? active : armed

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
  }, [active, mountVideo])

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
          onLoad={(event) =>
            reportShape(
              item,
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
              onMeasured
            )
          }
        />
      ) : null}
      {mountVideo ? (
        <video
          ref={ref}
          className="absolute inset-0 size-full object-cover"
          muted
          loop
          playsInline
          src={item.videoSrc}
          preload={hasPoster ? "auto" : "metadata"}
          poster={hasPoster ? item.src : undefined}
          onLoadedData={() => setLoaded(true)}
          onLoadedMetadata={(event) =>
            reportShape(
              item,
              event.currentTarget.videoWidth,
              event.currentTarget.videoHeight,
              onMeasured
            )
          }
          style={{ opacity: showVideo ? 1 : 0 }}
        />
      ) : null}
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
  onOpen,
  onMeasured,
  onUseAsReference,
  onSaveAsReference,
}: GalleryTileProps) {
  const [hovered, setHovered] = useState(false)
  const style = rectStyle(rect, top)
  const glow = brandColor(item.modelIcon)
  // A short fade-in the moment a running tile turns into its result.
  const [seen, setSeen] = useState(item.status)
  const [justFinished, setJustFinished] = useState(false)
  if (seen !== item.status) {
    setSeen(item.status)
    if (seen === "generating" && item.status === "ready") setJustFinished(true)
  }
  useEffect(() => {
    if (!justFinished) return
    const timer = setTimeout(() => setJustFinished(false), 700)
    return () => clearTimeout(timer)
  }, [justFinished])

  if (item.status === "generating") {
    return (
      <div className="studio-tile group" style={style}>
        <GenerationTile
          state="generating"
          generatingKind={item.queued ? "queue" : item.stalled ? "warn" : "run"}
          {...(glow ? { glow } : {})}
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
        {onOpen && !item.queued ? (
          <OpenButton item={item} onOpen={onOpen} />
        ) : null}
        <div className="absolute right-2 bottom-2 z-[2] flex gap-2">
          {item.stalled && onRecheck ? (
            <button
              type="button"
              className={TILE_BUTTON}
              onClick={() => onRecheck(item)}
            >
              Check again
            </button>
          ) : null}
          {onCancel && !item.canceling ? (
            <button
              type="button"
              className={TILE_BUTTON}
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
        <div className="absolute inset-x-2 bottom-2 z-[2] flex justify-center gap-2">
          {onVariation ? (
            <button
              type="button"
              className={TILE_BUTTON}
              onClick={() => onVariation(item)}
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className={TILE_BUTTON}
              onClick={() => onDelete(item)}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          ) : null}
        </div>
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
      {...(onMeasured ? { onMeasured } : {})}
    />
  ) : (
    <StillMedia
      item={item}
      tier={tier}
      {...(onMeasured ? { onMeasured } : {})}
    />
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
    ...(onUseAsReference
      ? [
          {
            id: "use-reference",
            label: "Use as reference",
            icon: ImagePlus,
            onSelect: () => onUseAsReference(item),
          },
        ]
      : []),
    ...(onSaveAsReference
      ? [
          {
            id: "save-reference",
            label: "Save as reference",
            icon: Bookmark,
            onSelect: () => onSaveAsReference(item),
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
    <div
      className={cn("studio-tile", justFinished && "studio-finish")}
      style={style}
      draggable
      onDragStart={(event) => {
        // Drop it on a project in the sidebar to file it there.
        event.dataTransfer.setData(RUN_MIME, item.runId)
        event.dataTransfer.effectAllowed = "move"
      }}
    >
      <GenerationTile
        className="size-full"
        media={media}
        actions={actions}
        src={isVideo ? (item.videoSrc ?? item.src) : item.src}
        onMouseEnter={isVideo ? () => setHovered(true) : undefined}
        onMouseLeave={isVideo ? () => setHovered(false) : undefined}
        onFocus={isVideo ? () => setHovered(true) : undefined}
        onBlur={isVideo ? () => setHovered(false) : undefined}
      />
      {onOpen ? <OpenButton item={item} onOpen={onOpen} /> : null}
      <TileBadges item={item} />
      {item.starred ? (
        <StatusChip
          tone="star"
          icon={Star}
          role="img"
          aria-label="Starred"
          className="pointer-events-none absolute top-2 left-2 z-[2] size-6 justify-center p-0 [&_svg]:fill-current"
        />
      ) : null}
    </div>
  )
}

export const GalleryTile = memo(GalleryTileComponent)
