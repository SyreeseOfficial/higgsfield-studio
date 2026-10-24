import type { GalleryItem } from "@/components/studio/gallery/gallery-types"
import type { AssetLibraryItem } from "@/lib/studio/uploads"

import { getModel } from "@/generation/catalog"

import type { RunRecord } from "./history"

/** Day bucket for the feed's date headings. */
function dayGroup(createdAt: number) {
  const day = new Date(createdAt)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - +day) / 86_400_000)
  return {
    groupId: String(+day),
    groupLabel:
      days <= 0
        ? "Today"
        : days === 1
          ? "Yesterday"
          : day.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
  }
}

const SOUND_KEYS = ["sound", "generateAudio", "keepOriginalSound"]

/** Model icon plus, for video, duration / resolution / sound read from the settings the run used. */
function tileFacts(run: RunRecord) {
  let icon: string | undefined
  try {
    icon = getModel(run.modelId).icon
  } catch {
    /* model no longer installed */
  }
  const { duration, resolution } = run.settings
  return {
    ...(icon ? { modelIcon: icon } : {}),
    ...(run.surface === "video"
      ? {
          ...(typeof duration === "number" ? { durationSec: duration } : {}),
          ...(typeof resolution === "string" ? { resolution } : {}),
          ...(SOUND_KEYS.some((key) => run.settings[key] === true)
            ? { hasSound: true }
            : {}),
        }
      : {}),
  }
}

/** One feed tile per result URL; a running or failed run is a single placeholder tile. */
const itemCache = new WeakMap<
  RunRecord,
  { day: number; items: GalleryItem[] }
>()

/** Tiles for one run. A record that did not change gives back the same tile objects, so React
    can skip every tile whose run is untouched when another one finishes. */
export function runToGalleryItems(run: RunRecord): GalleryItem[] {
  const day = new Date().setHours(0, 0, 0, 0) // the "Today" label depends on it
  const cached = itemCache.get(run)
  if (cached?.day === day) return cached.items
  const items = buildGalleryItems(run)
  itemCache.set(run, { day, items })
  return items
}

function buildGalleryItems(run: RunRecord): GalleryItem[] {
  const facts = tileFacts(run)
  const base = {
    ...facts,
    runId: run.id,
    ...(run.projectId ? { projectId: run.projectId } : {}),
    createdAt: run.createdAt,
    width: run.aspect,
    height: 1,
    prompt: run.prompt,
    alt: run.prompt || run.modelLabel,
    modelLabel: run.modelLabel,
    modelId: run.modelId,
    ...(run.requestId ? { requestId: run.requestId } : {}),
    ...(run.media?.length ? { references: run.media } : {}),
    ...(run.inputMode ? { inputMode: run.inputMode } : {}),
    settings: run.settings,
    ...dayGroup(run.createdAt),
    ...(run.starred ? { starred: true } : {}),
    ...(run.completedAt ? { completedAt: run.completedAt } : {}),
  }
  if (run.status !== "completed") {
    return [
      {
        ...base,
        id: run.id,
        kind: run.surface,
        status: run.status === "running" ? "generating" : "failed",
        ...(run.stalled ? { stalled: true } : {}),
        ...(run.canceling ? { canceling: true } : {}),
        ...(run.queued ? { queued: run.queued } : {}),
        src: "",
        ...(run.error ? { failureLabel: run.error } : {}),
        ...(run.status === "failed" && run.requestId
          ? { supportId: run.requestId }
          : {}),
      },
    ]
  }
  return run.urls.map((url, index) => ({
    ...base,
    id: run.urls.length > 1 ? `${run.id}:${index}` : run.id,
    kind: run.surface,
    status: "ready",
    src: run.surface === "video" ? "" : url,
    ...(run.surface === "video" ? { videoSrc: url } : {}),
  }))
}

export function runToLibraryItems(run: RunRecord): AssetLibraryItem[] {
  if (run.status !== "completed") return []
  return run.urls.map((url, index) => ({
    id: `${run.id}:${index}`,
    src: url,
    kind: run.surface,
    name: run.prompt.slice(0, 60),
    source: "generation",
    createdAt: run.createdAt,
  }))
}
