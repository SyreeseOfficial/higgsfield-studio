import type { GalleryItem } from "@/components/studio/gallery/gallery-types"
import type { AssetLibraryItem } from "@/lib/studio/uploads"

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

/** One feed tile per result URL; a running or failed run is a single placeholder tile. */
export function runToGalleryItems(run: RunRecord): GalleryItem[] {
  const base = {
    runId: run.id,
    ...(run.projectId ? { projectId: run.projectId } : {}),
    createdAt: run.createdAt,
    width: run.aspect,
    height: 1,
    prompt: run.prompt,
    alt: run.prompt || run.modelLabel,
    modelLabel: run.modelLabel,
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
  return run.urls.map((url) => ({
    id: url,
    src: url,
    kind: run.surface,
    name: run.prompt.slice(0, 60),
    source: "generation",
    createdAt: run.createdAt,
  }))
}
