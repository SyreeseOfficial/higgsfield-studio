/** Data model for the justified-masonry feed. width/height only need the right ratio. */
import type { MediaItem } from "@/generation/catalog"

export type MediaKind = "image" | "video"
export type ItemStatus = "ready" | "generating" | "failed"

export interface GalleryItem {
  id: string
  /** Run this item belongs to (one video, or one of N images). */
  runId: string
  projectId?: string
  createdAt: number
  kind: MediaKind
  status: ItemStatus
  /** Still for images; poster (may be empty) for video. */
  src: string
  videoSrc?: string
  width: number
  height: number
  failureLabel?: string
  /** Generating tiles: deadline passed, job may still finish. */
  stalled?: boolean
  canceling?: boolean
  starred?: boolean
  /** Platform request id of a failed run, for support. */
  supportId?: string
  completedAt?: number
  /** 1-based place in the local queue, for runs not yet sent. */
  queued?: number
  prompt: string
  alt: string
  modelLabel: string
  modelId?: string
  /** Platform request id (the Support ID); empty while still queued locally. */
  requestId?: string
  /** Reference inputs the run was submitted with. */
  references?: MediaItem[]
  inputMode?: string
  settings: Record<string, unknown>
  groupId: string
  groupLabel: string
}

/** How near a tile is to the viewport — drives eager vs lazy loading. */
export type LoadTier = "full" | "near" | "far"
