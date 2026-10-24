import type { GalleryItem } from "@/components/studio/gallery/gallery-types"

export type FeedKind = "all" | "image" | "video" | "failed" | "starred"
export type FeedSort = "newest" | "oldest" | "model" | "starred"

export interface FeedView {
  kind: FeedKind
  /** Model label, or "all". */
  model: string
  sort: FeedSort
}

export const DEFAULT_FEED_VIEW: FeedView = {
  kind: "all",
  model: "all",
  sort: "newest",
}

/** Items are already newest first; every sort here is stable, so a run's tiles stay in order. */
export function applyFeedView(
  items: GalleryItem[],
  view: FeedView
): GalleryItem[] {
  const shown = items.filter((item) => {
    if (view.model !== "all" && item.modelLabel !== view.model) return false
    switch (view.kind) {
      case "image":
      case "video":
        return item.kind === view.kind && item.status !== "failed"
      case "failed":
        return item.status === "failed"
      case "starred":
        return item.starred === true
      default:
        return true
    }
  })
  switch (view.sort) {
    case "oldest":
      return [...shown].sort((a, b) => a.createdAt - b.createdAt)
    case "model":
      return [...shown].sort((a, b) => a.modelLabel.localeCompare(b.modelLabel))
    case "starred":
      return [...shown].sort(
        (a, b) => Number(b.starred === true) - Number(a.starred === true)
      )
    default:
      return shown
  }
}

/** Day headings only make sense when the feed is in date order. */
export const isDateSorted = (sort: FeedSort) =>
  sort === "newest" || sort === "oldest"

export function emptyFeedMessage(view: FeedView): string {
  if (view.kind === "failed") return "No failed runs."
  if (view.kind === "starred")
    return "Nothing starred yet. Star a tile from its menu."
  if (view.kind === "image" || view.kind === "video")
    return `No ${view.kind}s match.`
  return "No generations from this model."
}
