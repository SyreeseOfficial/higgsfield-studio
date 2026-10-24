import { describe, expect, it } from "vitest"

import { runToGalleryItems } from "@/lib/studio/gallery-items"
import { applyFeedView, DEFAULT_FEED_VIEW } from "@/lib/studio/feed-view"
import type { RunRecord } from "@/lib/studio/history"
import { PendingKeys } from "@/lib/studio/pending-keys"

const failed: RunRecord = {
  id: "r1",
  requestId: "req-1",
  surface: "video",
  modelId: "m",
  modelLabel: "M",
  prompt: "p",
  settings: {},
  aspect: 1.7,
  status: "failed",
  error: "Blocked by the content filter",
  urls: [],
  createdAt: 1,
}

describe("failed runs stay visible", () => {
  const tiles = runToGalleryItems(failed)

  it("become a failed tile with the reason and support id", () => {
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatchObject({
      status: "failed",
      failureLabel: "Blocked by the content filter",
      supportId: "req-1",
    })
  })

  it.each(["all", "video", "failed"] as const)(
    "survive the %s filter",
    (kind) => {
      const shown = applyFeedView(tiles, { ...DEFAULT_FEED_VIEW, kind })
      expect(shown).toHaveLength(1)
    }
  )

  it("hand back the same tile objects for an unchanged record", () => {
    expect(runToGalleryItems(failed)).toBe(tiles)
  })
})

describe("PendingKeys (no double charge)", () => {
  let n = 0
  const make = () => `k${++n}`

  it("reuses the key while the outcome is unknown", () => {
    const keys = new PendingKeys()
    expect(keys.keyFor("plane-a", make)).toBe(keys.keyFor("plane-a", make))
  })

  it("remembers several pending requests at once", () => {
    const keys = new PendingKeys()
    const a = keys.keyFor("a", make)
    const b = keys.keyFor("b", make)
    expect(a).not.toBe(b)
    expect(keys.keyFor("a", make)).toBe(a)
    expect(keys.keyFor("b", make)).toBe(b)
  })

  it("issues a fresh key once the outcome is known", () => {
    const keys = new PendingKeys()
    const first = keys.keyFor("a", make)
    keys.settle("a")
    expect(keys.keyFor("a", make)).not.toBe(first)
  })

  it("forgets the oldest request past its limit", () => {
    const keys = new PendingKeys(2)
    const a = keys.keyFor("a", make)
    keys.keyFor("b", make)
    keys.keyFor("c", make)
    expect(keys.keyFor("a", make)).not.toBe(a)
  })
})
