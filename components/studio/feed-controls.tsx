"use client"

import {
  type FeedKind,
  type FeedSort,
  type FeedView,
} from "@/lib/studio/feed-view"
import { cn } from "@/lib/utils"

const KINDS: { value: FeedKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "starred", label: "Starred" },
  { value: "failed", label: "Failed" },
]

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "model", label: "Model" },
  { value: "starred", label: "Starred first" },
]

const select =
  "rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

/** Filter chips, a model filter and a sort order for the feed. */
export function FeedControls({
  view,
  models,
  onChange,
}: {
  view: FeedView
  /** Model labels present in the feed. */
  models: string[]
  onChange: (view: FeedView) => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {KINDS.map((kind) => (
        <button
          key={kind.value}
          type="button"
          aria-pressed={view.kind === kind.value}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            view.kind === kind.value
              ? "bg-foreground text-background"
              : "bg-white/8 hover:bg-white/14"
          )}
          onClick={() => onChange({ ...view, kind: kind.value })}
        >
          {kind.label}
        </button>
      ))}
      {models.length > 1 ? (
        <select
          aria-label="Filter by model"
          className={select}
          value={view.model}
          onChange={(event) => onChange({ ...view, model: event.target.value })}
        >
          <option value="all">All models</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      ) : null}
      <select
        aria-label="Sort"
        className={select}
        value={view.sort}
        onChange={(event) =>
          onChange({ ...view, sort: event.target.value as FeedSort })
        }
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </div>
  )
}
