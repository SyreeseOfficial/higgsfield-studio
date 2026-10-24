import { describe, expect, it } from "vitest"

import { parseUploadTicket } from "@/generation/upload-contract"
import { aspectFromSettings } from "@/lib/studio/history"
import { JustifiedLayoutEngine } from "@/components/studio/gallery/justified-engine"
import type { GalleryItem } from "@/components/studio/gallery/gallery-types"

describe("aspectFromSettings", () => {
  it("parses ratios and falls back to 1", () => {
    expect(aspectFromSettings({ aspect_ratio: "16:9" })).toBeCloseTo(16 / 9)
    expect(aspectFromSettings({ ratio: "9x16" })).toBeCloseTo(9 / 16)
    expect(aspectFromSettings({ aspect_ratio: "auto" })).toBe(1)
    expect(aspectFromSettings({})).toBe(1)
  })
})

describe("parseUploadTicket", () => {
  const ticket = {
    upload_url: "https://storage.example/put",
    public_url: "https://cdn.example/a.png",
    content_type: "image/png",
    upload_headers: { "Content-Type": "image/png" },
  }
  it("accepts a valid ticket", () => {
    expect(parseUploadTicket(ticket, "image/png").public_url).toBe(
      ticket.public_url
    )
  })
  it("rejects credential headers and mismatched types", () => {
    expect(() =>
      parseUploadTicket(
        { ...ticket, upload_headers: { ...ticket.upload_headers, Authorization: "x" } },
        "image/png"
      )
    ).toThrow()
    expect(() => parseUploadTicket(ticket, "image/jpeg")).toThrow()
    expect(() =>
      parseUploadTicket({ ...ticket, upload_url: "http://insecure" }, "image/png")
    ).toThrow()
  })
})

describe("JustifiedLayoutEngine", () => {
  const item = (id: string, width: number): GalleryItem => ({
    id,
    runId: id,
    createdAt: 0,
    kind: "image",
    status: "ready",
    src: "",
    width,
    height: 1,
    prompt: "",
    alt: "",
    modelLabel: "",
    settings: {},
    groupId: "all",
    groupLabel: "",
  })

  it("justifies a full row to the container width", () => {
    const engine = new JustifiedLayoutEngine()
    engine.setConfig({ containerWidth: 1000, targetRowHeight: 200, gap: 6, grouped: false })
    engine.setItems([item("a", 1), item("b", 1.5), item("c", 2), item("d", 1), item("e", 1)])
    const [row] = engine.compute().rows
    const tiles = row!.tiles!
    const used = tiles.reduce((n, t) => n + t.width, 0) + 6 * (tiles.length - 1)
    expect(used).toBeCloseTo(1000, 0)
  })
})
